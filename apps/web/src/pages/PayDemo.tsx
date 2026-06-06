// /pay — REAL biometric payment on Stellar, fully on your phone. Editorial
// monumental register (matches the landing): Space Grotesk display, index stamp,
// Stellar yellow. Same logic as before — a device passkey (biometrics) is minted,
// the gas-sponsor relayer deploys a smart-wallet bound to it and fronts a small
// float, and "pay" moves funds authorized ONLY by a live biometrics tap, verified
// on-chain by the wallet's __check_auth. The relayer pays network fees only.

import { useState } from "react";
import { Link } from "react-router-dom";
import { QrScanner } from "../components/QrScanner";
import { decodeRequest, stroopsToXlm, type PayRequest } from "../lib/slippayqr";
import { createPasskey, payViaRelayer, type PasskeyHandle } from "../lib/passkey";
import { FaceScan } from "../components/FaceScan";

const display = { fontFamily: "'Space Grotesk', sans-serif" } as const;
const RELAYER_BASE = (import.meta.env.VITE_RELAYER_BASE as string | undefined)
  ?? "https://api.slippay.cc/api/v1/relayer";

function bytesToHex(b: Uint8Array): string {
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
}
function short(s: string, h = 6, t = 6) { return s.length <= h + t + 1 ? s : `${s.slice(0, h)}…${s.slice(-t)}`; }

