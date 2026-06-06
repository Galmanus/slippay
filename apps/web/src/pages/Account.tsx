// /account — one-touch account, same biometric system as payments. Tap once
// (Face/Touch ID) -> a device passkey is minted -> the relayer deploys your
// smart wallet -> that wallet IS your account, stored locally so you return to
// it. No email, no password, no seed phrase. Editorial register, Stellar yellow.

import { useState } from "react";
import { Link } from "react-router-dom";
import { createPasskey } from "../lib/passkey";
import { loadAccount, saveAccount, clearAccount, type Account as Acct } from "../lib/account";
import { LiveProof } from "../components/LiveProof";

const display = { fontFamily: "'Space Grotesk', sans-serif" } as const;
const RELAYER_BASE = (import.meta.env.VITE_RELAYER_BASE as string | undefined)
  ?? "https://api.slippay.cc/api/v1/relayer";
const hex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
const short = (s: string, h = 6, t = 6) => (s && s.length > h + t + 1 ? `${s.slice(0, h)}…${s.slice(-t)}` : s);
const buzz = (p: number | number[]) => { try { navigator.vibrate?.(p); } catch { /* unsupported */ } };

function friendly(e: unknown): string {
  const m = (e as Error)?.message ?? String(e);
  if (/NotAllowed|timed out|not allowed|abort|cancel/i.test(m)) return "We couldn't read your biometrics. Tap to try again.";
  if (/relayer|sponsor|unavailable/i.test(m)) return "Our network sponsor is waking up. Try again in a moment.";
  if (/deploy/i.test(m)) return "Your wallet didn't finish setting up. Tap to try again.";
  return "Something interrupted setup. Tap to try again.";
}

