// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {AgentVaultCore} from "../src/AgentVaultCore.sol";
import {AgentVaultV2} from "../src/AgentVaultV2.sol";
import {MockUSDC, MockPQ, MockIdentity} from "./mocks/Mocks.sol";

/// Pay-on-delivery holds: the agent pays into an on-chain hold that releases to the payee only on
/// delivery (agent signature, attested above the threshold, or the owner) and refunds itself after
/// releaseBy. Same limits as a spend; held funds are out of reach of spend and withdraw.
contract AgentVaultV2Test is Test {
    address constant PQ = 0x1800000000000000000000000000000000000004;
    bytes32 constant HOLD_TYPEHASH = keccak256(
        "Hold(address agentSigner,address payee,uint256 amount,uint64 nonce,uint64 deadline,uint64 releaseBy,bytes32 orderId)"
    );
    bytes32 constant RELEASE_TYPEHASH = keccak256("Release(bytes32 holdId)");
    bytes32 constant SPEND_TYPEHASH =
        keccak256("Spend(address agentSigner,address to,uint256 amount,uint64 nonce,uint64 deadline,bytes32 orderId)");

    AgentVaultV2 vault;
    MockUSDC usdc;
    address owner = makeAddr("owner");
    address merchant = makeAddr("merchant");
    address stranger = makeAddr("stranger");
    uint256 constant AGENT_PK = 0xA11CE;
    uint256 constant ATTESTER_PK = 0xA77E5;
    address agent;
    uint256 constant FUNDED = 1_000e6;

    function setUp() public {
        vm.warp(1_800_000_000);
        agent = vm.addr(AGENT_PK);
        usdc = new MockUSDC();
        MockIdentity identity = new MockIdentity();
        identity.register(42, makeAddr("operator"));
        vm.etch(PQ, address(new MockPQ()).code);
        vault = new AgentVaultV2(owner, address(usdc), address(identity), 1_000e6);
        usdc.mint(address(vault), FUNDED);
        vm.prank(owner);
        vault.installSession(agent, _cfg());
    }

    // ---------- helpers ----------

    function _cfg() internal view returns (AgentVaultCore.SessionConfig memory c) {
        address[] memory allow = new address[](1);
        allow[0] = merchant;
        (uint256 x, uint256 y) = vm.publicKeyP256(ATTESTER_PK);
        c = AgentVaultCore.SessionConfig({
            agentId: 42,
            slhVk: bytes32(0),
            perTxCap: 100e6,
            windowCap: 300e6,
            windowSeconds: 1 days,
            expiresAt: uint64(block.timestamp + 30 days),
            pqThreshold: type(uint128).max,
            policyHash: keccak256("holds"),
            allowRecipients: allow,
            attesterX: bytes32(x),
            attesterY: bytes32(y),
            attestThreshold: 10e6 // above 10 USDC, holds and releases need the attester
        });
    }

    function _domain() internal view returns (bytes32) {
        return keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256("SlippayAgentVault"),
                keccak256("1"),
                block.chainid,
                address(vault)
            )
        );
    }

    function _holdDigest(
        address payee,
        uint256 amount,
        uint64 nonce,
        uint64 deadline,
        uint64 releaseBy,
        bytes32 orderId
    ) internal view returns (bytes32) {
        bytes32 h = keccak256(abi.encode(HOLD_TYPEHASH, agent, payee, amount, nonce, deadline, releaseBy, orderId));
        return keccak256(abi.encodePacked("\x19\x01", _domain(), h));
    }

    function _releaseDigest(bytes32 holdId) internal view returns (bytes32) {
        return keccak256(abi.encodePacked("\x19\x01", _domain(), keccak256(abi.encode(RELEASE_TYPEHASH, holdId))));
    }

    function _ecdsa(uint256 pk, bytes32 d) internal pure returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, d);
        return abi.encodePacked(r, s, v);
    }

    function _attest(uint256 pk, bytes32 d) internal pure returns (bytes memory) {
        (bytes32 r, bytes32 s) = vm.signP256(pk, keccak256(abi.encodePacked(keccak256("SlippayAIA.arc.v1"), d)));
        return abi.encodePacked(r, s);
    }

    function _req(address payee, uint256 amount, uint64 releaseBy, bytes32 orderId, bool withAttestation)
        internal
        view
        returns (AgentVaultV2.HoldRequest memory r)
    {
        uint64 nonce = vault.getSession(agent).nonce;
        uint64 deadline = uint64(block.timestamp + 300);
        bytes32 d = _holdDigest(payee, amount, nonce, deadline, releaseBy, orderId);
        r = AgentVaultV2.HoldRequest(
            agent,
            payee,
            amount,
            deadline,
            releaseBy,
            orderId,
            _ecdsa(AGENT_PK, d),
            "",
            withAttestation ? _attest(ATTESTER_PK, d) : bytes("")
        );
    }

    function _hold(uint256 amount) internal returns (bytes32) {
        return vault.hold(
            _req(
                merchant,
                amount,
                uint64(block.timestamp + 7 days),
                keccak256(abi.encode("order", amount, block.timestamp)),
                true
            )
        );
    }

    function _release(bytes32 holdId) internal {
        bytes32 d = _releaseDigest(holdId);
        vault.release(holdId, _ecdsa(AGENT_PK, d), _attest(ATTESTER_PK, d));
    }

    // ---------- hold ----------

    function test_freeBalance_equalsBalanceWithoutHolds() public view {
        assertEq(vault.totalHeld(), 0);
        assertEq(vault.freeBalance(), FUNDED);
    }

    function test_hold_locksFundsInsideTheVault() public {
        bytes32 id = _hold(50e6);
        assertEq(usdc.balanceOf(address(vault)), FUNDED, "nothing left the vault");
        assertEq(vault.totalHeld(), 50e6);
        assertEq(vault.freeBalance(), FUNDED - 50e6);
        AgentVaultV2.Hold memory h = vault.getHold(id);
        assertEq(h.payee, merchant);
        assertEq(h.amount, 50e6);
        assertEq(uint8(h.status), uint8(AgentVaultV2.HoldStatus.Open));
        assertEq(vault.getSession(agent).nonce, 1, "hold uses the session nonce");
        assertEq(vault.getSession(agent).curSpent, 50e6, "hold consumes the window");
    }

    function test_hold_holdIdIsTheHoldDigest() public {
        uint64 releaseBy = uint64(block.timestamp + 1 days);
        AgentVaultV2.HoldRequest memory r = _req(merchant, 5e6, releaseBy, keccak256("o"), false);
        bytes32 id = vault.hold(r);
        assertEq(id, _holdDigest(merchant, 5e6, 0, r.deadline, releaseBy, keccak256("o")));
        assertEq(id, vault.holdDigest(agent, merchant, 5e6, 0, r.deadline, releaseBy, keccak256("o")));
    }

    function test_hold_emitsHoldCreated() public {
        uint64 releaseBy = uint64(block.timestamp + 1 days);
        AgentVaultV2.HoldRequest memory r = _req(merchant, 20e6, releaseBy, keccak256("o"), true);
        bytes32 id = _holdDigest(merchant, 20e6, 0, r.deadline, releaseBy, keccak256("o"));
        vm.expectEmit(true, true, true, true, address(vault));
        emit AgentVaultV2.HoldCreated(id, agent, merchant, 20e6, releaseBy, keccak256("o"), 0, true);
        vault.hold(r);
    }

    function test_hold_rejectsPayeeOffTheAllowlist() public {
        AgentVaultV2.HoldRequest memory r = _req(stranger, 5e6, uint64(block.timestamp + 1 days), keccak256("o"), false);
        vm.expectRevert(AgentVaultCore.RecipientNotAllowed.selector);
        vault.hold(r);
    }

    function test_hold_rejectsAbovePerTxCap() public {
        AgentVaultV2.HoldRequest memory r =
            _req(merchant, 100e6 + 1, uint64(block.timestamp + 1 days), keccak256("o"), true);
        vm.expectRevert(AgentVaultCore.AmountExceedsCap.selector);
        vault.hold(r);
    }

    function test_hold_consumesTheWindowLikeASpend() public {
        _hold(100e6);
        _hold(100e6);
        _hold(100e6);
        AgentVaultV2.HoldRequest memory r =
            _req(merchant, 1e6, uint64(block.timestamp + 1 days), keccak256("4th"), false);
        vm.expectRevert(AgentVaultCore.WindowCapExceeded.selector);
        vault.hold(r);
    }

    function test_hold_rejectsAnotherSigner() public {
        AgentVaultV2.HoldRequest memory r = _req(merchant, 5e6, uint64(block.timestamp + 1 days), keccak256("o"), false);
        r.ecdsaSig = _ecdsa(0xBAD, _holdDigest(merchant, 5e6, 0, r.deadline, r.releaseBy, r.orderId));
        vm.expectRevert(AgentVaultCore.BadSignature.selector);
        vault.hold(r);
    }

    function test_hold_rejectsMissingAttestationAboveThreshold() public {
        AgentVaultV2.HoldRequest memory r =
            _req(merchant, 20e6, uint64(block.timestamp + 1 days), keccak256("o"), false);
        vm.expectRevert(AgentVaultCore.BadAttestation.selector);
        vault.hold(r);
    }

    function test_hold_rejectsAttestationFromAnotherKey() public {
        AgentVaultV2.HoldRequest memory r =
            _req(merchant, 20e6, uint64(block.timestamp + 1 days), keccak256("o"), false);
        r.attestation = _attest(0xBAD5, _holdDigest(merchant, 20e6, 0, r.deadline, r.releaseBy, r.orderId));
        vm.expectRevert(AgentVaultCore.BadAttestation.selector);
        vault.hold(r);
    }

    function test_hold_rejectsReleaseByInThePast() public {
        AgentVaultV2.HoldRequest memory r = _req(merchant, 5e6, uint64(block.timestamp), keccak256("o"), false);
        vm.expectRevert(AgentVaultV2.BadReleaseWindow.selector);
        vault.hold(r);
    }

    function test_hold_rejectsReleaseByBeyondThirtyDays() public {
        AgentVaultV2.HoldRequest memory r =
            _req(merchant, 5e6, uint64(block.timestamp + 30 days + 1), keccak256("o"), false);
        vm.expectRevert(AgentVaultV2.BadReleaseWindow.selector);
        vault.hold(r);
    }

    function test_hold_acceptsReleaseByExactlyThirtyDays() public {
        vault.hold(_req(merchant, 5e6, uint64(block.timestamp + 30 days), keccak256("o"), false));
        assertEq(vault.totalHeld(), 5e6);
    }

    function test_hold_rejectsWhenTheFreeBalanceIsShort() public {
        vm.prank(owner);
        vault.withdraw(owner, FUNDED - 10e6);
        AgentVaultV2.HoldRequest memory r = _req(merchant, 11e6, uint64(block.timestamp + 1 days), keccak256("o"), true);
        vm.expectRevert(AgentVaultV2.InsufficientFreeBalance.selector);
        vault.hold(r);
    }

    function test_hold_rejectsRevokedSession() public {
        vm.prank(owner);
        vault.revokeSession(agent);
        AgentVaultV2.HoldRequest memory r = _req(merchant, 5e6, uint64(block.timestamp + 1 days), keccak256("o"), false);
        vm.expectRevert(AgentVaultCore.SessionIsRevoked.selector);
        vault.hold(r);
    }

    function test_hold_rejectsExpiredSession() public {
        vm.warp(block.timestamp + 30 days);
        AgentVaultV2.HoldRequest memory r = _req(merchant, 5e6, uint64(block.timestamp + 1 days), keccak256("o"), false);
        vm.expectRevert(AgentVaultCore.SessionExpired.selector);
        vault.hold(r);
    }

    function test_hold_rejectsExpiredDeadline() public {
        AgentVaultV2.HoldRequest memory r = _req(merchant, 5e6, uint64(block.timestamp + 1 days), keccak256("o"), false);
        vm.warp(block.timestamp + 301);
        vm.expectRevert(AgentVaultCore.Expired.selector);
        vault.hold(r);
    }

    function test_hold_rejectsASpendSignature() public {
        uint64 deadline = uint64(block.timestamp + 300);
        bytes32 spendD = keccak256(
            abi.encodePacked(
                "\x19\x01",
                _domain(),
                keccak256(abi.encode(SPEND_TYPEHASH, agent, merchant, 5e6, uint64(0), deadline, keccak256("o")))
            )
        );
        AgentVaultV2.HoldRequest memory r = AgentVaultV2.HoldRequest(
            agent,
            merchant,
            5e6,
            deadline,
            uint64(block.timestamp + 1 days),
            keccak256("o"),
            _ecdsa(AGENT_PK, spendD),
            "",
            ""
        );
        vm.expectRevert(AgentVaultCore.BadSignature.selector);
        vault.hold(r);
    }

    function test_hold_cannotBeSubmittedTwice() public {
        AgentVaultV2.HoldRequest memory r = _req(merchant, 5e6, uint64(block.timestamp + 1 days), keccak256("o"), false);
        vault.hold(r);
        vm.expectRevert(AgentVaultCore.BadSignature.selector); // the nonce moved on
        vault.hold(r);
    }

    // ---------- release ----------

    function test_release_byTheAgentPaysThePayee() public {
        bytes32 id = _hold(50e6);
        vm.expectEmit(true, true, false, true, address(vault));
        emit AgentVaultV2.HoldReleased(id, address(this));
        _release(id);
        assertEq(usdc.balanceOf(merchant), 50e6);
        assertEq(vault.totalHeld(), 0);
        assertEq(uint8(vault.getHold(id).status), uint8(AgentVaultV2.HoldStatus.Released));
    }

    function test_release_twiceReverts() public {
        bytes32 id = _hold(50e6);
        _release(id);
        bytes32 d = _releaseDigest(id);
        bytes memory sig = _ecdsa(AGENT_PK, d);
        bytes memory att = _attest(ATTESTER_PK, d);
        vm.expectRevert(AgentVaultV2.HoldNotOpen.selector);
        vault.release(id, sig, att);
        assertEq(usdc.balanceOf(merchant), 50e6);
    }

    function test_release_atReleaseByIsRefused() public {
        bytes32 id = _hold(50e6);
        vm.warp(vault.getHold(id).releaseBy);
        bytes32 d = _releaseDigest(id);
        bytes memory sig = _ecdsa(AGENT_PK, d);
        bytes memory att = _attest(ATTESTER_PK, d);
        vm.expectRevert(AgentVaultV2.HoldExpired.selector);
        vault.release(id, sig, att);
    }

    function test_release_byAnotherSignerIsRefused() public {
        bytes32 id = _hold(50e6);
        bytes32 d = _releaseDigest(id);
        bytes memory sig = _ecdsa(0xBAD, d);
        bytes memory att = _attest(ATTESTER_PK, d);
        vm.expectRevert(AgentVaultCore.BadSignature.selector);
        vault.release(id, sig, att);
    }

    function test_release_aboveThresholdNeedsTheAttester() public {
        bytes32 id = _hold(50e6);
        bytes memory sig = _ecdsa(AGENT_PK, _releaseDigest(id));
        vm.expectRevert(AgentVaultCore.BadAttestation.selector);
        vault.release(id, sig, "");
    }

    function test_release_attestationForTheHoldDoesNotReleaseIt() public {
        uint64 releaseBy = uint64(block.timestamp + 1 days);
        AgentVaultV2.HoldRequest memory r = _req(merchant, 50e6, releaseBy, keccak256("o"), true);
        bytes32 id = vault.hold(r);
        bytes memory sig = _ecdsa(AGENT_PK, _releaseDigest(id));
        vm.expectRevert(AgentVaultCore.BadAttestation.selector);
        vault.release(id, sig, r.attestation); // the hold's attestation signed the hold digest, not the release
    }

    function test_release_atOrBelowThresholdNeedsOnlyTheAgent() public {
        bytes32 id = _hold(10e6);
        vault.release(id, _ecdsa(AGENT_PK, _releaseDigest(id)), "");
        assertEq(usdc.balanceOf(merchant), 10e6);
    }

    function test_release_byTheAgentAfterRevokeIsRefused() public {
        bytes32 id = _hold(50e6);
        vm.prank(owner);
        vault.revokeSession(agent);
        bytes32 d = _releaseDigest(id);
        bytes memory sig = _ecdsa(AGENT_PK, d);
        bytes memory att = _attest(ATTESTER_PK, d);
        vm.expectRevert(AgentVaultCore.SessionIsRevoked.selector);
        vault.release(id, sig, att);
    }

    function test_release_byTheAgentAfterSessionExpiryIsRefused() public {
        vm.warp(block.timestamp + 1 days); // so the hold outlives the session
        bytes32 id = vault.hold(_req(merchant, 5e6, uint64(block.timestamp + 30 days), keccak256("o"), false));
        vm.warp(vault.getSession(agent).expiresAt);
        bytes memory sig = _ecdsa(AGENT_PK, _releaseDigest(id));
        vm.expectRevert(AgentVaultCore.SessionExpired.selector);
        vault.release(id, sig, "");
    }

    function test_release_byTheOwnerWorksEvenAfterRevoke() public {
        bytes32 id = _hold(50e6);
        vm.startPrank(owner);
        vault.revokeSession(agent);
        vault.release(id, "", "");
        vm.stopPrank();
        assertEq(usdc.balanceOf(merchant), 50e6);
    }

    function test_release_whenThePayeeIsBlockedRevertsAndRefundStillWorks() public {
        bytes32 id = _hold(50e6);
        usdc.setBlocked(merchant, true);
        bytes32 d = _releaseDigest(id);
        bytes memory sig = _ecdsa(AGENT_PK, d);
        bytes memory att = _attest(ATTESTER_PK, d);
        vm.expectRevert(bytes("blocklisted"));
        vault.release(id, sig, att);
        vm.warp(vault.getHold(id).releaseBy);
        vault.refund(id);
        assertEq(vault.totalHeld(), 0);
        assertEq(vault.freeBalance(), FUNDED);
    }

    // ---------- refund ----------

    function test_refund_byAStrangerBeforeReleaseByIsRefused() public {
        bytes32 id = _hold(50e6);
        vm.prank(stranger);
        vm.expectRevert(AgentVaultV2.HoldNotExpired.selector);
        vault.refund(id);
    }

    function test_refund_byTheOwnerBeforeReleaseByIsRefused() public {
        bytes32 id = _hold(50e6);
        vm.prank(owner);
        vm.expectRevert(AgentVaultV2.HoldNotExpired.selector);
        vault.refund(id);
    }

    function test_refund_byThePayeeAnytime() public {
        bytes32 id = _hold(50e6);
        vm.prank(merchant);
        vault.refund(id);
        assertEq(vault.totalHeld(), 0);
        assertEq(usdc.balanceOf(merchant), 0);
        assertEq(uint8(vault.getHold(id).status), uint8(AgentVaultV2.HoldStatus.Refunded));
    }

    function test_refund_byAnyoneAtReleaseBy() public {
        bytes32 id = _hold(50e6);
        vm.warp(vault.getHold(id).releaseBy);
        vm.expectEmit(true, true, false, true, address(vault));
        emit AgentVaultV2.HoldRefunded(id, stranger);
        vm.prank(stranger);
        vault.refund(id);
        assertEq(vault.freeBalance(), FUNDED);
        assertEq(usdc.balanceOf(address(vault)), FUNDED);
    }

    function test_refund_doesNotRestoreTheWindow() public {
        bytes32 id = _hold(100e6);
        vm.prank(merchant);
        vault.refund(id);
        assertEq(vault.getSession(agent).curSpent, 100e6);
    }

    function test_refund_thenReleaseIsRefused() public {
        bytes32 id = _hold(50e6);
        vm.prank(merchant);
        vault.refund(id);
        bytes32 d = _releaseDigest(id);
        bytes memory sig = _ecdsa(AGENT_PK, d);
        bytes memory att = _attest(ATTESTER_PK, d);
        vm.expectRevert(AgentVaultV2.HoldNotOpen.selector);
        vault.release(id, sig, att);
    }

    function test_release_thenRefundIsRefused() public {
        bytes32 id = _hold(50e6);
        _release(id);
        vm.warp(block.timestamp + 8 days);
        vm.expectRevert(AgentVaultV2.HoldNotOpen.selector);
        vault.refund(id);
    }

    function test_refund_unknownHoldReverts() public {
        vm.expectRevert(AgentVaultV2.HoldNotOpen.selector);
        vault.refund(keccak256("nope"));
    }

    // ---------- held funds are out of reach ----------

    function test_withdraw_cannotTouchHeldFunds() public {
        _hold(100e6);
        vm.prank(owner);
        vm.expectRevert(AgentVaultV2.InsufficientFreeBalance.selector);
        vault.withdraw(owner, FUNDED);
        vm.prank(owner);
        vault.withdraw(owner, FUNDED - 100e6);
        assertEq(usdc.balanceOf(address(vault)), 100e6);
        assertEq(vault.freeBalance(), 0);
    }

    function test_spend_cannotUseHeldFunds() public {
        _hold(100e6);
        vm.prank(owner);
        vault.withdraw(owner, FUNDED - 100e6 - 5e6); // 5 USDC free, 100 held
        uint64 nonce = vault.getSession(agent).nonce;
        uint64 deadline = uint64(block.timestamp + 300);
        bytes32 d = keccak256(
            abi.encodePacked(
                "\x19\x01",
                _domain(),
                keccak256(abi.encode(SPEND_TYPEHASH, agent, merchant, 6e6, nonce, deadline, bytes32(0)))
            )
        );
        vm.expectRevert(AgentVaultV2.InsufficientFreeBalance.selector);
        vault.spend(AgentVaultCore.SpendRequest(agent, merchant, 6e6, deadline, bytes32(0), _ecdsa(AGENT_PK, d), "", ""));
    }
}