export default function PayDemo() {
  const [handle, setHandle] = useState<PasskeyHandle | null>(null);
  const [wallet, setWallet] = useState<string | null>(null);
  const [sponsor, setSponsor] = useState<string | null>(null);
  const [network, setNetwork] = useState<"TESTNET" | "PUBLIC">("TESTNET");
  const [scanning, setScanning] = useState(false);
  const [req, setReq] = useState<PayRequest | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [payHash, setPayHash] = useState<string | null>(null);

  const add = (s: string) => setLog((l) => [...l, s]);
  const explorerNet = network === "PUBLIC" ? "public" : "testnet";

  async function onCreateAccount() {
    setBusy(true); setPayHash(null); setLog([]);
    try {
      add("connecting to the relayer (it only sponsors fees)…");
      const info = await fetch(`${RELAYER_BASE}/info`).then((r) => r.json()).catch(() => ({}));
      if (!info.sponsor) throw new Error("relayer unavailable: " + (info.error ?? "no response"));
      setSponsor(info.sponsor);
      setNetwork(info.network === "PUBLIC" ? "PUBLIC" : "TESTNET");
      add(`✅ relayer ${info.network}`);

      add("use your biometrics to create your passkey…");
      const h = await createPasskey("slippay");
      setHandle(h);
      add("✅ passkey created (your key, no one else has it)");

      add("creating your wallet on-chain (a few seconds)…");
      const resp = await fetch(`${RELAYER_BASE}/deploy`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ passkey_pubkey_hex: bytesToHex(h.pubKey), cred_id_hex: bytesToHex(h.credId) }),
      });
      const j = await resp.json().catch(() => ({}));
      if (!resp.ok || !j.wallet_id) {
        throw new Error("deploy failed: " + (j.reason ?? j.error ?? resp.status));
      }
      setWallet(j.wallet_id);
      add(`✅ wallet: ${short(j.wallet_id)} · starting balance ${stroopsToXlm(j.funded)} XLM`);
      add("account ready. Scan a payment QR.");
    } catch (e) { add(`✗ ${(e as Error).message}`); } finally { setBusy(false); }
  }

  function onScanned(text: string) {
    setScanning(false);
    try {
      const r = decodeRequest(text);
      setReq(r);
      add(`QR read: ${stroopsToXlm(r.amount)} ${r.asset ?? "USDC"} → ${short(r.to)}`);
    } catch (e) { add(`✗ ${(e as Error).message}`); }
  }

  async function onPayReq() {
    if (!handle || !wallet || !sponsor || !req) return;
    setBusy(true); setPayHash(null);
    try {
      add(`use your biometrics to pay ${stroopsToXlm(req.amount)} ${req.asset ?? "USDC"}…`);
      const hash = await payViaRelayer({
        network, relayerBase: RELAYER_BASE, sponsor,
        walletId: wallet, recipient: req.to, amount: req.amount,
        asset: req.asset ?? "USDC", credId: handle.credId,
      });
      setPayHash(hash);
      setReq(null);
      add(`✅ PAID · tx ${short(hash)}`);
    } catch (e) { add(`✗ ${(e as Error).message}`); } finally { setBusy(false); }
  }

  return (
    <div className="min-h-screen bg-[#f1eee7] text-[#0a0a0a] grain overflow-x-hidden">
      <header className="px-6 md:px-12 py-7 flex items-center justify-between">
        <Link to="/" className="text-lg font-semibold tracking-[-0.04em]" style={display}>slippay</Link>
        <Link to="/" className="text-[10px] uppercase tracking-[0.24em] text-[#0a0a0a]/55 hover:text-[#0a0a0a]">Home</Link>
      </header>

      <main className="max-w-[720px] mx-auto px-6 md:px-12 pt-10 md:pt-16 pb-28">
        <div className="flex items-baseline gap-3 font-mono text-[11px] uppercase tracking-[0.3em] text-[#0a0a0a]/45">
          <span className="text-[#0a0a0a]/70">001</span>
          <span className="h-px w-8 bg-current opacity-40" />
          <span>pay with a touch · {network === "PUBLIC" ? "mainnet" : "testnet"}</span>
        </div>

        <h1 className="mt-10 font-bold uppercase tracking-[-0.05em] leading-[0.85] text-[clamp(2.75rem,11vw,6.5rem)] break-words" style={display}>
          Pay with <span className="text-[#0a0a0a]">a touch.</span>
        </h1>
        <p className="mt-8 text-xl leading-relaxed max-w-[48ch] text-[#0a0a0a]/75">
          This is the rail your agent uses to pay. Create a wallet with biometrics and send a real
          payment — authorized only by your biometrics, verified on-chain.
          <span className="text-[#0a0a0a] font-medium"> Free, on your phone. No app, no seed phrase.</span>
        </p>
        <a href="/anchor-demo" className="mt-5 inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-[#0a0a0a]/55 hover:text-[#0a0a0a] border-b border-[#0a0a0a]/20 pb-0.5">
          No dollars yet? Add funds<span className="text-[#0a0a0a]/40">→</span>
        </a>

        <div className="mt-12 flex flex-col gap-3 max-w-[380px]">
          <button onClick={onCreateAccount} disabled={busy}
            className="lift px-7 py-4 rounded-full bg-[#0a0a0a] text-[#f1eee7] text-[11px] uppercase tracking-[0.22em] disabled:opacity-40">
            1 · Create my wallet (biometrics)
          </button>
          <button onClick={() => setScanning(true)} disabled={busy || !wallet}
            className="lift px-7 py-4 rounded-full bg-[#FDDA24] text-[#0a0a0a] text-[11px] uppercase tracking-[0.22em] font-medium disabled:opacity-40">
            2 · Pay a request (QR)
          </button>
        </div>

        {/* face-scan moment — the real prompt is the OS modal */}
        {(busy || payHash) && (
          <div className="mt-8 max-w-[380px] rounded-2xl border border-[#0a0a0a]/10 bg-white/40 py-4">
            <FaceScan state={payHash && !busy ? "done" : "scanning"} />
            <div className="text-center font-mono text-[10px] uppercase tracking-[0.22em] text-[#0a0a0a]/45 pb-1">
              {payHash && !busy ? "authorized by your biometrics" : "waiting for your biometrics…"}
            </div>
          </div>
        )}

        {/* confirm — see WHO and HOW MUCH before your biometrics authorizes */}
        {req && (
          <div className="mt-8 p-6 rounded-2xl border-2 border-[#0a0a0a] max-w-[380px]">
            <div className="text-[10px] uppercase tracking-[0.22em] text-[#0a0a0a]/55 font-mono mb-3">Confirm the payment</div>
            <div className="text-4xl font-medium tabular-nums tracking-[-0.03em]" style={display}>{stroopsToXlm(req.amount)} <span className="text-base text-[#0a0a0a]/55">{req.asset ?? "USDC"}</span></div>
            <div className="text-xs font-mono text-[#0a0a0a]/55 mt-2 break-all">to {short(req.to, 8, 8)}</div>
            <button onClick={onPayReq} disabled={busy}
              className="lift mt-5 w-full px-6 py-4 rounded-full bg-[#FDDA24] text-[#0a0a0a] text-[11px] uppercase tracking-[0.22em] font-medium disabled:opacity-40">
              {busy ? "…" : "Authorize with your biometrics"}
            </button>
            <button onClick={() => setReq(null)} disabled={busy}
              className="mt-2 w-full px-6 py-3 text-[11px] uppercase tracking-[0.22em] text-[#0a0a0a]/55 hover:text-[#0a0a0a]">
              Cancel
            </button>
          </div>
        )}

        {scanning && <QrScanner onScan={onScanned} onClose={() => setScanning(false)} />}

        {payHash && (
          <div className="mt-8 p-6 rounded-2xl border-2 border-[#A16207] max-w-[420px]">
            <div className="text-lg font-medium" style={{ color: "#A16207" }}>✅ Paid. The money really moved.</div>
            <a href={`https://stellar.expert/explorer/${explorerNet}/tx/${payHash}`} target="_blank" rel="noopener noreferrer"
              className="text-xs font-mono underline underline-offset-4 mt-2 inline-block break-all">
              view on the blockchain ↗
            </a>
            <p className="text-sm text-[#0a0a0a]/70 mt-2">
              No password. Only your biometrics authorized it — and the contract verified it on-chain.
            </p>
          </div>
        )}

        <div className="mt-10">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#0a0a0a]/55 mb-3">┃ log</div>
          <div className="bg-[#0a0a0a] text-[#FDDA24] font-mono text-xs p-4 rounded-xl min-h-[180px] whitespace-pre-wrap break-all">
            {log.length === 0 ? "// tap 1 · Create my wallet\n" : log.join("\n")}
          </div>
        </div>

        <p className="mt-6 text-xs text-[#0a0a0a]/45 leading-relaxed">
          {network === "PUBLIC"
            ? "Mainnet — real money. The relayer sponsors only the network fee; your money stays in the wallet that only your biometrics can move."
            : "Testnet (free play money) — to prove the flow on your device."}
          {" "}Needs a device with biometrics (Touch ID, fingerprint, etc.) + a modern browser.
        </p>
      </main>
    </div>
  );
}
