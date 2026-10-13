// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// 6-decimal ERC-20 standing in for Arc's USDC interface (0x3600…) in unit tests.
contract MockUSDC {
    mapping(address => uint256) public balanceOf;
    mapping(address => bool) public blocked;

    function decimals() external pure returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    /// Mimics Arc's runtime blocklist: transfers to/from a blocked address revert.
    function setBlocked(address who, bool b) external {
        blocked[who] = b;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        require(!blocked[msg.sender] && !blocked[to], "blocklisted");
        require(to != address(0), "Zero address not allowed");
        require(balanceOf[msg.sender] >= amount, "balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        return true;
    }
}

/// Stands in for the SLH-DSA precompile in unit tests. A "signature" is valid iff it equals
/// fakeSign(vk, message). Real SLH-DSA verification is exercised against the live Arc node
/// (see script/pq-integration).
contract MockPQ {
    function fakeSign(bytes memory vk, bytes memory message) public pure returns (bytes memory) {
        return abi.encodePacked(keccak256(abi.encode("mock-slh", vk, message)));
    }

    function verifySlhDsaSha2128s(bytes memory vk, bytes memory message, bytes memory sig)
        external
        pure
        returns (bool)
    {
        require(vk.length == 32, "Invalid verifying key length");
        return keccak256(sig) == keccak256(fakeSign(vk, message));
    }
}

/// Minimal ERC-8004 IdentityRegistry stand-in: ownerOf reverts for unknown ids (ERC-721 semantics).
contract MockIdentity {
    mapping(uint256 => address) internal owners;

    function register(uint256 agentId, address owner) external {
        owners[agentId] = owner;
    }

    function ownerOf(uint256 agentId) external view returns (address) {
        address o = owners[agentId];
        require(o != address(0), "ERC721NonexistentToken");
        return o;
    }
}
