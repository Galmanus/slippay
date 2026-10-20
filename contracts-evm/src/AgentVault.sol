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
        /// P-256 public key of the integrity attester (AIA). Required when attestThreshold < max.
        bytes32 attesterX;
        bytes32 attesterY;
        /// Spends above this need a fresh attester signature. type(uint128).max = never.
        uint128 attestThreshold;
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
        bytes32 attesterX;
        bytes32 attesterY;
        uint128 attestThreshold;
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
    error BadAttestation();
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
        bool pq,
        bool attested
    );
    event AttesterBound(address indexed agentSigner, bytes32 attesterX, bytes32 attesterY, uint128 attestThreshold);
    event Withdrawn(address indexed to, uint256 amount);

    /// Arc PQ precompile (SLH-DSA-SHA2-128s verify), live on mainnet and testnet.
    address public constant PQ_PRECOMPILE = 0x1800000000000000000000000000000000000004;
    /// P-256 verify precompile (EIP-7951, Osaka) — used for integrity-attester signatures.
    address public constant P256_PRECOMPILE = 0x0000000000000000000000000000000000000100;
    /// Domain tag so an attester signature can only ever mean "this AgentVault spend is clean".
    bytes32 public constant AIA_DOMAIN = keccak256("SlippayAIA.arc.v1");
    /// window_cap <= per_tx_cap * 100 (Soroban SECURITY_AUDIT A2.3).
    uint256 public constant MAX_WINDOW_MULTIPLIER = 100;
    uint64 public constant MIN_WINDOW_SECONDS = 60;

    bytes32 public constant SPEND_TYPEHASH =
        keccak256("Spend(address agentSigner,address to,uint256 amount,uint64 nonce,uint64 deadline,bytes32 orderId)");
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
        bool gated = c.attestThreshold != type(uint128).max;
        if (gated && (c.attesterX == bytes32(0) || c.attesterY == bytes32(0))) revert InvalidConfig();
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
            exists: true,
            attesterX: c.attesterX,
            attesterY: c.attesterY,
            attestThreshold: c.attestThreshold
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
        if (gated) emit AttesterBound(agentSigner, c.attesterX, c.attesterY, c.attestThreshold);
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

    /// One agent-signed spend. ecdsaSig: 65-byte secp256k1 signature by agentSigner over
    /// spendDigest(...). slhSig: 7856-byte SLH-DSA-SHA2-128s signature over the same digest, required
    /// only when amount > pqThreshold. attestation: 64-byte P-256 (r,s) by the session's integrity
    /// attester over attestationHash(digest), required only when amount > attestThreshold.
    struct SpendRequest {
        address agentSigner;
        address to;
        uint256 amount;
        uint64 deadline;
        bytes32 orderId;
        bytes ecdsaSig;
        bytes slhSig;
        bytes attestation;
    }

    /// @notice Execute an agent-signed spend. Callable by anyone (relayer pays gas).
    function spend(SpendRequest calldata r) external {
        Session storage s = sessions[r.agentSigner];
        (uint64 nonce, bool pq, bool attested) = _authorize(s, r);
        _consumeWindow(s, r.amount);
        s.nonce = nonce + 1;
        emit AgentSpend(r.agentSigner, s.agentId, r.to, r.amount, r.orderId, nonce, pq, attested);
        _pay(r.to, r.amount);
    }

    function _authorize(Session storage s, SpendRequest calldata r)
        internal
        view
        returns (uint64 nonce, bool pq, bool attested)
    {
        _checkTerms(s, r.agentSigner, r.to, r.amount, r.deadline);
        nonce = s.nonce;
        bytes32 digest = spendDigest(r.agentSigner, r.to, r.amount, nonce, r.deadline, r.orderId);
        (pq, attested) = _checkSignatures(s, r.agentSigner, digest, r.amount, r.ecdsaSig, r.slhSig, r.attestation);
    }

    /// Session state and the request's terms: live session, fresh deadline, amount within the
    /// per-tx cap, recipient on the allowlist. Shared by every agent-authorized money movement.
    function _checkTerms(Session storage s, address agentSigner, address to, uint256 amount, uint64 deadline)
        internal
        view
    {
        if (!s.exists) revert NoSession();
        if (s.revoked) revert SessionIsRevoked();
        if (s.expiresAt != 0 && block.timestamp >= s.expiresAt) revert SessionExpired();
        if (block.timestamp > deadline) revert Expired();
        if (amount == 0) revert InvalidConfig();
        if (amount > s.perTxCap) revert AmountExceedsCap();
        if (!allowed[agentSigner][to]) revert RecipientNotAllowed();
    }

    /// The agent's ECDSA signature over `digest`, plus SLH-DSA above pqThreshold and the integrity
    /// attester's P-256 attestation above attestThreshold.
    function _checkSignatures(
        Session storage s,
        address agentSigner,
        bytes32 digest,
        uint256 amount,
        bytes calldata ecdsaSig,
        bytes calldata slhSig,
        bytes calldata attestation
    ) internal view returns (bool pq, bool attested) {
        if (_recover(digest, ecdsaSig) != agentSigner) revert BadSignature();
        pq = amount > s.pqThreshold;
        if (pq && !_verifySlh(s.slhVk, digest, slhSig)) revert BadPqSignature();
        attested = amount > s.attestThreshold;
        if (attested && !_verifyAttestation(s.attesterX, s.attesterY, digest, attestation)) revert BadAttestation();
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

    /// What the integrity attester signs (P-256) to clear one specific spend. The spend digest
    /// already binds vault, chain, recipient, amount, nonce and deadline, so an attestation is
    /// single-use and expires with the intent.
    function attestationHash(bytes32 digest) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(AIA_DOMAIN, digest));
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

    function _verifyAttestation(bytes32 x, bytes32 y, bytes32 digest, bytes calldata sig)
        internal
        view
        returns (bool)
    {
        if (sig.length != 64) return false;
        (bool ok, bytes memory ret) =
            P256_PRECOMPILE.staticcall(abi.encodePacked(attestationHash(digest), sig[0:32], sig[32:64], x, y));
        return ok && ret.length == 32 && uint256(bytes32(ret)) == 1;
    }

    function _pay(address to, uint256 amount) internal virtual {
        if (!usdc.transfer(to, amount)) revert TransferFailed();
    }
}
