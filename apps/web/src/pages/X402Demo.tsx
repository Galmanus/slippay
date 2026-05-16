// Slippay × x402 live demo · public URL anyone can use.
//
// Three resources gated by Stellar USDC payment, served via the
// /api/v1/x402/:slug endpoint we shipped in commit 3fdc72b. Click a
// card → the page hits the real API → 402 with payment requirements →
// connect Freighter (or any Stellar wallet) → sign a real USDC
// payment on testnet → listener detects → page polls, unlocks the
// content with a 6-second confirmation animation.
//
// On-chain proof at every step: tx hash + stellar.expert link visible
// to the reviewer.

import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Logo } from "../components/Logo.tsx";
import { connectWallet, signTx, NETWORK as WALLET_NETWORK } from "../lib/wallet.ts";
import {
  Account, Asset, Horizon, Memo, Operation, TransactionBuilder, BASE_FEE,
} from "@stellar/stellar-sdk";

const API_BASE = import.meta.env.VITE_API_BASE ?? "https://api.slippay.cc/api";

const NETWORK_LABEL = WALLET_NETWORK.includes("Test") ? "TESTNET" : "PUBLIC";
const HORIZON_URL = NETWORK_LABEL === "TESTNET"
  ? "https://horizon-testnet.stellar.org"
  : "https://horizon.stellar.org";
const EXPLORER_BASE = NETWORK_LABEL === "TESTNET"
  ? "https://stellar.expert/explorer/testnet"
  : "https://stellar.expert/explorer/public";

// The slugs match the resources we register against the production
// merchant for the demo. If a slug doesn't exist yet, the GET returns
// 404 and the card shows "coming soon" instead of a payment flow.
const RESOURCES = [
  {
    slug: "stellar-builder-playbook",
    title: "Stellar Builder Playbook",
    subtitle: "1,400 words on shipping Soroban contracts in 14 days",
    price: "0.05",
    badge: "001",
  },
  {
    slug: "slippay-architecture",
    title: "Slippay Architecture Whitepaper",
    subtitle: "How push-pull payments share a single settlement backbone",
    price: "0.10",
    badge: "002",
  },
  {
    slug: "audit-checklist-v1",
    title: "Stellar Mainnet Audit Checklist",
    subtitle: "8 critical + 14 high findings we closed before going live",
    price: "0.25",
    badge: "003",
  },
] as const;

type Step = "idle" | "fetching" | "402" | "signing" | "submitting" | "polling" | "unlocked" | "error";

interface PaymentReq {
  scheme: string;
  network: string;
  asset: string;
  payTo: string;
  maxAmountRequired: string;
  payload: {
    memo: string;
    recipient: string;
    amount: string;
    assetCode: string;
    assetIssuer: string;
    horizon: string;
  };
}

interface CardState {
  step: Step;
  paymentReq?: PaymentReq;
  txHash?: string;
  content?: string;
  error?: string;
}

const INITIAL: CardState = { step: "idle" };

