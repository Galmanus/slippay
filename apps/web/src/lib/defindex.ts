// DeFindex (PaltaLabs) yield-vault client for Slippay.
//
// Non-custodial by construction: every mutating SDK call returns an UNSIGNED
// transaction XDR. Signing stays client-side (authorizeTx) and the signed tx is
// submitted via lib/stellar.ts submitSignedTx — api.defindex.io only builds, it
// never sees a key and is off the submit path.
//
// Units: USDC on Stellar has 7 decimals (1 USDC = 10_000_000 stroops). The SDK
// takes `amounts: number[]` as RAW INTEGER stroops; usdcToStroops/stroopsToUsdc
// are the only bridge and are unit-tested. Never multiply a float by 1e7 inline.

import { DefindexSDK, SupportedNetworks } from "@defindex/sdk";

const DECIMALS = 7;
const ONE_USDC = 10_000_000;

/** Human USDC decimal string -> raw integer stroops. Throws on bad format, >7 decimals, <= 0. */
export function usdcToStroops(human: string): number {
  const s = String(human).trim();
  if (!/^\d+(\.\d{1,7})?$/.test(s)) {
    throw new Error(`invalid USDC amount: "${human}"`);
  }
  const [int, frac = ""] = s.split(".");
  const fracPadded = frac.padEnd(DECIMALS, "0");
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

const NETWORK: SupportedNetworks =
  (import.meta.env.VITE_STELLAR_NETWORK ?? "TESTNET").toUpperCase() === "PUBLIC"
    ? SupportedNetworks.MAINNET
    : SupportedNetworks.TESTNET;

const sdk = new DefindexSDK({
  apiKey: import.meta.env.VITE_DEFINDEX_API_KEY as string | undefined,
  baseUrl: (import.meta.env.VITE_DEFINDEX_BASE as string | undefined) ?? "https://api.defindex.io",
  defaultNetwork: NETWORK,
});

/** USDC vault, pinned per network via env. Mainnet vault must be verified
 *  (is_upgradable=false / known Manager) on-chain before being set. */
function vaultId(): string {
  const v = import.meta.env.VITE_DEFINDEX_USDC_VAULT as string | undefined;
  if (!v) throw new Error("VITE_DEFINDEX_USDC_VAULT not set");
  return v;
}

/** Build an unsigned deposit XDR (auto-invests into the strategy). */
export async function buildDepositTx(caller: string, usdcAmount: string): Promise<string> {
  const res = await sdk.depositToVault(vaultId(), {
    caller,
    amounts: [usdcToStroops(usdcAmount)],
    invest: true,
  });
  if (!res.xdr) throw new Error("defindex returned no deposit xdr");
  return res.xdr;
}

/** Build an unsigned withdraw XDR for a USDC amount. */
export async function buildWithdrawTx(
  caller: string,
  usdcAmount: string,
  slippageBps = 50,
): Promise<string> {
  const res = await sdk.withdrawFromVault(vaultId(), {
    caller,
    amounts: [usdcToStroops(usdcAmount)],
    slippageBps,
  });
  if (!res.xdr) throw new Error("defindex returned no withdraw xdr");
  return res.xdr;
}

export interface VaultPosition {
  shares: number;
  usdc: string;
}

/** Read the user's current position (shares + underlying USDC value). */
export async function getPosition(user: string): Promise<VaultPosition> {
  const b = await sdk.getVaultBalance(vaultId(), user);
  const underlying = b.underlyingBalance?.[0] ?? 0;
  return { shares: b.dfTokens, usdc: stroopsToUsdc(underlying) };
}

/** Current vault APY as returned by DeFindex. Variable; display verbatim, do not promise it. */
export async function getApy(): Promise<number> {
  const r = await sdk.getVaultAPY(vaultId());
  return r.apy;
}
