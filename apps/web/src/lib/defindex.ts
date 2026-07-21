// DeFindex yield-vault client for Slippay's USDC savings ("cofre de dólar").
//
// TALKS TO THE VAULT CONTRACT DIRECTLY OVER SOROBAN RPC — no api.defindex.io
// dependency. The DeFindex REST API requires an API key (403 without one) and
// would put a third-party service on the critical path of deposits/withdraws;
// the vault interface is small enough to invoke directly (proven end-to-end in
// scripts/e2e-cofrinho-defindex-testnet.mjs, 20/07/2026).
//
// Non-custodial by construction: builders return UNSIGNED transaction XDR.
// Signing stays client-side (lib/wallet.ts signTx for browser wallets,
// lib/cofrinho.ts for passkey accounts).
//
// Units: USDC on Stellar has 7 decimals (1 USDC = 10_000_000 stroops).
// usdcToStroops/stroopsToUsdc are the only bridge between human strings and
// raw integers and are unit-tested — never multiply a float by 1e7 inline.

import {
  Account, Address, BASE_FEE, Networks, Operation, rpc, TransactionBuilder,
  nativeToScVal, scValToNative, xdr,
} from "@stellar/stellar-sdk";

const DECIMALS = 7;
const ONE_USDC = 10_000_000;

/** Human USDC decimal string -> raw integer stroops. Throws on anything that
 *  could silently move the wrong amount (bad format, >7 decimals, <= 0). */
export function usdcToStroops(human: string): number {
  const s = String(human).trim();
  if (!/^\d+(\.\d{1,7})?$/.test(s)) {
    throw new Error(`invalid USDC amount: "${human}"`);
  }
  const [int, frac = ""] = s.split(".");
  const fracPadded = frac.padEnd(DECIMALS, "0");
  // Integer arithmetic only — no float multiplication.
  const stroops = Number(int) * ONE_USDC + Number(fracPadded);
  if (stroops <= 0) throw new Error("amount must be greater than 0");
  if (!Number.isSafeInteger(stroops)) throw new Error("amount too large");
  return stroops;
}

/** Raw integer stroops -> trimmed human USDC decimal string. */
export function stroopsToUsdc(raw: number): string {
  if (!Number.isFinite(raw)) throw new Error("invalid stroops value");
  const neg = raw < 0;
  const v = Math.abs(Math.trunc(raw));
  const int = Math.floor(v / ONE_USDC);
  const frac = v % ONE_USDC;
  let out = String(int);
  if (frac > 0) {
    out += "." + String(frac).padStart(DECIMALS, "0").replace(/0+$/, "");
  }
  return neg ? "-" + out : out;
}

// ---- RPC wiring ----

const NETWORK = ((import.meta.env.VITE_STELLAR_NETWORK ?? "TESTNET") as string).toUpperCase();
const PASSPHRASE = NETWORK === "PUBLIC" ? Networks.PUBLIC : Networks.TESTNET;
const RPC_URL = NETWORK === "PUBLIC"
  ? "https://soroban-rpc.mainnet.stellar.gateway.fm"
  : "https://soroban-testnet.stellar.org";

function server(): rpc.Server {
  return new rpc.Server(RPC_URL, { allowHttp: false });
}

/** The USDC vault to use. Pinned via env per network so mainnet is never an
 *  accidental default — the vault's config (asset, manager, fees) must be
 *  verified on-chain before any mainnet address is set here. */
export function vaultId(): string {
  const v = import.meta.env.VITE_DEFINDEX_USDC_VAULT as string | undefined;
  if (!v) throw new Error("VITE_DEFINDEX_USDC_VAULT not set");
  return v;
}

const i128 = (n: number | bigint | string) => nativeToScVal(BigInt(n), { type: "i128" });
const vecI128 = (ns: Array<number | bigint | string>) => xdr.ScVal.scvVec(ns.map(i128));
const scAddr = (a: string) => new Address(a).toScVal();

/** Read-only vault call via simulation (no account, no key, no fee). */
async function view<T>(fn: string, args: xdr.ScVal[] = []): Promise<T> {
  const src = new Account("GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF5W", "0");
  const tx = new TransactionBuilder(src, { fee: "100", networkPassphrase: PASSPHRASE })
    .addOperation(Operation.invokeContractFunction({ contract: vaultId(), function: fn, args }))
    .setTimeout(60).build();
  const sim = await server().simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim) || !sim.result) throw new Error(`vault ${fn} failed`);
  return scValToNative(sim.result.retval) as T;
}

