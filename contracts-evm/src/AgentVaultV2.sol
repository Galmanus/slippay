// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {AgentVault} from "./AgentVault.sol";

/// @title AgentVaultV2 — AgentVault plus pay-on-delivery holds
/// @notice An agent can pay into a hold instead of straight to the payee. The hold is authorized
///         exactly like a spend (agent ECDSA over an EIP-712 digest that binds every term, SLH-DSA
///         above pqThreshold, the integrity attester above attestThreshold, per-tx cap, window cap,
///         allowlisted payee) and the window is consumed when the hold is made. Held funds stay in
///         the vault, counted in `totalHeld`, out of reach of `spend` and `withdraw`.
///
///         release: before `releaseBy`, by the agent's signature over Release(holdId) (plus the
///         attester above attestThreshold) or by the owner. The payee is fixed at hold time, so a
///         compromised agent can at most pay an allowlisted payee early, never redirect. An
///         agent-signed release is refused once the session is revoked or expired; the owner can
///         still release.
///         refund: by anyone from `releaseBy` on, or by the payee at any time (waiving is always
///         safe). The owner cannot refund early: that would let the buyer cancel after delivery.
///         A refund returns the funds to the free balance; the window budget is not restored.
contract AgentVaultV2 is AgentVault {
    enum HoldStatus {
        None,
        Open,
        Released,
        Refunded
    }

    struct Hold {
        address agentSigner;
        address payee;
        uint128 amount;
        uint64 releaseBy;
        HoldStatus status;
    }

    struct HoldRequest {
        address agentSigner;
        address payee;
        uint256 amount;
        uint64 deadline;
        uint64 releaseBy;
        bytes32 orderId;
        bytes ecdsaSig;
        bytes slhSig;
        bytes attestation;
    }

    error InsufficientFreeBalance();
    error BadReleaseWindow();
    error HoldNotOpen();
    error HoldExpired();
    error HoldNotExpired();

    event HoldCreated(
        bytes32 indexed holdId,
        address indexed agentSigner,
        address indexed payee,
        uint256 amount,
        uint64 releaseBy,
        bytes32 orderId,
        uint64 nonce,
        bool attested
    );
    event HoldReleased(bytes32 indexed holdId, address indexed by);
    event HoldRefunded(bytes32 indexed holdId, address indexed by);

    bytes32 public constant HOLD_TYPEHASH = keccak256(
        "Hold(address agentSigner,address payee,uint256 amount,uint64 nonce,uint64 deadline,uint64 releaseBy,bytes32 orderId)"
    );
    bytes32 public constant RELEASE_TYPEHASH = keccak256("Release(bytes32 holdId)");
    /// Longest a hold may lock funds: bounds what a compromised agent can freeze.
    uint64 public constant MAX_HOLD_SECONDS = 30 days;

    mapping(bytes32 holdId => Hold) internal holds;
    uint256 public totalHeld;

    constructor(address owner_, address usdc_, address identity_, uint256 maxAbsolutePerTx_)
        AgentVault(owner_, usdc_, identity_, maxAbsolutePerTx_)
    {}

    // ------------------------------------------------------------------ holds

    /// @notice Pay `amount` into a hold for `payee`. Callable by anyone (relayer pays gas).
    function hold(HoldRequest calldata r) external returns (bytes32 holdId) {
        Session storage s = sessions[r.agentSigner];
        _checkTerms(s, r.agentSigner, r.payee, r.amount, r.deadline);
        if (r.releaseBy <= block.timestamp || r.releaseBy > block.timestamp + MAX_HOLD_SECONDS) {
            revert BadReleaseWindow();
        }
        uint64 nonce = s.nonce;
        holdId = holdDigest(r.agentSigner, r.payee, r.amount, nonce, r.deadline, r.releaseBy, r.orderId);
        (, bool attested) = _checkSignatures(s, r.agentSigner, holdId, r.amount, r.ecdsaSig, r.slhSig, r.attestation);
        if (r.amount > freeBalance()) revert InsufficientFreeBalance();

        _consumeWindow(s, r.amount);
        s.nonce = nonce + 1;
        holds[holdId] = Hold({
            agentSigner: r.agentSigner,
            payee: r.payee,
            amount: uint128(r.amount), // r.amount <= perTxCap (uint128)
            releaseBy: r.releaseBy,
            status: HoldStatus.Open
        });
        totalHeld += r.amount;
        emit HoldCreated(holdId, r.agentSigner, r.payee, r.amount, r.releaseBy, r.orderId, nonce, attested);
    }

    /// @notice Pay a hold to its payee: delivery confirmed. `ecdsaSig`/`attestation` are ignored
    ///         when the owner calls.
    function release(bytes32 holdId, bytes calldata ecdsaSig, bytes calldata attestation) external {
        Hold storage h = holds[holdId];
        if (h.status != HoldStatus.Open) revert HoldNotOpen();
        if (block.timestamp >= h.releaseBy) revert HoldExpired();
        if (msg.sender != owner) {
            Session storage s = sessions[h.agentSigner];
            if (s.revoked) revert SessionIsRevoked();
            if (s.expiresAt != 0 && block.timestamp >= s.expiresAt) revert SessionExpired();
            bytes32 d = releaseDigest(holdId);
            if (_recover(d, ecdsaSig) != h.agentSigner) revert BadSignature();
            if (h.amount > s.attestThreshold && !_verifyAttestation(s.attesterX, s.attesterY, d, attestation)) {
                revert BadAttestation();
            }
        }
        uint256 amount = h.amount;
        h.status = HoldStatus.Released;
        totalHeld -= amount;
        emit HoldReleased(holdId, msg.sender);
        if (!usdc.transfer(h.payee, amount)) revert TransferFailed();
    }

    /// @notice Return a hold to the vault's free balance: from `releaseBy` on by anyone, earlier
    ///         only by the payee.
    function refund(bytes32 holdId) external {
        Hold storage h = holds[holdId];
        if (h.status != HoldStatus.Open) revert HoldNotOpen();
        if (block.timestamp < h.releaseBy && msg.sender != h.payee) revert HoldNotExpired();
        h.status = HoldStatus.Refunded;
        totalHeld -= h.amount;
        emit HoldRefunded(holdId, msg.sender);
    }

    // ------------------------------------------------------------------ views

    function holdDigest(
        address agentSigner,
        address payee,
        uint256 amount,
        uint64 nonce,
        uint64 deadline,
        uint64 releaseBy,
        bytes32 orderId
    ) public view returns (bytes32) {
        bytes32 structHash =
            keccak256(abi.encode(HOLD_TYPEHASH, agentSigner, payee, amount, nonce, deadline, releaseBy, orderId));
        return keccak256(abi.encodePacked("\x19\x01", domainSeparator(), structHash));
    }

    function releaseDigest(bytes32 holdId) public view returns (bytes32) {
        return
            keccak256(abi.encodePacked("\x19\x01", domainSeparator(), keccak256(abi.encode(RELEASE_TYPEHASH, holdId))));
    }

    function getHold(bytes32 holdId) external view returns (Hold memory) {
        return holds[holdId];
    }

    /// The part of the vault's USDC that is not committed to an open hold.
    function freeBalance() public view returns (uint256) {
        uint256 b = usdc.balanceOf(address(this));
        return b > totalHeld ? b - totalHeld : 0;
    }

    // ------------------------------------------------------------------ internal

    /// spend and withdraw both pay through here: they may only move the free balance.
    function _pay(address to, uint256 amount) internal override {
        if (amount > freeBalance()) revert InsufficientFreeBalance();
        super._pay(to, amount);
    }
}
