// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {AgentVault} from "../src/AgentVault.sol";
import {MockUSDC, MockPQ, MockIdentity} from "./mocks/Mocks.sol";

/// Total compromise: the attacker holds the agent's session key AND the integrity attester's
/// P-256 key, so every request it sends carries a valid ECDSA signature and a valid attestation.
/// Only the vault's own checks stand between it and the funds. The invariants below are the bound
/// the vault promises in that world: money only reaches the allowlist, at most perTxCap per spend,
/// at most 2 * windowCap in any real window, nothing after revoke or expiry, no replay.
contract Attacker is Test {
    AgentVault public immutable vault;
    MockUSDC public immutable usdc;
    address public immutable owner;
    address public immutable merchant;
    address public immutable thief = makeAddr("thief");
    uint256 internal immutable agentPk;
    uint256 internal immutable attesterPk;
    address public immutable agent;
    uint64 public immutable expiresAt;
    uint256 public immutable windowSeconds;

    uint64 public revokedAt;
    uint256 public spends;
    uint256 public maxSpend;
    uint256 public maxWindowSum;
    bool public offAllowlistPaid;
    bool public paidAfterRevokeOrExpiry;
    bool public replayPaid;

    uint64[] internal paidAt;
    uint256[] internal paidAmount;
    bytes internal lastRequest;

    constructor(
        AgentVault vault_,
        MockUSDC usdc_,
        address owner_,
        address merchant_,
        uint256 agentPk_,
        uint256 attesterPk_,
        uint64 expiresAt_,
        uint256 windowSeconds_
    ) {
        vault = vault_;
        usdc = usdc_;
        owner = owner_;
        merchant = merchant_;
        agentPk = agentPk_;
        attesterPk = attesterPk_;
        agent = vm.addr(agentPk_);
        expiresAt = expiresAt_;
        windowSeconds = windowSeconds_;
    }

    function _target(uint256 seed) internal view returns (address) {
        uint256 k = seed % 5;
        if (k == 0) return thief;
        if (k == 1) return owner;
        if (k == 2) return address(vault);
        if (k == 3) return merchant;
        return address(uint160(uint256(keccak256(abi.encode(seed)))));
    }

    /// Greedy drain toward the one allowlisted recipient: the path that stresses the caps.
    function drainMerchant(uint256 amount) external {
        _spend(merchant, _bound(amount, 1, 25e6), amount);
    }

    /// Pay anyone else: the thief, the owner, the vault itself, or a random address.
    function spendTo(uint256 toSeed, uint256 amount) external {
        _spend(_target(toSeed), _bound(amount, 1, 25e6), toSeed);
    }

    /// A fully authorized request for whatever the attacker wants: right nonce, fresh deadline,
    /// agent ECDSA signature and attester P-256 signature over the vault's own digest.
    function _spend(address to, uint256 amount, uint256 salt) internal {
        uint64 nonce = vault.getSession(agent).nonce;
        uint64 deadline = uint64(block.timestamp + 300);
        bytes32 orderId = keccak256(abi.encode(spends, salt, amount, block.timestamp));
        bytes32 d = vault.spendDigest(agent, to, amount, nonce, deadline, orderId);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(agentPk, d);
        (bytes32 pr, bytes32 ps) = vm.signP256(attesterPk, vault.attestationHash(d));
        AgentVault.SpendRequest memory req = AgentVault.SpendRequest(
            agent, to, amount, deadline, orderId, abi.encodePacked(r, s, v), "", abi.encodePacked(pr, ps)
        );
        lastRequest = abi.encode(req);
        try vault.spend(req) {
            _record(to, amount, orderId);
        } catch {}
    }

    /// Resubmit the last request byte for byte (a captured, possibly already settled, spend).
    /// It may only settle if the original never did.
    function replayLast() external {
        if (lastRequest.length == 0) return;
        AgentVault.SpendRequest memory req = abi.decode(lastRequest, (AgentVault.SpendRequest));
        bool alreadyPaid = paidOrder[req.orderId];
        try vault.spend(req) {
            if (alreadyPaid) replayPaid = true;
            _record(req.to, req.amount, req.orderId);
        } catch {}
    }

    /// Once the attacker has settled real spends, jump to an hour before expiry, so the run keeps
    /// attacking across the expiry boundary (12h warps alone rarely get 30 days out).
    function jumpNearExpiry() external {
        if (jumped || spends < 10 || block.timestamp + 1 hours >= expiresAt) return;
        jumped = true;
        vm.warp(expiresAt - 1 hours);
    }

    bool public jumped;

    function warp(uint32 dt) external {
        vm.warp(block.timestamp + _bound(dt, 1, 12 hours));
    }

    /// Rare (1 in 256 calls), so most runs spend a long time with a live session. Not keyed on 0:
    /// the fuzzer's dictionary feeds 0 constantly, which would revoke at the start of every run.
    function revokeNow(uint8 roll) external {
        if (roll != 137 || revokedAt != 0) return;
        vm.prank(owner);
        vault.revokeSession(agent);
        revokedAt = uint64(block.timestamp);
    }

    mapping(bytes32 => bool) internal paidOrder;

    function _record(address to, uint256 amount, bytes32 orderId) internal {
        spends++;
        if (to != merchant) offAllowlistPaid = true;
        if ((revokedAt != 0) || block.timestamp >= expiresAt) paidAfterRevokeOrExpiry = true;
        if (amount > maxSpend) maxSpend = amount;
        paidOrder[orderId] = true;

        paidAt.push(uint64(block.timestamp));
        paidAmount.push(amount);
        // Heaviest real window ending at this spend: everything paid in (now - W, now].
        uint256 sum;
        for (uint256 i = paidAt.length; i > 0; i--) {
            if (uint256(paidAt[i - 1]) + windowSeconds <= block.timestamp) break;
            sum += paidAmount[i - 1];
        }
        if (sum > maxWindowSum) maxWindowSum = sum;
    }
}

