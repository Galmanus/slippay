// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {AgentVaultV2} from "../src/AgentVaultV2.sol";

/// AgentVaultV2 (pay-on-delivery holds) — Arc TESTNET only until it has an outside audit.
/// PRIVATE_KEY=$(cat ~/.slippay/arc-testnet-deployer.key) \
///   forge script script/DeployV2.s.sol --rpc-url https://rpc.testnet.arc.io --broadcast --with-gas-price 25gwei
/// env: PRIVATE_KEY (required, read from env so it never appears in argv), VAULT_OWNER (default:
/// the deployer), MAX_ABS_PER_TX (default 1,000 USDC).
/// Arc drops txs with maxFeePerGas < 20 gwei silently, hence the explicit gas price.
contract DeployAgentVaultV2 is Script {
    address constant USDC = 0x3600000000000000000000000000000000000000;
    address constant IDENTITY_TESTNET = 0x8004A818BFB912233c491871b3d84c89A494BD9e;

    function run() external returns (AgentVaultV2 vault) {
        require(block.chainid == 5042002, "AgentVaultV2: Arc testnet only");
        uint256 pk = vm.envUint("PRIVATE_KEY");
        address owner = vm.envOr("VAULT_OWNER", vm.addr(pk));
        uint256 maxAbs = vm.envOr("MAX_ABS_PER_TX", uint256(1_000e6));

        vm.startBroadcast(pk);
        vault = new AgentVaultV2(owner, USDC, IDENTITY_TESTNET, maxAbs);
        vm.stopBroadcast();

        console2.log("AgentVaultV2", address(vault));
        console2.log("owner", owner);
        console2.log("maxAbsolutePerTx", maxAbs);
    }
}
