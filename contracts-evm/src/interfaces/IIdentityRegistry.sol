// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// Subset of the ERC-8004 IdentityRegistry (ERC-721 based) used by AgentVault.
interface IIdentityRegistry {
    function ownerOf(uint256 agentId) external view returns (address);
}