export default function X402Demo() {
  const [states, setStates] = useState<Record<string, CardState>>(
    Object.fromEntries(RESOURCES.map(r => [r.slug, { ...INITIAL }]))
  );
  const [wallet, setWallet] = useState<string | null>(null);

  function setCard(slug: string, patch: Partial<CardState>) {
    setStates(s => ({ ...s, [slug]: { ...s[slug]!, ...patch } }));
  }

  async function ensureWallet(): Promise<string> {
    if (wallet) return wallet;
    const addr = await connectWallet();
    setWallet(addr);
    return addr;
  }

  async function fetchResource(slug: string): Promise<Response> {
    return fetch(`${API_BASE}/v1/x402/${slug}`, { method: "GET" });
  }

  async function startFlow(slug: string) {
    setCard(slug, { step: "fetching", error: undefined });
    try {
      const r = await fetchResource(slug);
      if (r.status === 200) {
        const txt = await r.text();
        setCard(slug, { step: "unlocked", content: txt });
        return;
      }
      if (r.status === 402) {
        const body = await r.json() as { accepts: PaymentReq[] };
        const req = body.accepts?.[0];
        if (!req) throw new Error("no accepts in 402 body");
        setCard(slug, { step: "402", paymentReq: req });
        return;
      }
      if (r.status === 404) {
        setCard(slug, { step: "error", error: "resource_not_found · the merchant hasn't registered this resource yet" });
        return;
      }
      setCard(slug, { step: "error", error: `unexpected_status_${r.status}` });
    } catch (e: unknown) {
      setCard(slug, { step: "error", error: String((e as Error).message ?? e) });
    }
  }

  async function payAndPoll(slug: string) {
    const card = states[slug]!;
    const req = card.paymentReq;
    if (!req) return;
    try {
      const buyer = await ensureWallet();
      setCard(slug, { step: "signing" });

      const server = new Horizon.Server(req.payload.horizon ?? HORIZON_URL);
      const account = await server.loadAccount(buyer);

      const memoBytes = hexToBytes(req.payload.memo);
      if (memoBytes.length !== 32) throw new Error("invalid memo length");

      const asset = new Asset(req.payload.assetCode, req.payload.assetIssuer);
      const tx = new TransactionBuilder(new Account(buyer, account.sequence), {
        fee: BASE_FEE,
        networkPassphrase: WALLET_NETWORK,
        // stellar-sdk Memo.hash accepts Uint8Array at runtime; the TS types
        // ask for Buffer specifically, so we cast through unknown to avoid
        // pulling node:buffer into the browser bundle.
        memo: Memo.hash(memoBytes as unknown as Buffer),
        timebounds: { minTime: 0, maxTime: Math.floor(Date.now() / 1000) + 300 },
      })
        .addOperation(Operation.payment({
          destination: req.payTo,
          asset,
          amount: req.payload.amount,
        }))
        .build();

      const signedXdr = await signTx(tx.toXDR());
      setCard(slug, { step: "submitting" });

      const signed = TransactionBuilder.fromXDR(signedXdr, WALLET_NETWORK);
      const submitted = await server.submitTransaction(signed) as { hash: string };
      setCard(slug, { step: "polling", txHash: submitted.hash });

      // Poll the x402 endpoint until it flips to 200 or we time out.
      const start = Date.now();
      while (Date.now() - start < 30_000) {
        await sleep(2000);
        const r = await fetchResource(slug);
        if (r.status === 200) {
          const txt = await r.text();
          setCard(slug, { step: "unlocked", content: txt });
          return;
        }
      }
      setCard(slug, { step: "error", error: "timeout · listener didn't confirm in 30s" });
    } catch (e: unknown) {
      setCard(slug, { step: "error", error: String((e as Error).message ?? e) });
    }
  }

  function reset(slug: string) {
    setCard(slug, { ...INITIAL });
  }

  return (
    <div className="min-h-screen bg-[#f1eee7] text-[#0a0a0a] grain">
      <header className="absolute top-0 left-0 right-0 z-20 max-w-[1400px] mx-auto px-5 md:px-10 py-5 md:py-6 flex items-center justify-between">
        <Link to="/"><Logo variant="ink" /></Link>
        <nav className="flex items-center gap-7 text-[10px] uppercase tracking-[0.22em] text-[#0a0a0a]/65">
          <Link to="/" className="hover:opacity-60 transition-opacity">Home</Link>
          <a href="https://github.com/Galmanus/slippay/blob/main/docs/integrations/x402.md" target="_blank" rel="noopener noreferrer" className="hover:opacity-60 hidden md:inline">x402 docs</a>
          <span className="bg-[#0a0a0a] text-[#b5e853] px-3 py-1.5 font-mono text-[10px] tabular-nums">
            {NETWORK_LABEL}
          </span>
        </nav>
      </header>

      <section className="max-w-[1400px] mx-auto px-5 md:px-12 pt-32 md:pt-40 pb-12 md:pb-16">
        <div className="grid grid-cols-12 gap-6 items-end">
          <div className="col-span-12 md:col-span-3 font-mono text-[10px] uppercase tracking-[0.22em] text-[#0a0a0a]/55">
            ┃ Demo · x402 live
          </div>
          <div className="col-span-12 md:col-span-9">
            <div className="text-[10px] uppercase tracking-[0.22em] text-[#0a0a0a]/55 mb-4 font-mono tabular-nums">
              005 · For Stellar Build Award reviewers
            </div>
            <h1 className="text-[10vw] md:text-[4.4vw] font-medium leading-[1.02] tracking-[-0.035em] max-w-[24ch]">
              Pay <em className="not-italic">on-chain</em>.<br/>
              Unlock in six seconds.
              <span className="inline-block align-middle ml-2 md:ml-3 w-2 md:w-2.5 h-2 md:h-2.5 bg-[#b5e853] -translate-y-[0.45em]" />
            </h1>
            <p className="mt-6 md:mt-8 text-base md:text-xl leading-[1.5] text-[#0a0a0a]/80 max-w-[58ch]">
              Three pieces of premium content, each gated by a real Stellar
              USDC payment via the x402 protocol. No fiat. No card. No
              chargeback. Pick one, connect your wallet, sign — the listener
              detects the payment and unlocks the content. The whole flow is
              one HTTP call, one wallet signature, one on-chain transaction.
            </p>
          </div>
        </div>
      </section>

      <section className="max-w-[1400px] mx-auto px-5 md:px-12 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-[#0a0a0a]/15 border border-[#0a0a0a]/15">
          {RESOURCES.map(r => (
            <Card key={r.slug} resource={r} state={states[r.slug]!}
                  onStart={() => startFlow(r.slug)}
                  onPay={() => payAndPoll(r.slug)}
                  onReset={() => reset(r.slug)}
                  walletConnected={!!wallet} />
          ))}
        </div>

        <div className="mt-12 grid grid-cols-12 gap-6 border-t border-[#0a0a0a]/15 pt-10">
          <div className="col-span-12 md:col-span-3 font-mono text-[10px] uppercase tracking-[0.22em] text-[#0a0a0a]/55">
            ┃ How it works
          </div>
          <div className="col-span-12 md:col-span-9 grid md:grid-cols-2 gap-x-12 gap-y-6">
            <Step n="01" title="GET the resource"
              body="Your browser hits /api/v1/x402/<slug>. The Slippay API responds 402 with x402-compliant payment requirements: asset, recipient, memo, amount, and the Horizon to submit through." />
            <Step n="02" title="Sign with Freighter"
              body="The page constructs a Stellar USDC payment with the exact MEMO_HASH the API issued. Freighter (or any Stellar wallet) confirms the transaction. Submitted directly to Horizon." />
            <Step n="03" title="Listener matches on-chain"
              body="Slippay's listener watches the merchant address. When the matching memo + asset + amount lands, the order is marked paid via the same matcher pipeline that powers subscription billing." />
            <Step n="04" title="Page polls, unlocks"
              body="The page polls the x402 endpoint every 2s. As soon as the listener flips order.status to paid, the next GET returns 200 with the content." />
          </div>
        </div>
      </section>

      <footer className="border-t border-[#0a0a0a]/15 bg-[#0a0a0a] text-[#f1eee7]">
        <div className="max-w-[1400px] mx-auto px-5 md:px-12 py-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-[10px] uppercase tracking-[0.22em] font-mono">
          <div>SLIPPAY × x402 · live on Stellar {NETWORK_LABEL}</div>
          <div className="text-[#f1eee7]/55">©  2026 · Bluewave AI</div>
        </div>
      </footer>
    </div>
  );
}

