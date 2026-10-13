// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test} from "forge-std/Test.sol";
import {AgentVault} from "../src/AgentVault.sol";
import {MockUSDC, MockPQ, MockIdentity} from "./mocks/Mocks.sol";

contract AgentVaultTest is Test {
    address constant PQ = 0x1800000000000000000000000000000000000004;
    bytes32 constant SPEND_TYPEHASH = keccak256(
        "Spend(address agentSigner,address to,uint256 amount,uint64 nonce,uint64 deadline,bytes32 orderId)"
    );

    AgentVault vault;
    MockUSDC usdc;
    MockPQ pq;
    MockIdentity identity;

    address owner = makeAddr("owner");
    address merchant = makeAddr("merchant");
    address stranger = makeAddr("stranger");
    uint256 agentPk = 0xA11CE;
    address agent;
    bytes32 slhVk = keccak256("agent-slh-vk");
    uint256 constant AGENT_ID = 42;
    uint256 constant MAX_ABS = 1_000e6; // 1,000 USDC absolute per-tx ceiling

    function setUp() public {
        vm.warp(1_800_000_000);
        agent = vm.addr(agentPk);
        usdc = new MockUSDC();
        identity = new MockIdentity();
        identity.register(AGENT_ID, makeAddr("agentOperator"));
        vm.etch(PQ, address(new MockPQ()).code);
        pq = MockPQ(PQ);
        vault = new AgentVault(owner, address(usdc), address(identity), MAX_ABS);
        usdc.mint(address(vault), 10_000e6);
    }

    // ---------- helpers ----------

    function _cfg() internal view returns (AgentVault.SessionConfig memory c) {
        address[] memory allow = new address[](1);
        allow[0] = merchant;
        c = AgentVault.SessionConfig({
            agentId: AGENT_ID,
            slhVk: slhVk,
            perTxCap: 100e6,
            windowCap: 300e6,
            windowSeconds: 1 days,
            expiresAt: 0,
            pqThreshold: 50e6,
            policyHash: keccak256("policy.ssl"),
            allowRecipients: allow,
            attesterX: bytes32(0),
            attesterY: bytes32(0),
            attestThreshold: type(uint128).max
        });
    }

    function _install() internal {
        vm.prank(owner);
        vault.installSession(agent, _cfg());
    }

    function _digest(address to, uint256 amount, uint64 nonce, uint64 deadline, bytes32 orderId)
        internal
        view
        returns (bytes32)
    {
        bytes32 domain = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256("SlippayAgentVault"),
                keccak256("1"),
                block.chainid,
                address(vault)
            )
        );
        bytes32 structHash = keccak256(abi.encode(SPEND_TYPEHASH, agent, to, amount, nonce, deadline, orderId));
        return keccak256(abi.encodePacked("\x19\x01", domain, structHash));
    }

    function _ecdsa(uint256 pk, bytes32 digest) internal pure returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);
        return abi.encodePacked(r, s, v);
    }

    function _spend(uint256 amount, uint64 nonce, bool withPq) internal {
        uint64 deadline = uint64(block.timestamp + 300);
        bytes32 orderId = keccak256(abi.encode("order", nonce));
        bytes32 d = _digest(merchant, amount, nonce, deadline, orderId);
        bytes memory slh = withPq ? pq.fakeSign(abi.encodePacked(slhVk), abi.encodePacked(d)) : bytes("");
        vault.spend(AgentVault.SpendRequest(agent, merchant, amount, deadline, orderId, _ecdsa(agentPk, d), slh, ""));
    }

    // ---------- constructor ----------

    function test_constructor_storesConfig() public view {
        assertEq(vault.owner(), owner);
        assertEq(address(vault.usdc()), address(usdc));
        assertEq(address(vault.identity()), address(identity));
        assertEq(vault.maxAbsolutePerTx(), MAX_ABS);
    }

    function test_constructor_rejectsZeroOwner() public {
        vm.expectRevert(AgentVault.InvalidConfig.selector);
        new AgentVault(address(0), address(usdc), address(identity), MAX_ABS);
    }

    function test_constructor_rejectsZeroCeiling() public {
        vm.expectRevert(AgentVault.InvalidConfig.selector);
        new AgentVault(owner, address(usdc), address(identity), 0);
    }

    // ---------- installSession ----------

    function test_install_onlyOwner() public {
        vm.prank(stranger);
        vm.expectRevert(AgentVault.NotOwner.selector);
        vault.installSession(agent, _cfg());
    }

    function test_install_storesSessionAndAllowlist() public {
        vm.expectEmit(true, true, false, true, address(vault));
        emit AgentVault.SessionInstalled(
            agent, AGENT_ID, slhVk, 100e6, 1 days, 300e6, 0, 50e6, keccak256("policy.ssl")
        );
        _install();
        AgentVault.Session memory s = vault.getSession(agent);
        assertTrue(s.exists);
        assertEq(s.agentId, AGENT_ID);
        assertEq(s.slhVk, slhVk);
        assertEq(s.perTxCap, 100e6);
        assertEq(s.windowCap, 300e6);
        assertEq(s.pqThreshold, 50e6);
        assertEq(s.epochStart, block.timestamp);
        assertTrue(vault.isAllowedRecipient(agent, merchant));
        assertFalse(vault.isAllowedRecipient(agent, stranger));
    }

    function test_install_rejectsReinstallOverExistingKey() public {
        _install();
        vm.prank(owner);
        vault.revokeSession(agent);
        vm.prank(owner);
        vm.expectRevert(AgentVault.SessionExists.selector);
        vault.installSession(agent, _cfg());
    }

    function test_install_rejectsZeroPerTxCap() public {
        AgentVault.SessionConfig memory c = _cfg();
        c.perTxCap = 0;
        _expectInstallRevert(c, AgentVault.InvalidConfig.selector);
    }

    function test_install_rejectsWindowBelowPerTx() public {
        AgentVault.SessionConfig memory c = _cfg();
        c.windowCap = c.perTxCap - 1;
        _expectInstallRevert(c, AgentVault.InvalidConfig.selector);
    }

    function test_install_rejectsWindowAbove100xPerTx() public {
        AgentVault.SessionConfig memory c = _cfg();
        c.perTxCap = 1e6;
        c.windowCap = 100e6 + 1;
        _expectInstallRevert(c, AgentVault.InvalidConfig.selector);
    }

    function test_install_rejectsPerTxAboveAbsoluteCeiling() public {
        AgentVault.SessionConfig memory c = _cfg();
        c.perTxCap = uint128(MAX_ABS + 1);
        c.windowCap = uint128(MAX_ABS + 1);
        _expectInstallRevert(c, AgentVault.ExceedsAbsoluteCeiling.selector);
    }

    function test_install_rejectsShortWindow() public {
        AgentVault.SessionConfig memory c = _cfg();
        c.windowSeconds = 59;
        _expectInstallRevert(c, AgentVault.InvalidConfig.selector);
    }

    function test_install_rejectsPastExpiry() public {
        AgentVault.SessionConfig memory c = _cfg();
        c.expiresAt = uint64(block.timestamp);
        _expectInstallRevert(c, AgentVault.InvalidConfig.selector);
    }

    function test_install_rejectsEmptyAllowlist() public {
        AgentVault.SessionConfig memory c = _cfg();
        c.allowRecipients = new address[](0);
        _expectInstallRevert(c, AgentVault.EmptyAllowlist.selector);
    }

    function test_install_rejectsOwnerVaultOrZeroAsRecipient() public {
        address[3] memory bad = [owner, address(vault), address(0)];
        for (uint256 i; i < bad.length; i++) {
            AgentVault.SessionConfig memory c = _cfg();
            c.allowRecipients[0] = bad[i];
            _expectInstallRevert(c, AgentVault.RecipientNotAllowed.selector);
        }
    }

    function test_install_rejectsZeroAgentSigner() public {
        vm.prank(owner);
        vm.expectRevert(AgentVault.InvalidConfig.selector);
        vault.installSession(address(0), _cfg());
    }

    function test_install_rejectsMissingSlhKeyWhenPqUsed() public {
        AgentVault.SessionConfig memory c = _cfg();
        c.slhVk = bytes32(0);
        _expectInstallRevert(c, AgentVault.InvalidConfig.selector);
    }

    function test_install_allowsNoSlhKeyWhenPqDisabled() public {
        AgentVault.SessionConfig memory c = _cfg();
        c.slhVk = bytes32(0);
        c.pqThreshold = type(uint128).max;
        vm.prank(owner);
        vault.installSession(agent, c);
        assertTrue(vault.getSession(agent).exists);
    }

    function test_install_rejectsUnknownAgentIdentity() public {
        AgentVault.SessionConfig memory c = _cfg();
        c.agentId = 999;
        _expectInstallRevert(c, AgentVault.UnknownAgent.selector);
    }

    function _expectInstallRevert(AgentVault.SessionConfig memory c, bytes4 sel) internal {
        vm.prank(owner);
        vm.expectRevert(sel);
        vault.installSession(agent, c);
    }

    // ---------- digest ----------

    function test_spendDigest_isEip712() public view {
        bytes32 orderId = keccak256("o");
        assertEq(vault.spendDigest(agent, merchant, 7e6, 3, 1234, orderId), _digest(merchant, 7e6, 3, 1234, orderId));
    }

    // ---------- spend: classical path ----------

    function test_spend_classicalBelowThreshold_paysAndEmits() public {
        _install();
        uint64 deadline = uint64(block.timestamp + 300);
        bytes32 orderId = keccak256("order-1");
        bytes32 d = _digest(merchant, 20e6, 0, deadline, orderId);
        vm.expectEmit(true, true, true, true, address(vault));
        emit AgentVault.AgentSpend(agent, AGENT_ID, merchant, 20e6, orderId, 0, false, false);
        vm.prank(stranger); // anyone can relay
        vault.spend(AgentVault.SpendRequest(agent, merchant, 20e6, deadline, orderId, _ecdsa(agentPk, d), "", ""));
        assertEq(usdc.balanceOf(merchant), 20e6);
        assertEq(vault.getSession(agent).nonce, 1);
        assertEq(vault.getSession(agent).curSpent, 20e6);
    }

    function test_spend_rejectsWrongSigner() public {
        _install();
        uint64 deadline = uint64(block.timestamp + 300);
        bytes32 d = _digest(merchant, 20e6, 0, deadline, bytes32(0));
        vm.expectRevert(AgentVault.BadSignature.selector);
        vault.spend(AgentVault.SpendRequest(agent, merchant, 20e6, deadline, bytes32(0), _ecdsa(0xBAD, d), "", ""));
    }

    function test_spend_rejectsReplay() public {
        _install();
        uint64 deadline = uint64(block.timestamp + 300);
        bytes32 d = _digest(merchant, 20e6, 0, deadline, bytes32(0));
        bytes memory sig = _ecdsa(agentPk, d);
        vault.spend(AgentVault.SpendRequest(agent, merchant, 20e6, deadline, bytes32(0), sig, "", ""));
        vm.expectRevert(AgentVault.BadSignature.selector);
        vault.spend(AgentVault.SpendRequest(agent, merchant, 20e6, deadline, bytes32(0), sig, "", ""));
    }

    function test_spend_rejectsHighS() public {
        _install();
        uint64 deadline = uint64(block.timestamp + 300);
        bytes32 d = _digest(merchant, 20e6, 0, deadline, bytes32(0));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(agentPk, d);
        uint256 n = 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141;
        bytes memory malleated = abi.encodePacked(r, bytes32(n - uint256(s)), v == 27 ? uint8(28) : uint8(27));
        vm.expectRevert(AgentVault.BadSignature.selector);
        vault.spend(AgentVault.SpendRequest(agent, merchant, 20e6, deadline, bytes32(0), malleated, "", ""));
    }

    function test_spend_rejectsExpiredDeadline() public {
        _install();
        uint64 deadline = uint64(block.timestamp - 1);
        bytes32 d = _digest(merchant, 20e6, 0, deadline, bytes32(0));
        vm.expectRevert(AgentVault.Expired.selector);
        vault.spend(AgentVault.SpendRequest(agent, merchant, 20e6, deadline, bytes32(0), _ecdsa(agentPk, d), "", ""));
    }

    function test_spend_rejectsRecipientNotAllowlisted() public {
        _install();
        uint64 deadline = uint64(block.timestamp + 300);
        bytes32 d = _digest(stranger, 20e6, 0, deadline, bytes32(0));
        vm.expectRevert(AgentVault.RecipientNotAllowed.selector);
        vault.spend(AgentVault.SpendRequest(agent, stranger, 20e6, deadline, bytes32(0), _ecdsa(agentPk, d), "", ""));
    }

    function test_spend_rejectsAbovePerTxCap() public {
        _install();
        uint64 deadline = uint64(block.timestamp + 300);
        bytes32 d = _digest(merchant, 100e6 + 1, 0, deadline, bytes32(0));
        bytes memory slh = pq.fakeSign(abi.encodePacked(slhVk), abi.encodePacked(d));
        vm.expectRevert(AgentVault.AmountExceedsCap.selector);
        vault.spend(AgentVault.SpendRequest(agent, merchant, 100e6 + 1, deadline, bytes32(0), _ecdsa(agentPk, d), slh, ""));
    }

    function test_spend_rejectsZeroAmount() public {
        _install();
        uint64 deadline = uint64(block.timestamp + 300);
        bytes32 d = _digest(merchant, 0, 0, deadline, bytes32(0));
        vm.expectRevert(AgentVault.InvalidConfig.selector);
        vault.spend(AgentVault.SpendRequest(agent, merchant, 0, deadline, bytes32(0), _ecdsa(agentPk, d), "", ""));
    }

    function test_spend_rejectsUnknownSession() public {
        uint64 deadline = uint64(block.timestamp + 300);
        bytes32 d = _digest(merchant, 1e6, 0, deadline, bytes32(0));
        vm.expectRevert(AgentVault.NoSession.selector);
        vault.spend(AgentVault.SpendRequest(agent, merchant, 1e6, deadline, bytes32(0), _ecdsa(agentPk, d), "", ""));
    }

    function test_spend_rejectsRevoked() public {
        _install();
        vm.prank(owner);
        vault.revokeSession(agent);
        uint64 deadline = uint64(block.timestamp + 300);
        bytes32 d = _digest(merchant, 1e6, 0, deadline, bytes32(0));
        vm.expectRevert(AgentVault.SessionIsRevoked.selector);
        vault.spend(AgentVault.SpendRequest(agent, merchant, 1e6, deadline, bytes32(0), _ecdsa(agentPk, d), "", ""));
    }

    function test_spend_rejectsExpiredSession() public {
        AgentVault.SessionConfig memory c = _cfg();
        c.expiresAt = uint64(block.timestamp + 1 hours);
        vm.prank(owner);
        vault.installSession(agent, c);
        vm.warp(block.timestamp + 1 hours);
        uint64 deadline = uint64(block.timestamp + 300);
        bytes32 d = _digest(merchant, 1e6, 0, deadline, bytes32(0));
        vm.expectRevert(AgentVault.SessionExpired.selector);
        vault.spend(AgentVault.SpendRequest(agent, merchant, 1e6, deadline, bytes32(0), _ecdsa(agentPk, d), "", ""));
    }

    function test_spend_blocklistedRecipientReverts() public {
        _install();
        usdc.setBlocked(merchant, true);
        uint64 deadline = uint64(block.timestamp + 300);
        bytes32 d = _digest(merchant, 1e6, 0, deadline, bytes32(0));
        vm.expectRevert(bytes("blocklisted"));
        vault.spend(AgentVault.SpendRequest(agent, merchant, 1e6, deadline, bytes32(0), _ecdsa(agentPk, d), "", ""));
        assertEq(vault.getSession(agent).nonce, 0); // whole tx reverted, nonce not burned
    }

    // ---------- spend: post-quantum path ----------

    function test_spend_aboveThreshold_requiresPq() public {
        _install();
        uint64 deadline = uint64(block.timestamp + 300);
        bytes32 d = _digest(merchant, 60e6, 0, deadline, bytes32(0));
        vm.expectRevert(AgentVault.BadPqSignature.selector);
        vault.spend(AgentVault.SpendRequest(agent, merchant, 60e6, deadline, bytes32(0), _ecdsa(agentPk, d), "", ""));
    }

    function test_spend_aboveThreshold_rejectsWrongPq() public {
        _install();
        uint64 deadline = uint64(block.timestamp + 300);
        bytes32 d = _digest(merchant, 60e6, 0, deadline, bytes32(0));
        bytes memory wrong = pq.fakeSign(abi.encodePacked(slhVk), abi.encodePacked(keccak256("other")));
        vm.expectRevert(AgentVault.BadPqSignature.selector);
        vault.spend(AgentVault.SpendRequest(agent, merchant, 60e6, deadline, bytes32(0), _ecdsa(agentPk, d), wrong, ""));
    }

    function test_spend_aboveThreshold_hybridPasses() public {
        _install();
        uint64 deadline = uint64(block.timestamp + 300);
        bytes32 orderId = keccak256("big");
        bytes32 d = _digest(merchant, 60e6, 0, deadline, orderId);
        bytes memory slh = pq.fakeSign(abi.encodePacked(slhVk), abi.encodePacked(d));
        vm.expectEmit(true, true, true, true, address(vault));
        emit AgentVault.AgentSpend(agent, AGENT_ID, merchant, 60e6, orderId, 0, true, false);
        vault.spend(AgentVault.SpendRequest(agent, merchant, 60e6, deadline, orderId, _ecdsa(agentPk, d), slh, ""));
        assertEq(usdc.balanceOf(merchant), 60e6);
    }

    function test_spend_pqAloneIsNotEnough() public {
        _install();
        uint64 deadline = uint64(block.timestamp + 300);
        bytes32 d = _digest(merchant, 60e6, 0, deadline, bytes32(0));
        bytes memory slh = pq.fakeSign(abi.encodePacked(slhVk), abi.encodePacked(d));
        vm.expectRevert(AgentVault.BadSignature.selector);
        vault.spend(AgentVault.SpendRequest(agent, merchant, 60e6, deadline, bytes32(0), _ecdsa(0xBAD, d), slh, ""));
    }

    function test_spend_pqThresholdZero_everySpendIsPq() public {
        AgentVault.SessionConfig memory c = _cfg();
        c.pqThreshold = 0;
        vm.prank(owner);
        vault.installSession(agent, c);
        uint64 deadline = uint64(block.timestamp + 300);
        bytes32 d = _digest(merchant, 1, 0, deadline, bytes32(0));
        vm.expectRevert(AgentVault.BadPqSignature.selector);
        vault.spend(AgentVault.SpendRequest(agent, merchant, 1, deadline, bytes32(0), _ecdsa(agentPk, d), "", ""));
    }

    // ---------- spending window ----------

    function test_window_capsAggregateSpend() public {
        _install(); // perTx 100, window 300, pq above 50
        _spend(100e6, 0, true);
        _spend(100e6, 1, true);
        _spend(100e6, 2, true);
        uint64 deadline = uint64(block.timestamp + 300);
        bytes32 d = _digest(merchant, 1e6, 3, deadline, bytes32(0));
        vm.expectRevert(AgentVault.WindowCapExceeded.selector);
        vault.spend(AgentVault.SpendRequest(agent, merchant, 1e6, deadline, bytes32(0), _ecdsa(agentPk, d), "", ""));
    }

    function test_window_previousEpochDecaysLinearly() public {
        _install(); // window 300
        _spend(100e6, 0, true);
        _spend(100e6, 1, true); // epoch A: 200
        vm.warp(block.timestamp + 1 days);
        _spend(100e6, 2, true); // rolls (anchored now): prev=200 full weight + 100 = 300 ok
        vm.warp(block.timestamp + 12 hours); // half of epoch B elapsed -> prev weighs 100
        _spend(100e6, 3, true); // 100 + 100 + 100 = 300 ok
        uint64 deadline = uint64(block.timestamp + 300);
        bytes32 d = _digest(merchant, 1, 4, deadline, bytes32(0));
        vm.expectRevert(AgentVault.WindowCapExceeded.selector); // 300 + 0.000001 > 300
        vault.spend(AgentVault.SpendRequest(agent, merchant, 1, deadline, bytes32(0), _ecdsa(agentPk, d), "", ""));
    }

    function test_window_fullyDecaysAfterTwoWindows() public {
        _install();
        _spend(100e6, 0, true);
        _spend(100e6, 1, true);
        _spend(100e6, 2, true);
        vm.warp(block.timestamp + 2 days);
        _spend(100e6, 3, true);
        _spend(100e6, 4, true);
        _spend(100e6, 5, true);
        assertEq(vault.getSession(agent).prevSpent, 0);
        assertEq(vault.getSession(agent).curSpent, 300e6);
    }

    /// The un-weighted 2 * windowCap ceiling is defense-in-depth: unreachable from consistent state
    /// (the weighted check already bounds it — mutation M2 survives the fuzz), so exercise it by
    /// corrupting prevSpent above windowCap and spending when its weight has decayed to ~0.
    function test_window_hardCeiling_holdsEvenIfAccumulatorCorrupted() public {
        _install(); // windowCap 300, W = 1 day
        bytes32 base = keccak256(abi.encode(agent, uint256(0))); // sessions mapping at slot 0
        bytes32 slot5 = bytes32(uint256(base) + 5); // prevSpent(low128) | windowSeconds | expiresAt
        uint256 word = uint256(vm.load(address(vault), slot5));
        word = (word & ~uint256(type(uint128).max)) | 600e6; // prevSpent = 2 * windowCap
        vm.store(address(vault), slot5, bytes32(word));
        assertEq(vault.getSession(agent).prevSpent, 600e6);
        assertEq(vault.getSession(agent).windowSeconds, 1 days); // neighbours intact
        vm.warp(block.timestamp + 1 days - 60); // weighted prev ~0.42 USDC
        uint64 deadline = uint64(block.timestamp + 300);
        bytes32 d = _digest(merchant, 10e6, 0, deadline, bytes32(0));
        vm.expectRevert(AgentVault.WindowCapExceeded.selector); // 600 + 0 + 10 > 2 * 300
        vault.spend(AgentVault.SpendRequest(agent, merchant, 10e6, deadline, bytes32(0), _ecdsa(agentPk, d), "", ""));
    }

    /// Property (N-A3 port): whatever the timing and amounts, spend inside ANY real
    /// windowSeconds-length interval stays <= 2 * windowCap.
    function testFuzz_window_anyRealIntervalBoundedByTwiceCap(uint32[12] memory dts, uint32[12] memory amts)
        public
    {
        _install(); // perTx 100, window 300, W = 1 day
        uint256[12] memory ts;
        uint256[12] memory paid;
        uint256 k;
        uint64 nonce;
        for (uint256 i; i < 12; i++) {
            vm.warp(block.timestamp + (uint256(dts[i]) % 1 days));
            uint256 amount = 1 + (uint256(amts[i]) % 100e6);
            uint64 deadline = uint64(block.timestamp + 300);
            bytes32 d = _digest(merchant, amount, nonce, deadline, bytes32(0));
            bytes memory slh = pq.fakeSign(abi.encodePacked(slhVk), abi.encodePacked(d));
            try vault.spend(AgentVault.SpendRequest(agent, merchant, amount, deadline, bytes32(0), _ecdsa(agentPk, d), slh, "")) {
                ts[k] = block.timestamp;
                paid[k] = amount;
                k++;
                nonce++;
            } catch {}
        }
        for (uint256 i; i < k; i++) {
            uint256 sum;
            for (uint256 j = i; j < k && ts[j] < ts[i] + 1 days; j++) {
                sum += paid[j];
            }
            assertLe(sum, 2 * 300e6);
        }
    }

    // ---------- integrity attester (AIA, P-256) ----------

    uint256 constant ATTESTER_PK = 0xA77E5;

    function _cfgAttested() internal view returns (AgentVault.SessionConfig memory c) {
        c = _cfg();
        (uint256 x, uint256 y) = vm.publicKeyP256(ATTESTER_PK);
        c.attesterX = bytes32(x);
        c.attesterY = bytes32(y);
        c.attestThreshold = 10e6; // spends above 10 USDC need a fresh attestation
    }

    function _aiaHash(bytes32 digest) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(keccak256("SlippayAIA.arc.v1"), digest));
    }

    function _attest(uint256 pk, bytes32 digest) internal pure returns (bytes memory) {
        (bytes32 r, bytes32 s) = vm.signP256(pk, _aiaHash(digest));
        return abi.encodePacked(r, s);
    }

    function _spendAttested(uint256 amount, bytes memory attestation) internal {
        uint64 deadline = uint64(block.timestamp + 300);
        bytes32 d = _digest(merchant, amount, 0, deadline, keccak256("aia"));
        vault.spend(
            AgentVault.SpendRequest(agent, merchant, amount, deadline, keccak256("aia"), _ecdsa(agentPk, d), "", attestation)
        );
    }

    function test_attestationHash_isDomainSeparatedDigest() public view {
        bytes32 d = keccak256("some spend digest");
        assertEq(vault.attestationHash(d), _aiaHash(d));
    }

    function test_install_rejectsGateWithoutAttesterKey() public {
        AgentVault.SessionConfig memory c = _cfgAttested();
        c.attesterX = bytes32(0);
        _expectInstallRevert(c, AgentVault.InvalidConfig.selector);
    }

    function test_install_emitsAttesterBound() public {
        AgentVault.SessionConfig memory c = _cfgAttested();
        vm.expectEmit(true, false, false, true, address(vault));
        emit AgentVault.AttesterBound(agent, c.attesterX, c.attesterY, 10e6);
        vm.prank(owner);
        vault.installSession(agent, c);
    }

    function test_attest_requiredAboveThreshold() public {
        vm.prank(owner);
        vault.installSession(agent, _cfgAttested());
        vm.expectRevert(AgentVault.BadAttestation.selector);
        _spendAttested(20e6, "");
    }

    function test_attest_rejectsSignatureOverAnotherSpend() public {
        vm.prank(owner);
        vault.installSession(agent, _cfgAttested());
        bytes memory other = _attest(ATTESTER_PK, keccak256("a different spend"));
        vm.expectRevert(AgentVault.BadAttestation.selector);
        _spendAttested(20e6, other);
    }

    function test_attest_rejectsSignatureFromAnotherKey() public {
        vm.prank(owner);
        vault.installSession(agent, _cfgAttested());
        uint64 deadline = uint64(block.timestamp + 300);
        bytes32 d = _digest(merchant, 20e6, 0, deadline, keccak256("aia"));
        vm.expectRevert(AgentVault.BadAttestation.selector);
        _spendAttested(20e6, _attest(0xBAD5, d));
    }

    function test_attest_rejectsMalformedLength() public {
        vm.prank(owner);
        vault.installSession(agent, _cfgAttested());
        vm.expectRevert(AgentVault.BadAttestation.selector);
        _spendAttested(20e6, hex"1234");
    }

    function test_attest_validAttestationSettlesAndIsFlagged() public {
        vm.prank(owner);
        vault.installSession(agent, _cfgAttested());
        uint64 deadline = uint64(block.timestamp + 300);
        bytes32 d = _digest(merchant, 20e6, 0, deadline, keccak256("aia"));
        vm.expectEmit(true, true, true, true, address(vault));
        emit AgentVault.AgentSpend(agent, AGENT_ID, merchant, 20e6, keccak256("aia"), 0, false, true);
        _spendAttested(20e6, _attest(ATTESTER_PK, d));
        assertEq(usdc.balanceOf(merchant), 20e6);
    }

    function test_attest_notNeededAtOrBelowThreshold() public {
        vm.prank(owner);
        vault.installSession(agent, _cfgAttested());
        _spendAttested(10e6, "");
        assertEq(usdc.balanceOf(merchant), 10e6);
    }

    // ---------- owner ops ----------

    function test_revoke_onlyOwner() public {
        _install();
        vm.prank(stranger);
        vm.expectRevert(AgentVault.NotOwner.selector);
        vault.revokeSession(agent);
    }

    function test_revoke_unknownSessionReverts() public {
        vm.prank(owner);
        vm.expectRevert(AgentVault.NoSession.selector);
        vault.revokeSession(agent);
    }

    function test_withdraw_ownerOnly() public {
        vm.prank(stranger);
        vm.expectRevert(AgentVault.NotOwner.selector);
        vault.withdraw(stranger, 1e6);
        vm.prank(owner);
        vault.withdraw(owner, 1_000e6);
        assertEq(usdc.balanceOf(owner), 1_000e6);
    }
}
