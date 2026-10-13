// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// Arc post-quantum precompile at 0x1800000000000000000000000000000000000004.
/// Interface per circlefin/arc-node contracts/src/pq/IPQ.sol (Zero6 hardfork):
/// vk 32 bytes, sig 7856 bytes, gas 230_000 + 6 per 32-byte word of message.
interface IArcPQ {
    function verifySlhDsaSha2128s(bytes memory vk, bytes memory message, bytes memory sig)
        external
        view
        returns (bool);
}