export default function Account() {
  const [acct, setAcct] = useState<Acct | null>(() => loadAccount());
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function createAccount() {
    setBusy(true); setError(null);
    try {
      setStep("Securing a private channel…");
      const info = await fetch(`${RELAYER_BASE}/info`).then((r) => r.json()).catch(() => ({}));
      if (!info.sponsor) throw new Error("relayer unavailable");
      const network: Acct["network"] = info.network === "PUBLIC" ? "PUBLIC" : "TESTNET";
      setStep("Touch to create your key…"); buzz(20);
      const h = await createPasskey("slippay");
      setStep("Building your wallet on-chain…");
      const resp = await fetch(`${RELAYER_BASE}/deploy`, {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ passkey_pubkey_hex: hex(h.pubKey), cred_id_hex: hex(h.credId) }),
      });
      const j = await resp.json().catch(() => ({}));
      if (!resp.ok || !j.wallet_id) throw new Error("deploy: " + (j.reason ?? j.error ?? resp.status));
      const a: Acct = {
        walletId: j.wallet_id, credIdHex: hex(h.credId), pubKeyHex: hex(h.pubKey),
        network, funded: String(j.funded ?? "0"), createdAt: new Date().toISOString(),
      };
      saveAccount(a); setAcct(a); buzz([15, 30, 15, 30, 50]);
    } catch (e) { setError(friendly(e)); } finally { setBusy(false); setStep(""); }
  }

  return (
    <div className="min-h-screen bg-[#f1eee7] text-[#0a0a0a] grain overflow-x-hidden">
      <header className="px-6 md:px-12 py-7 flex items-center justify-between">
        <Link to="/" className="text-xl font-bold tracking-[-0.06em] lowercase" style={display}>slippay</Link>
        <Link to="/" className="text-[10px] uppercase tracking-[0.24em] text-[#0a0a0a]/55 hover:text-[#0a0a0a]">Home</Link>
      </header>

      <main className="max-w-[760px] mx-auto px-6 md:px-12 pt-12 md:pt-20 pb-28">
        {!acct ? (
          <>
            <div className="flex items-baseline gap-3 font-mono text-[11px] uppercase tracking-[0.3em] text-[#0a0a0a]/45">
              <span className="text-[#0a0a0a]/70">001</span><span className="h-px w-8 bg-current opacity-40" /><span>create your account</span>
            </div>
            <h1 className="mt-10 font-bold uppercase tracking-[-0.05em] leading-[0.85] text-[clamp(2.75rem,11vw,6.5rem)]" style={display}>
              One touch.<br />That's your account.
            </h1>
            <p className="mt-8 text-xl leading-relaxed max-w-[46ch] text-[#0a0a0a]/75">
              No email, no password, no seed phrase. Your biometrics create a key only you hold,
              and that becomes your account — the same system that authorizes your payments.
            </p>

            <button onClick={createAccount} disabled={busy}
              className="lift mt-12 w-full max-w-[400px] px-7 py-5 rounded-full bg-[#0a0a0a] text-[#f1eee7] text-[12px] uppercase tracking-[0.22em] disabled:opacity-40">
              {busy ? (step || "…") : "Create my account (one touch)"}
            </button>

            {error && (
              <div className="mt-6 max-w-[400px]">
                <div className="text-[#0a0a0a]">{error}</div>
                <button onClick={createAccount} className="lift mt-3 inline-flex rounded-full px-6 py-3 text-[10px] uppercase tracking-[0.2em] bg-[#FDDA24] text-[#0a0a0a]">Try again</button>
              </div>
            )}

            <p className="mt-10 text-xs text-[#0a0a0a]/45 max-w-[48ch] leading-relaxed">
              Works on any device with biometrics + a modern browser. Already a merchant with an API key?
              <Link to="/login" className="underline ml-1">Sign in with email</Link>.
            </p>
            <div className="mt-12"><LiveProof /></div>
          </>
        ) : (
          <>
            <div className="flex items-baseline gap-3 font-mono text-[11px] uppercase tracking-[0.3em] text-[#0a0a0a]/45">
              <span className="text-[#0a0a0a]/70">✓</span><span className="h-px w-8 bg-current opacity-40" /><span>you're in · {acct.network === "PUBLIC" ? "mainnet" : "testnet"}</span>
            </div>
            <h1 className="mt-10 font-bold uppercase tracking-[-0.05em] leading-[0.85] text-[clamp(2.5rem,9vw,6rem)]" style={display}>
              Welcome <span className="text-[#A16207]">back.</span>
            </h1>

            <div className="mt-12 rounded-2xl border border-[#0a0a0a]/12 p-7 max-w-[520px]">
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#0a0a0a]/45">your account</div>
              <div className="mt-3 font-mono text-sm break-all text-[#0a0a0a]/80">{short(acct.walletId, 10, 8)}</div>
              <div className="mt-4 flex items-baseline gap-6">
                <div>
                  <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#0a0a0a]/40">opening balance</div>
                  <div className="text-2xl tabular-nums" style={display}>{(Number(acct.funded) / 1e7).toFixed(2)} <span className="text-sm text-[#0a0a0a]/50">USDC</span></div>
                </div>
                <div>
                  <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#0a0a0a]/40">since</div>
                  <div className="text-sm tabular-nums text-[#0a0a0a]/70">{new Date(acct.createdAt).toLocaleDateString()}</div>
                </div>
              </div>
            </div>

            <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-[520px]">
              <Link to="/pay" className="lift rounded-full px-5 py-3.5 text-center text-[11px] uppercase tracking-[0.2em] bg-[#0a0a0a] text-[#f1eee7]">Pay</Link>
              <Link to="/cobrar" className="lift rounded-full px-5 py-3.5 text-center text-[11px] uppercase tracking-[0.2em] bg-[#FDDA24] text-[#0a0a0a] font-medium">Get paid</Link>
              <Link to="/withdraw-demo" className="rounded-full px-5 py-3.5 text-center text-[11px] uppercase tracking-[0.2em] border border-[#0a0a0a]/25 hover:border-[#0a0a0a]/60">Withdraw</Link>
              <Link to="/cockpit" className="rounded-full px-5 py-3.5 text-center text-[11px] uppercase tracking-[0.2em] border border-[#0a0a0a]/25 hover:border-[#0a0a0a]/60">Live</Link>
            </div>

            <button onClick={() => { clearAccount(); setAcct(null); }}
              className="mt-10 text-[10px] uppercase tracking-[0.2em] text-[#0a0a0a]/45 hover:text-[#0a0a0a]">Sign out of this device</button>
            <div className="mt-12"><LiveProof /></div>
          </>
        )}
      </main>
    </div>
  );
}
