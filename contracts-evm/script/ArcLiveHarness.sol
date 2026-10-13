// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {AgentVault} from "../src/AgentVault.sol";
import {IERC20Min} from "../src/interfaces/IERC20Min.sol";

/// Live-node harness. Never deployed: its runtime code is injected with an eth_call state override
/// so the whole AgentVault flow runs against Arc's REAL SLH-DSA precompile, native USDC and
/// ERC-8004 registry, without spending gas. The vault is CREATE2-deployed with a fixed salt so
/// `prepare` (digests to sign) and `run` (execution) see the same vault address.
contract ArcLiveHarness {
    address constant USDC = 0x3600000000000000000000000000000000000000;
    bytes32 constant SALT = keccak256("slippay-agentvault-live-check");
    bytes32 constant ORDER_SMALL = keccak256("order-small");
    bytes32 constant ORDER_BIG = keccak256("order-big");
    uint256 constant SMALL = 1e6; // 1 USDC, classical path
    uint256 constant BIG = 10e6; // 10 USDC, above pqThreshold -> hybrid path

    struct Result {
        address vault;
        uint256 vaultBalanceAfterNativeDeposit;
        uint256 merchantDelta;
        uint256 gasClassicalSpend;
        uint256 gasPqSpend;
        bool pqMissingRejected;
        bool pqTamperedRejected;
        bool pqValidAccepted;
        uint64 finalNonce;
    }

    function _deploy(address identity) internal returns (AgentVault) {
        return new AgentVault{salt: SALT}(address(this), USDC, identity, 1_000e6);
    }

    function prepare(address identity, address agentSigner, address merchant, uint64 deadline)
        external
        returns (address vault, bytes32 digestSmall, bytes32 digestBig)
    {
        AgentVault v = _deploy(identity);
        vault = address(v);
        digestSmall = v.spendDigest(agentSigner, merchant, SMALL, 0, deadline, ORDER_SMALL);
        digestBig = v.spendDigest(agentSigner, merchant, BIG, 1, deadline, ORDER_BIG);
    }

    struct RunInput {
        address identity;
        uint256 agentId;
        address agentSigner;
        bytes32 slhVk;
        address merchant;
        uint64 deadline;
        bytes ecdsaSmall;
        bytes ecdsaBig;
        bytes slhBig;
    }

    function run(RunInput calldata input) external returns (Result memory r) {
        AgentVault v = _deploy(input.identity);
        r.vault = address(v);

        // Native USDC send (18 decimals) must show up on the ERC-20 interface (6 decimals).
        (bool ok,) = payable(address(v)).call{value: 100 ether}("");
        require(ok, "native deposit failed");
        r.vaultBalanceAfterNativeDeposit = IERC20Min(USDC).balanceOf(address(v));

        _install(v, input);
        uint256 before = IERC20Min(USDC).balanceOf(input.merchant);

        uint256 g = gasleft();
        v.spend(AgentVault.SpendRequest(input.agentSigner, input.merchant, SMALL, input.deadline, ORDER_SMALL, input.ecdsaSmall, "", ""));
        r.gasClassicalSpend = g - gasleft();

        r.pqMissingRejected = _rejectedWithBadPq(v, input, "");
        bytes memory tampered = input.slhBig;
        tampered[100] = bytes1(uint8(tampered[100]) ^ 0x01);
        r.pqTamperedRejected = _rejectedWithBadPq(v, input, tampered);

        g = gasleft();
        try v.spend(AgentVault.SpendRequest(input.agentSigner, input.merchant, BIG, input.deadline, ORDER_BIG, input.ecdsaBig, input.slhBig, "")) {
            r.pqValidAccepted = true;
        } catch {}
        r.gasPqSpend = g - gasleft();

        r.merchantDelta = IERC20Min(USDC).balanceOf(input.merchant) - before;
        r.finalNonce = v.getSession(input.agentSigner).nonce;
    }

    function _install(AgentVault v, RunInput calldata input) internal {
        address[] memory allow = new address[](1);
        allow[0] = input.merchant;
        v.installSession(
            input.agentSigner,
            AgentVault.SessionConfig({
                agentId: input.agentId,
                slhVk: input.slhVk,
                perTxCap: 50e6,
                windowCap: 200e6,
                windowSeconds: 1 days,
                expiresAt: 0,
                pqThreshold: 5e6,
                policyHash: keccak256("live-check"),
                allowRecipients: allow,
                attesterX: bytes32(0),
                attesterY: bytes32(0),
                attestThreshold: type(uint128).max
            })
        );
    }

    function _rejectedWithBadPq(AgentVault v, RunInput calldata input, bytes memory slhSig)
        internal
        returns (bool)
    {
        try v.spend(AgentVault.SpendRequest(input.agentSigner, input.merchant, BIG, input.deadline, ORDER_BIG, input.ecdsaBig, slhSig, "")) {
            return false;
        } catch (bytes memory err) {
            return bytes4(err) == AgentVault.BadPqSignature.selector;
        }
    }
}
