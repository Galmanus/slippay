// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {AgentVault} from "../src/AgentVault.sol";
import {AgentVaultV2} from "../src/AgentVaultV2.sol";
import {MockUSDC, MockPQ, MockIdentity} from "./mocks/Mocks.sol";

/// Holds under total compromise: the attacker holds the agent's key AND the integrity attester's
/// P-256 key, so every hold, release and spend it sends is validly signed and attested. The owner
/// also tries to withdraw at random. Invariants: money only ever reaches the allowlisted payee
/// (or the owner, through withdraw of the free balance); a hold pays out at most once; held funds
/// always match the open holds and never exceed the balance; caps stay bounded.
contract HoldAttacker is Test {
    AgentVaultV2 public immutable vault;
    MockUSDC public immutable usdc;
    address public immutable owner;
    address public immutable merchant;
    address public immutable thief = makeAddr("thief");
    address public immutable stranger = makeAddr("stranger");
    uint256 internal immutable agentPk;
    uint256 internal immutable attesterPk;
    address public immutable agent;
    uint256 public immutable windowSeconds;

    bytes32[] internal ids;
    mapping(bytes32 => bool) public paidOut; // released or refunded
    uint256 public sumOpen;
    uint256 public holdsMade;
    uint256 public holdsClosed;
    uint256 public ownerWithdrawn;
    uint256 public maxCommit;
    uint256 public maxWindowSum;
    uint64 public revokedAt;
    bool public doublePaid;
    bool public offListPaid;

    uint64[] internal commitAt;
    uint256[] internal commitAmount;

    constructor(
        AgentVaultV2 v,
        MockUSDC u,
        address owner_,
        address merchant_,
        uint256 agentPk_,
        uint256 attesterPk_,
        uint256 w
    ) {
        vault = v;
        usdc = u;
        owner = owner_;
        merchant = merchant_;
        agentPk = agentPk_;
        attesterPk = attesterPk_;
        agent = vm.addr(agentPk_);
        windowSeconds = w;
    }

    function _target(uint256 seed) internal view returns (address) {
        uint256 k = seed % 5;
        if (k == 0) return thief;
        if (k == 1) return owner;
        if (k == 2) return address(vault);
        if (k == 3) return merchant;
        return address(uint160(uint256(keccak256(abi.encode(seed)))));
    }

    function _sig(bytes32 d) internal view returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(agentPk, d);
        return abi.encodePacked(r, s, v);
    }

    function _att(bytes32 d) internal view returns (bytes memory) {
        (bytes32 r, bytes32 s) = vm.signP256(attesterPk, vault.attestationHash(d));
        return abi.encodePacked(r, s);
    }

    function _commit(uint256 amount) internal {
        if (amount > maxCommit) maxCommit = amount;
        commitAt.push(uint64(block.timestamp));
        commitAmount.push(amount);
        uint256 sum;
        for (uint256 i = commitAt.length; i > 0; i--) {
            if (uint256(commitAt[i - 1]) + windowSeconds <= block.timestamp) break;
            sum += commitAmount[i - 1];
        }
        if (sum > maxWindowSum) maxWindowSum = sum;
    }

    function _hold(address payee, uint256 amount, uint256 releaseIn, uint256 salt) internal {
        uint64 nonce = vault.getSession(agent).nonce;
        uint64 deadline = uint64(block.timestamp + 300);
        uint64 releaseBy = uint64(block.timestamp + releaseIn);
        bytes32 orderId = keccak256(abi.encode(holdsMade, salt, block.timestamp));
        bytes32 d = vault.holdDigest(agent, payee, amount, nonce, deadline, releaseBy, orderId);
        AgentVaultV2.HoldRequest memory r =
            AgentVaultV2.HoldRequest(agent, payee, amount, deadline, releaseBy, orderId, _sig(d), "", _att(d));
        try vault.hold(r) returns (bytes32 id) {
            if (payee != merchant) offListPaid = true;
            ids.push(id);
            holdsMade++;
            sumOpen += amount;
            _commit(amount);
        } catch {}
    }

    /// Greedy holds to the one allowlisted payee: stresses caps and free balance.
    function holdMerchant(uint256 amount, uint32 releaseIn) external {
        _hold(merchant, _bound(amount, 1, 25e6), _bound(releaseIn, 1, 40 days), amount);
    }

    /// Holds to anyone else: thief, owner, the vault itself, a random address.
    function holdElsewhere(uint256 seed, uint256 amount, uint32 releaseIn) external {
        _hold(_target(seed), _bound(amount, 1, 25e6), _bound(releaseIn, 1, 40 days), seed);
    }

    /// Release with valid agent + attester signatures, or as the owner.
    function releaseOne(uint256 idx, uint8 asOwner) external {
        if (ids.length == 0) return;
        bytes32 id = ids[idx % ids.length];
        AgentVaultV2.Hold memory h = vault.getHold(id);
        bytes32 d = vault.releaseDigest(id);
        bytes memory sig = _sig(d);
        bytes memory att = _att(d);
        uint256 before = usdc.balanceOf(h.payee);
        if (asOwner % 4 == 0) vm.prank(owner);
        try vault.release(id, sig, att) {
            if (paidOut[id]) doublePaid = true;
            paidOut[id] = true;
            holdsClosed++;
            sumOpen -= h.amount;
            if (h.payee != merchant) offListPaid = true;
            if (usdc.balanceOf(h.payee) != before + h.amount) doublePaid = true;
        } catch {}
    }

    /// Refund as the payee, a stranger or the owner.
    function refundOne(uint256 idx, uint8 who) external {
        if (ids.length == 0) return;
        bytes32 id = ids[idx % ids.length];
        AgentVaultV2.Hold memory h = vault.getHold(id);
        address caller = who % 3 == 0 ? h.payee : who % 3 == 1 ? stranger : owner;
        vm.prank(caller);
        try vault.refund(id) {
            if (paidOut[id]) doublePaid = true;
            paidOut[id] = true;
            holdsClosed++;
            sumOpen -= h.amount;
        } catch {}
    }

    /// An ordinary spend, fully authorized, to anyone.
    function spendTo(uint256 seed, uint256 amount) external {
        address to = _target(seed);
        amount = _bound(amount, 1, 25e6);
        uint64 nonce = vault.getSession(agent).nonce;
        uint64 deadline = uint64(block.timestamp + 300);
        bytes32 orderId = keccak256(abi.encode("spend", seed, amount, block.timestamp));
        bytes32 d = vault.spendDigest(agent, to, amount, nonce, deadline, orderId);
        try vault.spend(AgentVault.SpendRequest(agent, to, amount, deadline, orderId, _sig(d), "", _att(d))) {
            if (to != merchant) offListPaid = true;
            _commit(amount);
        } catch {}
    }

    /// The owner tries to withdraw; only the free balance may move.
    function ownerWithdraw(uint256 amount) external {
        amount = _bound(amount, 1, 600e6);
        vm.prank(owner);
        try vault.withdraw(owner, amount) {
            ownerWithdrawn += amount;
        } catch {}
    }

    function warp(uint32 dt) external {
        vm.warp(block.timestamp + _bound(dt, 1, 12 hours));
    }

    function revokeNow(uint8 roll) external {
        if (roll != 137 || revokedAt != 0) return;
        vm.prank(owner);
        vault.revokeSession(agent);
        revokedAt = uint64(block.timestamp);
    }
}

