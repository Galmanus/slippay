// Chain-agnostic payment interface. Two adapters implement it (Stellar today,
// Solana for the migration); the active one is chosen by VITE_CHAIN. Pages talk
// to this interface only — never to a chain SDK directly. This is what lets
// Stellar stay live as a backup while Solana is brought up in parallel.

export type ChainId = "stellar" | "solana";

/** Onboarding guard for a merchant receive address.
 *  - validFormat:    offline strkey/pubkey check (false => hard-block the save).
 *  - accountExists:  true / false / null (null = network unknown, never assert).
 *  - hasUsdcTrustline (Stellar) ⇄ "recipient has a USDC ATA" (Solana). Same guard:
 *    USDC cannot land without it. null when not determinable. */
export interface AddressCheck {
  validFormat: boolean;
  accountExists: boolean | null;
  hasUsdcTrustline: boolean | null;
}

export interface OneTimePayArgs {
  /** Buyer's connected wallet address. */
  buyerAddress: string;
  merchantAddress: string;
  platformAddress: string;
  /** Human USDC amount, e.g. "12.50". */
  usdcAmount: string;
  platformFeeBp: number;
  /** 32-byte order id as hex (Stellar memo hash / Solana memo/ref). */
  memoHex: string;
  /** Unix seconds; tx invalid after this. */
  maxTime: number;
}

export interface ApproveArgs {
  /** Token contract/SAC (Stellar) or mint (Solana). */
  tokenAddress: string;
  owner: string;
  /** The subscription contract (Stellar) / mandate PDA spender (Solana). */
  spender: string;
  /** Base-unit amount (i128 stroops on Stellar; u64 base units on Solana). */
  amount: string;
  /** Stellar: expiration ledger. Solana: ignored (delegate has no ledger ttl). */
  expirationLedger?: number;
  rpcUrl?: string;
}

export interface PayResult {
  hash: string;
}

export interface ChainAdapter {
  readonly id: ChainId;
  connectWallet(): Promise<string>;
  isValidAddress(addr: string): boolean;
  checkReceiveAddress(addr: string): Promise<AddressCheck>;
  payOneTime(args: OneTimePayArgs): Promise<PayResult>;
  approveRecurring(args: ApproveArgs): Promise<PayResult>;
}