/** Op args for `deposit(amounts_desired, amounts_min, from, invest)`. */
export function depositArgs(caller: string, usdcAmount: string): xdr.ScVal[] {
  const amt = usdcToStroops(usdcAmount);
  return [vecI128([amt]), vecI128([amt]), scAddr(caller), nativeToScVal(true)];
}

/** Op args for `withdraw(withdraw_shares, min_amounts_out, from)`. Converts the
 *  human USDC amount to shares proportionally to the caller's own position
 *  (full-amount requests withdraw every share, so nothing is stranded by
 *  rounding). slippageBps guards the unwind from the strategy. */
export async function withdrawArgs(
  caller: string,
  usdcAmount: string,
  slippageBps = 50,
): Promise<xdr.ScVal[]> {
  const amt = BigInt(usdcToStroops(usdcAmount));
  const shares = BigInt(await view<bigint>("balance", [scAddr(caller)]));
  if (shares <= 0n) throw new Error("nada guardado no cofre ainda");
  const values = await view<bigint[]>("get_asset_amounts_per_shares", [i128(shares)]);
  const value = BigInt(values[0] ?? 0n);
  if (value <= 0n) throw new Error("cofre sem valor para sacar");
  // ceil(amt * shares / value), capped at the full position.
  let need = (amt * shares + value - 1n) / value;
  if (need > shares) need = shares;
  const minOut = (amt * BigInt(10_000 - slippageBps)) / 10_000n;
  return [i128(need), vecI128([minOut]), scAddr(caller)];
}

/** Build an unsigned tx XDR invoking the vault as a plain (browser-wallet)
 *  account: source = caller, auth = source credentials, footprint from
 *  simulation. Sign with lib/wallet.ts signTx and submit. */
async function buildVaultTx(caller: string, fn: string, args: xdr.ScVal[]): Promise<string> {
  const s = server();
  const src = await s.getAccount(caller);
  const tx = new TransactionBuilder(src, {
    fee: String(Number(BASE_FEE) * 1000),
    networkPassphrase: PASSPHRASE,
  })
    .addOperation(Operation.invokeContractFunction({ contract: vaultId(), function: fn, args }))
    .setTimeout(120).build();
  const sim = await s.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) throw new Error("Não deu pra confirmar. Tente de novo.");
  return rpc.assembleTransaction(tx, sim).build().toXDR();
}

/** Build an unsigned deposit XDR (auto-invests into the strategy). */
export async function buildDepositTx(caller: string, usdcAmount: string): Promise<string> {
  return buildVaultTx(caller, "deposit", depositArgs(caller, usdcAmount));
}

/** Build an unsigned withdraw XDR for a USDC amount. */
export async function buildWithdrawTx(
  caller: string,
  usdcAmount: string,
  slippageBps = 50,
): Promise<string> {
  return buildVaultTx(caller, "withdraw", await withdrawArgs(caller, usdcAmount, slippageBps));
}

export interface VaultPosition {
  shares: number;       // vault share tokens
  usdc: string;         // underlying USDC value, human string
}

/** Read the user's current position (shares + underlying USDC value). */
export async function getPosition(user: string): Promise<VaultPosition> {
  const shares = BigInt(await view<bigint>("balance", [scAddr(user)]));
  if (shares <= 0n) return { shares: 0, usdc: "0" };
  const values = await view<bigint[]>("get_asset_amounts_per_shares", [i128(shares)]);
  return { shares: Number(shares), usdc: stroopsToUsdc(Number(values[0] ?? 0n)) };
}

/** Forward APY estimate from the DeFindex indexer, proxied by our backend so
 *  the secret key stays server-side (GET /api/v1/cofre/apy). Returns null when
 *  the vault has no yield history yet (fresh vault) — the page then shows only
 *  the concrete on-chain earnings, never an invented rate. Shown as an estimate
 *  that varies, never a promise. */
export async function getApy(): Promise<number | null> {
  const base = (import.meta.env.VITE_API_BASE as string | undefined) ?? "https://app.slippay.cc/api";
  try {
    const r = await fetch(`${base}/v1/cofre/apy`);
    if (!r.ok) return null;
    const j = await r.json().catch(() => ({}));
    return typeof j.apy === "number" ? j.apy : null;
  } catch {
    return null;
  }
}
