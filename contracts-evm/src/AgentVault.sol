// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IArcPQ} from "./interfaces/IArcPQ.sol";
import {IERC20Min} from "./interfaces/IERC20Min.sol";
import {IIdentityRegistry} from "./interfaces/IIdentityRegistry.sol";

/// @title AgentVault — bounded, revocable USDC spending for AI agents on Arc
/// @notice The owner funds the vault and installs agent sessions. An agent spends by signing an
///         EIP-712 intent; anyone may relay it (gas is paid in USDC by the relayer). Limits are
///         enforced here, not by the agent: per-tx cap, sliding-window cap (hard ceiling
///         2 * windowCap over any real window), recipient allowlist, expiry, revocation.
///         Spends above a session's `pqThreshold` additionally require an SLH-DSA-SHA2-128s
///         signature over the same digest (hybrid classical + post-quantum), verified by Arc's
///         PQ precompile. Port of the Soroban `install_agent_session` semantics
///         (contracts/smart-wallet/src/lib.rs).
contract AgentVault {
    struct SessionConfig {
        uint256 agentId;
        bytes32 slhVk;
        uint128 perTxCap;
        uint128 windowCap;
        uint64 windowSeconds;
        uint64 expiresAt;
        uint128 pqThreshold;
        bytes32 policyHash;
        address[] allowRecipients;
    }

    struct Session {
        uint256 agentId;
        bytes32 slhVk;
        bytes32 policyHash;
        uint128 perTxCap;
        uint128 windowCap;
        uint128 pqThreshold;
        uint128 curSpent;
        uint128 prevSpent;
        uint64 windowSeconds;
        uint64 expiresAt;
        uint64 epochStart;
        uint64 nonce;
        bool revoked;
        bool exists;
    }

    error NotOwner();
    error InvalidConfig();
    error SessionExists();
    error ExceedsAbsoluteCeiling();
    error EmptyAllowlist();
    error RecipientNotAllowed();
    error UnknownAgent();
    error NoSession();
    error SessionIsRevoked();
    error SessionExpired();
    error Expired();
    error AmountExceedsCap();
    error WindowCapExceeded();
    error BadSignature();
    error BadPqSignature();
    error TransferFailed();

    event SessionInstalled(
        address indexed agentSigner,
        uint256 indexed agentId,
        bytes32 slhVk,
        uint128 perTxCap,
        uint64 windowSeconds,
        uint128 windowCap,
        uint64 expiresAt,
        uint128 pqThreshold,
        bytes32 policyHash
    );
    event SessionRevoked(address indexed agentSigner);
    event AgentSpend(
        address indexed agentSigner,
        uint256 indexed agentId,
        address indexed to,
        uint256 amount,
        bytes32 orderId,
        uint64 nonce,
        bool pq
    );
    event Withdrawn(address indexed to, uint256 amount);

    /// Arc PQ precompile (SLH-DSA-SHA2-128s verify), live on mainnet and testnet.
    address public constant PQ_PRECOMPILE = 0x1800000000000000000000000000000000000004;
    /// window_cap <= per_tx_cap * 100 (Soroban SECURITY_AUDIT A2.3).
    uint256 public constant MAX_WINDOW_MULTIPLIER = 100;
    uint64 public constant MIN_WINDOW_SECONDS = 60;

    bytes32 public constant SPEND_TYPEHASH = keccak256(
        "Spend(address agentSigner,address to,uint256 amount,uint64 nonce,uint64 deadline,bytes32 orderId)"
    );
    bytes32 private constant DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    bytes32 private constant NAME_HASH = keccak256("SlippayAgentVault");
    bytes32 private constant VERSION_HASH = keccak256("1");
    /// secp256k1n / 2 — reject malleable high-s signatures.
    uint256 private constant HALF_N = 0x7FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF5D576E7357A4501DDFE92F46681B20A0;

    address public immutable owner;
    IERC20Min public immutable usdc;
    IIdentityRegistry public immutable identity;
    /// Absolute ceiling on any single agent transfer (Soroban SECURITY_AUDIT C3). Immutable so a
    /// compromised owner key cannot delegate a single-transfer drain beyond it.
    uint256 public immutable maxAbsolutePerTx;

    mapping(address agentSigner => Session) internal sessions;
    mapping(address agentSigner => mapping(address to => bool)) internal allowed;

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    /// @param identity_ ERC-8004 IdentityRegistry, or address(0) to skip identity checks.
    constructor(address owner_, address usdc_, address identity_, uint256 maxAbsolutePerTx_) {
        if (owner_ == address(0) || usdc_ == address(0) || maxAbsolutePerTx_ == 0) revert InvalidConfig();
        owner = owner_;
        usdc = IERC20Min(usdc_);
        identity = IIdentityRegistry(identity_);
        maxAbsolutePerTx = maxAbsolutePerTx_;
    }

    /// Native USDC sends are deposits (Arc: native and ERC-20 USDC are one balance).
    receive() external payable {}

    // ------------------------------------------------------------------ owner

    function installSession(address agentSigner, SessionConfig calldata c) external onlyOwner {
        if (agentSigner == address(0)) revert InvalidConfig();
        // A session key is single-use: reinstalling would reset the spend accumulators and void
        // the 2 * windowCap exposure bound. Retire with revoke; delegate again with a fresh key.
        if (sessions[agentSigner].exists) revert SessionExists();

        if (c.perTxCap == 0 || c.windowCap < c.perTxCap) revert InvalidConfig();
        if (uint256(c.windowCap) > uint256(c.perTxCap) * MAX_WINDOW_MULTIPLIER) revert InvalidConfig();
        if (c.perTxCap > maxAbsolutePerTx) revert ExceedsAbsoluteCeiling();
        if (c.windowSeconds < MIN_WINDOW_SECONDS) revert InvalidConfig();
        if (c.expiresAt != 0 && c.expiresAt <= block.timestamp) revert InvalidConfig();
        if (c.pqThreshold != type(uint128).max && c.slhVk == bytes32(0)) revert InvalidConfig();
        if (c.allowRecipients.length == 0) revert EmptyAllowlist();

        if (address(identity) != address(0)) {
            try identity.ownerOf(c.agentId) returns (address agentOwner) {
                if (agentOwner == address(0)) revert UnknownAgent();
            } catch {
                revert UnknownAgent();
            }
        }

        for (uint256 i; i < c.allowRecipients.length; i++) {
            address r = c.allowRecipients[i];
            if (r == address(0) || r == owner || r == address(this)) revert RecipientNotAllowed();
            allowed[agentSigner][r] = true;
        }

        sessions[agentSigner] = Session({
            agentId: c.agentId,
            slhVk: c.slhVk,
            policyHash: c.policyHash,
            perTxCap: c.perTxCap,
            windowCap: c.windowCap,
            pqThreshold: c.pqThreshold,
            curSpent: 0,
            prevSpent: 0,
            windowSeconds: c.windowSeconds,
            expiresAt: c.expiresAt,
            epochStart: uint64(block.timestamp),
            nonce: 0,
            revoked: false,
            exists: true
        });

        emit SessionInstalled(
            agentSigner,
            c.agentId,
            c.slhVk,
            c.perTxCap,
            c.windowSeconds,
            c.windowCap,
            c.expiresAt,
            c.pqThreshold,
            c.policyHash
        );
    }

    function revokeSession(address agentSigner) external onlyOwner {
        Session storage s = sessions[agentSigner];
        if (!s.exists) revert NoSession();
        s.revoked = true;
        emit SessionRevoked(agentSigner);
    }

    function withdraw(address to, uint256 amount) external onlyOwner {
        _pay(to, amount);
        emit Withdrawn(to, amount);
    }

    // ------------------------------------------------------------------ agent

    /// @notice Execute an agent-signed spend. Callable by anyone (relayer pays gas).
    /// @param ecdsaSig 65-byte secp256k1 signature by `agentSigner` over spendDigest(...).
    /// @param slhSig   7856-byte SLH-DSA-SHA2-128s signature over the same digest; required only
    ///                 when amount > the session's pqThreshold, ignored otherwise.
    function spend(
        address agentSigner,
        address to,
        uint256 amount,
        uint64 deadline,
        bytes32 orderId,
        bytes calldata ecdsaSig,
        bytes calldata slhSig
    ) external {
        Session storage s = sessions[agentSigner];
        if (!s.exists) revert NoSession();
        if (s.revoked) revert SessionIsRevoked();
        if (s.expiresAt != 0 && block.timestamp >= s.expiresAt) revert SessionExpired();
        if (block.timestamp > deadline) revert Expired();
        if (amount == 0) revert InvalidConfig();
        if (amount > s.perTxCap) revert AmountExceedsCap();
        if (!allowed[agentSigner][to]) revert RecipientNotAllowed();

        uint64 nonce = s.nonce;
        bytes32 digest = spendDigest(agentSigner, to, amount, nonce, deadline, orderId);
        if (_recover(digest, ecdsaSig) != agentSigner) revert BadSignature();

        bool pq = amount > s.pqThreshold;
        if (pq && !_verifySlh(s.slhVk, digest, slhSig)) revert BadPqSignature();

        _consumeWindow(s, amount);
        s.nonce = nonce + 1;

        emit AgentSpend(agentSigner, s.agentId, to, amount, orderId, nonce, pq);
        _pay(to, amount);
    }

    // ------------------------------------------------------------------ views

    function spendDigest(
        address agentSigner,
        address to,
        uint256 amount,
        uint64 nonce,
        uint64 deadline,
        bytes32 orderId
    ) public view returns (bytes32) {
        bytes32 structHash = keccak256(abi.encode(SPEND_TYPEHASH, agentSigner, to, amount, nonce, deadline, orderId));
        return keccak256(abi.encodePacked("\x19\x01", domainSeparator(), structHash));
    }

    function domainSeparator() public view returns (bytes32) {
        return keccak256(abi.encode(DOMAIN_TYPEHASH, NAME_HASH, VERSION_HASH, block.chainid, address(this)));
    }

    function getSession(address agentSigner) external view returns (Session memory) {
        return sessions[agentSigner];
    }

    function isAllowedRecipient(address agentSigner, address to) external view returns (bool) {
        return allowed[agentSigner][to];
    }

    // ------------------------------------------------------------------ internal

    /// O(1) sliding-window counter, ported from the Soroban wallet (SECURITY_AUDIT A3 / N-A3):
    /// estimate = prevSpent * (W - elapsedInEpoch) / W + curSpent must stay <= windowCap, and the
    /// un-weighted prevSpent + curSpent + amount must stay <= 2 * windowCap, which bounds spend in
    /// any real W-length interval (it overlaps at most two adjacent epochs) to 2 * windowCap.
    function _consumeWindow(Session storage s, uint256 amount) internal {
        uint256 w = s.windowSeconds;
        uint256 elapsed = block.timestamp - s.epochStart;
        if (elapsed >= w) {
            s.prevSpent = elapsed < 2 * w ? s.curSpent : 0;
            s.curSpent = 0;
            s.epochStart = uint64(block.timestamp);
        }
        uint256 remaining = w - (block.timestamp - s.epochStart);
        uint256 weightedPrev = (uint256(s.prevSpent) * remaining) / w;
        if (weightedPrev + s.curSpent + amount > s.windowCap) revert WindowCapExceeded();
        if (uint256(s.prevSpent) + s.curSpent + amount > 2 * uint256(s.windowCap)) revert WindowCapExceeded();
        s.curSpent += uint128(amount); // amount <= perTxCap (uint128)
    }

    function _recover(bytes32 digest, bytes calldata sig) internal pure returns (address) {
        if (sig.length != 65) return address(0);
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := calldataload(sig.offset)
            s := calldataload(add(sig.offset, 32))
            v := byte(0, calldataload(add(sig.offset, 64)))
        }
        if (uint256(s) > HALF_N) return address(0);
        if (v != 27 && v != 28) return address(0);
        return ecrecover(digest, v, r, s);
    }

    function _verifySlh(bytes32 vk, bytes32 digest, bytes calldata sig) internal view returns (bool) {
        if (sig.length == 0) return false;
        (bool ok, bytes memory ret) = PQ_PRECOMPILE.staticcall(
            abi.encodeCall(IArcPQ.verifySlhDsaSha2128s, (abi.encodePacked(vk), abi.encodePacked(digest), sig))
        );
        return ok && ret.length == 32 && abi.decode(ret, (bool));
    }

    function _pay(address to, uint256 amount) internal {
        if (!usdc.transfer(to, amount)) revert TransferFailed();
    }
}