contract AgentVaultV2CompromiseTest is Test {
    address constant PQ = 0x1800000000000000000000000000000000000004;
    uint256 constant AGENT_PK = 0xA11CE;
    uint256 constant ATTESTER_PK = 0xA77E5;
    uint256 constant PER_TX = 20e6;
    uint256 constant WINDOW_CAP = 30e6;
    uint64 constant WINDOW = 1 days;
    uint256 constant FUNDED = 2_000e6;

    AgentVaultV2 vault;
    MockUSDC usdc;
    HoldAttacker attacker;
    address owner = makeAddr("owner");
    address merchant = makeAddr("merchant");

    function setUp() public {
        vm.warp(1_800_000_000);
        usdc = new MockUSDC();
        MockIdentity identity = new MockIdentity();
        identity.register(2579, makeAddr("operator"));
        vm.etch(PQ, address(new MockPQ()).code);
        vault = new AgentVaultV2(owner, address(usdc), address(identity), 1_000e6);
        usdc.mint(address(vault), FUNDED);

        address[] memory allow = new address[](1);
        allow[0] = merchant;
        (uint256 x, uint256 y) = vm.publicKeyP256(ATTESTER_PK);
        AgentVault.SessionConfig memory c = AgentVault.SessionConfig({
            agentId: 2579,
            slhVk: bytes32(0),
            perTxCap: uint128(PER_TX),
            windowCap: uint128(WINDOW_CAP),
            windowSeconds: WINDOW,
            expiresAt: uint64(block.timestamp + 30 days),
            pqThreshold: type(uint128).max,
            policyHash: keccak256("holds-pilot"),
            allowRecipients: allow,
            attesterX: bytes32(x),
            attesterY: bytes32(y),
            attestThreshold: 0
        });
        vm.prank(owner);
        vault.installSession(vm.addr(AGENT_PK), c);

        attacker = new HoldAttacker(vault, usdc, owner, merchant, AGENT_PK, ATTESTER_PK, WINDOW);
        targetContract(address(attacker));
        bytes4[] memory sel = new bytes4[](8);
        sel[0] = HoldAttacker.holdMerchant.selector;
        sel[1] = HoldAttacker.holdElsewhere.selector;
        sel[2] = HoldAttacker.releaseOne.selector;
        sel[3] = HoldAttacker.refundOne.selector;
        sel[4] = HoldAttacker.spendTo.selector;
        sel[5] = HoldAttacker.ownerWithdraw.selector;
        sel[6] = HoldAttacker.warp.selector;
        sel[7] = HoldAttacker.revokeNow.selector;
        targetSelector(FuzzSelector({addr: address(attacker), selectors: sel}));
    }

    function test_attackerCanHoldAndRelease() public {
        attacker.holdMerchant(5e6, 1 days);
        attacker.releaseOne(0, 1);
        assertEq(usdc.balanceOf(merchant), 5e6);
    }

    function invariant_onlyAllowlistedPayeeOrOwnerPaid() public view {
        assertFalse(attacker.offListPaid());
        assertEq(usdc.balanceOf(attacker.thief()), 0);
        assertEq(usdc.balanceOf(attacker.stranger()), 0);
        assertEq(usdc.balanceOf(owner), attacker.ownerWithdrawn());
    }

    function invariant_conservation() public view {
        assertEq(usdc.balanceOf(address(vault)) + usdc.balanceOf(merchant) + usdc.balanceOf(owner), FUNDED);
    }

    function invariant_holdPaysAtMostOnce() public view {
        assertFalse(attacker.doublePaid());
    }

    function invariant_totalHeldMatchesOpenHoldsAndBalance() public view {
        assertEq(vault.totalHeld(), attacker.sumOpen());
        assertLe(vault.totalHeld(), usdc.balanceOf(address(vault)));
    }

    function invariant_perCommitmentBounded() public view {
        assertLe(attacker.maxCommit(), PER_TX);
    }

    function invariant_anyRealWindowOfCommitmentsBoundedByTwiceCap() public view {
        assertLe(attacker.maxWindowSum(), 2 * WINDOW_CAP);
    }

    /// Non-vacuity: an unrevoked run must have made and closed holds.
    function afterInvariant() public view {
        assertTrue(
            attacker.revokedAt() != 0 || (attacker.holdsMade() >= 5 && attacker.holdsClosed() >= 2),
            "run made almost no holds"
        );
    }
}
