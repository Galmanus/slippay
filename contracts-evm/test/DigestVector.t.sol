// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Test, console2} from "forge-std/Test.sol";
import {AgentVault} from "../src/AgentVault.sol";
import {AgentVaultV2} from "../src/AgentVaultV2.sol";

/// Cross-language vector: the TS SDK (packages/arc-agent) must produce this exact EIP-712 digest
/// for the same inputs. If either side changes the typed data, one of the two tests breaks.
contract DigestVectorTest is Test {
    address constant VAULT = 0x0000000000000000000000000000000000a6E57a;
    address constant TO = 0x000000000000000000000000000000000000bEEF;
    uint256 constant AGENT_PK = 0xA11CE;
    bytes32 constant EXPECTED = 0xf450939119bd18f8cbd5790121d3b1eb191e0bf0d97be1cb5d1e8a96ec37c9a8;
    /// keccak256(keccak256("SlippayAIA.arc.v1") || EXPECTED) — what the P-256 attester signs.
    bytes32 constant EXPECTED_AIA = 0xbf14908c0ed47b67620581006a48130915e3776e33c006d45552abce5d4a7254;

    function test_vector_arcTestnet() public {
        vm.chainId(5042002);
        deployCodeTo(
            "AgentVault.sol:AgentVault",
            abi.encode(address(0xB0B), 0x3600000000000000000000000000000000000000, address(0), 1_000e6),
            VAULT
        );
        bytes32 d = AgentVault(payable(VAULT)).spendDigest(
            vm.addr(AGENT_PK), TO, 12_345_678, 7, 1_900_000_000, keccak256("order-vector-1")
        );
        console2.log("agent", vm.addr(AGENT_PK));
        console2.logBytes32(d);
        assertEq(d, EXPECTED);
        assertEq(AgentVault(payable(VAULT)).attestationHash(d), EXPECTED_AIA);
    }

    /// The same vector through AgentVaultV2's hold and release digests (attester: arc.test.mjs).
    function test_vector_v2Holds_arcTestnet() public {
        vm.chainId(5042002);
        deployCodeTo(
            "AgentVaultV2.sol:AgentVaultV2",
            abi.encode(address(0xB0B), 0x3600000000000000000000000000000000000000, address(0), 1_000e6),
            VAULT
        );
        AgentVaultV2 v = AgentVaultV2(payable(VAULT));
        bytes32 holdId =
            v.holdDigest(vm.addr(AGENT_PK), TO, 12_345_678, 7, 1_900_000_000, 1_900_086_400, keccak256("order-vector-1"));
        bytes32 rel = v.releaseDigest(holdId);
        assertEq(holdId, 0xb04ffadd0f2b3c55ecbc57bfabbacc5a8dae773a01417acab27da981fedc1a5b);
        assertEq(v.attestationHash(holdId), 0x027548357c046d257924df42860857823f531c32016c13c223202f1c197227db);
        assertEq(rel, 0x8d6096d59dc1785da38620be71b09df28f78d33e6ce39da41fc217c3567d6568);
        assertEq(v.attestationHash(rel), 0x6b533e750f9d35ff1c963a497a064717a9bdf53db0dd3a45058420d1aeb47f16);
    }
}
