// slippay_mandate client — ported from ~/projects/slippay-solana/sdk/mandate.ts
// (canonical source). Wallet-agnostic: any Anchor-compatible wallet plugs in via
// the provider (the biometric passkey/relayer signer in the browser; a Keypair
// in Node). Program proven on Solana: 5/5 bounded-autonomy tests green (2026-06-17).

import { AnchorProvider, Program, BN, type Idl } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import idlJson from "./idl/slippay_mandate.json";

export const MANDATE_PROGRAM_ID = new PublicKey(
  "VhvqPBz1qJ1sKEY5tAzsWcyNkFP5GLRjZa8j4eGA8n8",
);

const SEED = Buffer.from("mandate");

type MethodBuilder = (...args: unknown[]) => { accounts(a: unknown): { rpc(): Promise<string> } };

/** Mandate PDA for owner + mint. Pure derivation — no provider/network needed. */
export function mandatePda(owner: PublicKey, mint: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync(
    [SEED, owner.toBuffer(), mint.toBuffer()],
    MANDATE_PROGRAM_ID,
  )[0];
}

export interface MandateRules {
  agent: PublicKey;
  perPaymentCap: BN;   // base units (USDC = 6 decimals)
  monthlyCap: BN;
  periodSecs: BN;      // e.g. 2_592_000 (30d)
  allowed: PublicKey[]; // recipient owners on the allowlist (<= 8)
}

export class SlippayMandate {
  readonly program: Program;
  constructor(provider: AnchorProvider) {
    this.program = new Program(idlJson as Idl, provider);
  }

  // Anchor types methods loosely under a generic Idl; narrow to named builders
  // (named props avoid noUncheckedIndexedAccess making them possibly-undefined).
  private get methods(): {
    initMandate: MethodBuilder;
    charge: MethodBuilder;
    setPaused: MethodBuilder;
  } {
    return this.program.methods as never;
  }

  /** PDA for a given owner + mint. */
  pda(owner: PublicKey, mint: PublicKey): PublicKey {
    return mandatePda(owner, mint);
  }

  /** Owner creates the mandate (delegates bounded spend to `agent`). */
  async initMandate(owner: PublicKey, mint: PublicKey, r: MandateRules): Promise<string> {
    const mandate = this.pda(owner, mint);
    return this.methods
      .initMandate(r.agent, r.perPaymentCap, r.monthlyCap, r.periodSecs, r.allowed)
      .accounts({ owner, mint, mandate, systemProgram: SystemProgram.programId })
      .rpc();
  }

  /** Agent charges `amount` to a recipient token account. Fail-closed on rules. */
  async charge(opts: {
    owner: PublicKey; mint: PublicKey; agent: PublicKey;
    ownerToken: PublicKey; recipientToken: PublicKey; amount: BN;
  }): Promise<string> {
    const mandate = this.pda(opts.owner, opts.mint);
    return this.methods.charge(opts.amount).accounts({
      agent: opts.agent, mandate, mint: opts.mint,
      ownerToken: opts.ownerToken, recipientToken: opts.recipientToken,
      tokenProgram: TOKEN_PROGRAM_ID,
    }).rpc();
  }

  async setPaused(owner: PublicKey, mint: PublicKey, paused: boolean): Promise<string> {
    return this.methods.setPaused(paused)
      .accounts({ owner, mandate: this.pda(owner, mint) }).rpc();
  }
}

export { BN, PublicKey };
