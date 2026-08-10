// SYNC, dependency-light address format checks for render-time hard-blocks
// (e.g. disabling a Save button). The AUTHORITATIVE check — does the account
// exist / can it receive USDC — is the async adapter.checkReceiveAddress.
//
// Kept free of BOTH @solana/web3.js and @stellar/stellar-sdk on purpose: this
// module sits on the entry-chunk path (ChainProvider), and importing StrKey
// here used to pull the whole stellar-sdk (~1 MB min) into the initial bundle.
// The G-address check below reimplements StrKey.isValidEd25519PublicKey
// exactly: base32 decode, version byte 6<<3 ('G'), 32-byte payload,
// CRC16-XModem checksum (little-endian trailer).

import type { ChainId } from "./types.ts";

const SOLANA_ADDR = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

const B32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Decode(s: string): Uint8Array | null {
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of s) {
    const idx = B32.indexOf(ch);
    if (idx === -1) return null;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      out.push((value >> bits) & 0xff);
    }
  }
  // StrKey requires the leftover bits to be zero padding
  if ((value & ((1 << bits) - 1)) !== 0) return null;
  return new Uint8Array(out);
}

function crc16XModem(data: Uint8Array): number {
  let crc = 0;
  for (const byte of data) {
    crc ^= byte << 8;
    for (let i = 0; i < 8; i++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc;
}

export function chainId(): ChainId {
  return ((import.meta.env.VITE_CHAIN ?? "stellar").toLowerCase()) as ChainId;
}

export function isValidStellarAddress(addr: string): boolean {
  const s = addr.trim();
  if (s.length !== 56 || s[0] !== "G") return false;
  const decoded = base32Decode(s);
  if (!decoded || decoded.length !== 35) return false;
  if (decoded[0] !== 6 << 3) return false; // version byte for ed25519 public key
  const payload = decoded.subarray(0, 33);
  const checksum = decoded[33]! | (decoded[34]! << 8);
  return crc16XModem(payload) === checksum;
}

export function isValidSolanaAddress(addr: string): boolean {
  return SOLANA_ADDR.test(addr.trim());
}

/** Sync format check for the active chain. */
export function isValidAddress(addr: string): boolean {
  return chainId() === "solana" ? isValidSolanaAddress(addr) : isValidStellarAddress(addr);
}
