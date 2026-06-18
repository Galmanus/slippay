# Solana frontend port — chain adapter abstraction

Branch: `feat/solana-adapter` (off `feat/dark-yeezy-redesign`, which holds the canonical porquinho landing). Non-destructive: Stellar stays the live/default chain. Solana is opt-in via `VITE_CHAIN=solana`.

Decision (operator, 2026-06-18):
- **Where:** abstract `lib/` behind a chain-agnostic interface with two adapters (Stellar + Solana), env-selectable. Both coexist → real backup.
- **Wallet:** adapt the existing passkey/relayer biometric pattern to Solana (NOT Privy — no App ID gate). Privy adapter exists in the slippay-solana SDK and can be swapped in later behind the same interface.

## Surface being abstracted (today, Stellar)
- `lib/wallet.ts` — connect/sign (StellarWalletsKit)
- `lib/stellar.ts` — `buildAtomicTx` (one-time 2-op payment), `submitSignedTx`, `fetchSequence`, `isValidStellarAddress`, `checkReceiveAddress`
- `lib/soroban.ts` — `approveAllowance` (the 1 signature for recurring), `requestOnchainCharge`, `signAndSubmitContractCharge`

Pages calling these: `Checkout.tsx` (one-time), `Sub.tsx` (recurring), `DashboardSettings.tsx`/`StellarAddressInput.tsx` (address validation). Landing (`LandingV2`) touches none.

## Interface (`lib/chain/types.ts`)
```ts
type ChainId = "stellar" | "solana";
interface AddressCheck { validFormat: boolean; accountExists: boolean | null; hasUsdcTrustline: boolean | null; }
interface ChainAdapter {
  id: ChainId;
  connectWallet(): Promise<string>;            // returns address
  isValidAddress(addr: string): boolean;       // offline
  checkReceiveAddress(addr: string): Promise<AddressCheck>;
  payOneTime(a: OneTimePayArgs): Promise<{ hash: string }>;   // build+sign+submit, hides XDR/Tx
  approveRecurring(a: ApproveArgs): Promise<{ hash: string }>;// the single allowance signature
}
```
- Stellar `hasUsdcTrustline` ⇄ Solana "recipient has a USDC ATA" (same onboarding guard, different mechanism).

## Increments
1. **Interface + Stellar adapter (behavior-preserving).** Wrap existing libs. No page rewire yet. Gate: `pnpm lint` green.
2. **Rewire `Checkout.tsx` (+ Sub, address inputs) to `getChainAdapter()`.** Stellar path byte-identical. Gate: lint green + manual smoke on testnet.
3. **Solana adapter.** Add `@solana/web3.js`, `@solana/spl-token`, `@coral-xyz/anchor`; vendor `slippay_mandate` IDL + port mandate client. `payOneTime` = 2-instruction SPL transfer (merchant + fee). `approveRecurring` = SPL `approve` to mandate PDA + `initMandate`. Gate: vitest on pure bits (address validation, fee split), build green.
4. **Solana biometric wallet (passkey/relayer).** Port the passkey + relayer signer to Solana behind `connectWallet`/signing. Backend relayer work tracked separately. Gate: e2e on devnet/localnet.

Cutover stays gated until 3–4 prove out. Stellar remains default.