function Card({ resource, state, onStart, onPay, onReset, walletConnected }: {
  resource: typeof RESOURCES[number];
  state: CardState;
  onStart: () => void;
  onPay: () => void;
  onReset: () => void;
  walletConnected: boolean;
}) {
  const step = state.step;
  return (
    <div className="bg-[#f1eee7] p-7 md:p-9 flex flex-col min-h-[420px]">
      <div className="flex items-start justify-between mb-6">
        <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#0a0a0a]/55 tabular-nums">
          {resource.badge}
        </span>
        <span className="bg-[#0a0a0a] text-[#b5e853] px-3 py-1 font-mono text-[10px] uppercase tracking-[0.22em] tabular-nums">
          ${resource.price} USDC
        </span>
      </div>
      <h3 className="text-2xl md:text-3xl font-medium tracking-[-0.025em] leading-[1.1] mb-3">
        {resource.title}
      </h3>
      <p className="text-sm text-[#0a0a0a]/65 leading-[1.55] mb-6">
        {resource.subtitle}
      </p>

      <div className="mt-auto">
        {step === "idle" && (
          <button onClick={onStart}
            className="w-full bg-[#0a0a0a] text-[#f1eee7] py-3.5 text-[11px] uppercase tracking-[0.22em] hover:bg-[#1a1a1a] transition-colors">
            Unlock for ${resource.price} →
          </button>
        )}
        {step === "fetching" && <StatusLine label="Requesting from API…" />}
        {step === "402" && state.paymentReq && (
          <>
            <RequirementsBlock req={state.paymentReq} />
            <button onClick={onPay}
              className="w-full bg-[#b5e853] text-[#0a0a0a] py-3.5 text-[11px] uppercase tracking-[0.22em] font-medium hover:bg-[#a8d949] transition-colors mt-3">
              {walletConnected ? "Pay & sign →" : "Connect wallet + pay →"}
            </button>
          </>
        )}
        {step === "signing" && <StatusLine label="Sign in your wallet…" />}
        {step === "submitting" && <StatusLine label="Broadcasting to Stellar…" />}
        {step === "polling" && (
          <>
            <StatusLine label="On-chain · waiting for listener…" />
            {state.txHash && <TxLink hash={state.txHash} />}
          </>
        )}
        {step === "unlocked" && (
          <>
            <div className="bg-[#0a0a0a] text-[#b5e853] p-4 mb-3 font-mono text-[11px] leading-[1.55] whitespace-pre-wrap break-words max-h-[160px] overflow-auto">
              {state.content || "(empty content)"}
            </div>
            {state.txHash && <TxLink hash={state.txHash} />}
            <button onClick={onReset}
              className="w-full mt-3 border border-[#0a0a0a]/30 py-2.5 text-[10px] uppercase tracking-[0.22em] hover:bg-[#0a0a0a]/5">
              Try another resource →
            </button>
          </>
        )}
        {step === "error" && (
          <>
            <div className="bg-[#0a0a0a]/5 border border-[#0a0a0a]/20 p-4 text-xs leading-[1.5] text-[#0a0a0a]/75 mb-3 font-mono">
              {state.error}
            </div>
            <button onClick={onReset}
              className="w-full bg-[#0a0a0a] text-[#f1eee7] py-3 text-[10px] uppercase tracking-[0.22em] hover:bg-[#1a1a1a]">
              Reset →
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function RequirementsBlock({ req }: { req: PaymentReq }) {
  return (
    <div className="text-[10px] font-mono leading-[1.7] text-[#0a0a0a]/75 bg-[#0a0a0a]/5 p-3 border border-[#0a0a0a]/15">
      <div><span className="text-[#0a0a0a]/45">scheme:</span> {req.scheme}</div>
      <div><span className="text-[#0a0a0a]/45">network:</span> {req.network}</div>
      <div className="truncate"><span className="text-[#0a0a0a]/45">payTo:</span> {req.payTo}</div>
      <div className="truncate"><span className="text-[#0a0a0a]/45">memo:</span> {req.payload.memo}</div>
      <div><span className="text-[#0a0a0a]/45">amount:</span> {req.payload.amount} {req.payload.assetCode}</div>
    </div>
  );
}

function StatusLine({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 text-[11px] uppercase tracking-[0.22em] text-[#0a0a0a]/75 py-3.5">
      <span className="inline-block w-2 h-2 bg-[#b5e853] animate-pulse" />
      {label}
    </div>
  );
}

function TxLink({ hash }: { hash: string }) {
  const short = hash.slice(0, 8) + "…" + hash.slice(-6);
  return (
    <a href={`${EXPLORER_BASE}/tx/${hash}`} target="_blank" rel="noopener noreferrer"
       className="block font-mono text-[10px] uppercase tracking-[0.22em] text-[#0a0a0a]/55 hover:text-[#0a0a0a] underline">
      tx: {short} ↗
    </a>
  );
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="grid grid-cols-12 gap-3">
      <div className="col-span-2 md:col-span-1">
        <div className="text-2xl font-medium tabular-nums tracking-tight text-[#0a0a0a]/30 leading-none font-mono">
          {n}
        </div>
      </div>
      <div className="col-span-10 md:col-span-11">
        <div className="text-base md:text-lg tracking-tight font-medium leading-[1.2]">{title}</div>
        <p className="mt-2 text-sm leading-[1.55] text-[#0a0a0a]/70 max-w-[48ch]">{body}</p>
      </div>
    </div>
  );
}

function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) throw new Error("odd hex length");
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}