contract AgentVaultCompromiseTest is Test {
    address constant PQ = 0x1800000000000000000000000000000000000004;
    uint256 constant AGENT_PK = 0xA11CE;
    uint256 constant ATTESTER_PK = 0xA77E5;
    uint256 constant PER_TX = 20e6;
    uint256 constant WINDOW_CAP = 30e6;
    uint64 constant WINDOW = 1 days;
    uint256 constant FUNDED = 10_000e6;

    AgentVault vault;
    MockUSDC usdc;
    Attacker attacker;
    address owner = makeAddr("owner");
    address merchant = makeAddr("merchant");

    function setUp() public {
        vm.warp(1_800_000_000);
        usdc = new MockUSDC();
        MockIdentity identity = new MockIdentity();
        identity.register(2579, makeAddr("agentOperator"));
        vm.etch(PQ, address(new MockPQ()).code);
        vault = new AgentVault(owner, address(usdc), address(identity), 1_000e6);
        usdc.mint(address(vault), FUNDED);

        address[] memory allow = new address[](1);
        allow[0] = merchant;
        (uint256 x, uint256 y) = vm.publicKeyP256(ATTESTER_PK);
        uint64 expiresAt = uint64(block.timestamp + 30 days);
        AgentVault.SessionConfig memory c = AgentVault.SessionConfig({
            agentId: 2579,
            slhVk: bytes32(0),
            perTxCap: uint128(PER_TX),
            windowCap: uint128(WINDOW_CAP),
            windowSeconds: WINDOW,
            expiresAt: expiresAt,
            pqThreshold: type(uint128).max,
            policyHash: keccak256("mainnet-pilot"),
            allowRecipients: allow,
            attesterX: bytes32(x),
            attesterY: bytes32(y),
            attestThreshold: 0
        });
        vm.prank(owner);
        vault.installSession(vm.addr(AGENT_PK), c);

        attacker = new Attacker(vault, usdc, owner, merchant, AGENT_PK, ATTESTER_PK, expiresAt, WINDOW);
        targetContract(address(attacker));
        bytes4[] memory sel = new bytes4[](6);
        sel[0] = Attacker.drainMerchant.selector;
        sel[1] = Attacker.spendTo.selector;
        sel[2] = Attacker.replayLast.selector;
        sel[3] = Attacker.warp.selector;
        sel[4] = Attacker.revokeNow.selector;
        sel[5] = Attacker.jumpNearExpiry.selector;
        targetSelector(FuzzSelector({addr: address(attacker), selectors: sel}));
    }

    /// Sanity: the attacker's keys really are good enough to move money — so a passing invariant
    /// means the vault's checks held, not that the attacker was unable to sign.
    function test_attackerKeysAreValid() public {
        attacker.drainMerchant(5e6);
        assertEq(usdc.balanceOf(merchant), 5e6);
    }

    /// Deterministic: at expiry, both stolen keys together move nothing.
    function test_expiredSessionRefusesWithBothKeys() public {
        attacker.drainMerchant(5e6);
        assertEq(usdc.balanceOf(merchant), 5e6);
        vm.warp(attacker.expiresAt());
        attacker.drainMerchant(5e6);
        attacker.replayLast();
        assertEq(usdc.balanceOf(merchant), 5e6);
        assertEq(attacker.spends(), 1);
    }

    function invariant_onlyAllowlistedEverPaid() public view {
        assertFalse(attacker.offAllowlistPaid());
        assertEq(usdc.balanceOf(attacker.thief()), 0);
        assertEq(usdc.balanceOf(owner), 0);
        assertEq(usdc.balanceOf(address(vault)) + usdc.balanceOf(merchant), FUNDED);
    }

    function invariant_perTxBounded() public view {
        assertLe(attacker.maxSpend(), PER_TX);
    }

    function invariant_anyRealWindowBoundedByTwiceCap() public view {
        assertLe(attacker.maxWindowSum(), 2 * WINDOW_CAP);
    }

    function invariant_nothingAfterRevokeOrExpiry() public view {
        assertFalse(attacker.paidAfterRevokeOrExpiry());
    }

    function invariant_noReplay() public view {
        assertFalse(attacker.replayPaid());
    }

    /// Non-vacuity: a run where the session stayed live must have actually moved money, or the
    /// invariants above would pass for an attacker that never got anything through (measured
    /// 2026-10-20: every unrevoked run in 64 settled at least 40 spends).
    function afterInvariant() public view {
        assertTrue(attacker.spends() >= 10 || attacker.revokedAt() != 0, "run settled almost nothing");
    }
}
