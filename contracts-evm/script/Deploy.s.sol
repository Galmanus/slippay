// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console2} from "forge-std/Script.sol";
import {AgentVault} from "../src/AgentVault.sol";

/// forge script script/Deploy.s.sol --rpc-url https://rpc.testnet.arc.io \
///   --private-key $(cat ~/.slippay/arc-testnet-deployer.key) --broadcast --with-gas-price 25gwei
/// env: VAULT_OWNER (required), MAX_ABS_PER_TX (default 1,000 USDC), ERC8004_IDENTITY (default per chain)
/// Arc drops txs with maxFeePerGas < 20 gwei silently, hence the explicit gas price.
contract DeployAgentVault is Script {
    address constant USDC = 0x3600000000000000000000000000000000000000; // same on mainnet and testnet
    address constant IDENTITY_MAINNET = 0x8004A169FB4a3325136EB29fA0ceB6D2e539a432;
    address constant IDENTITY_TESTNET = 0x8004A818BFB912233c491871b3d84c89A494BD9e;

    function run() external returns (AgentVault vault) {
        address owner = vm.envAddress("VAULT_OWNER");
        uint256 maxAbs = vm.envOr("MAX_ABS_PER_TX", uint256(1_000e6));
        address identity = vm.envOr("ERC8004_IDENTITY", defaultIdentity());
        require(block.chainid == 5042 || block.chainid == 5042002, "not Arc");

        vm.startBroadcast();
        vault = new AgentVault(owner, USDC, identity, maxAbs);
        vm.stopBroadcast();

        console2.log("AgentVault", address(vault));
        console2.log("owner", owner);
        console2.log("identity", identity);
        console2.log("maxAbsolutePerTx", maxAbs);
    }

    function defaultIdentity() public view returns (address) {
        if (block.chainid == 5042) return IDENTITY_MAINNET;
        if (block.chainid == 5042002) return IDENTITY_TESTNET;
        return address(0);
    }
}
