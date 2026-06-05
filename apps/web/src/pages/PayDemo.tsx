// /pay — REAL biometric payment on Stellar, fully on your phone.
//
// "Criar conta" mints a device passkey (Face ID); the gas-sponsor relayer
// deploys a smart-wallet bound to it and fronts a small float. "Pagar" moves
// XLM out — authorized ONLY by a live Face ID tap, verified on-chain by the
// wallet's __check_auth. No seed phrase, no typing, NO wallet-connect.
//
// The relayer pays network fees only (it cannot move your money — only your
// Face ID can). Network + sponsor come from GET /relayer/info; mainnet when the
// relayer is configured with a PUBLIC sponsor.

import { useState } from "react";
import { Link } from "react-router-dom";
import { Logo } from "../components/Logo";
import { QrScanner } from "../components/QrScanner";
import { decodeRequest, stroopsToXlm, type PayRequest } from "../lib/slippayqr";
import { createPasskey, payViaRelayer, type PasskeyHandle } from "../lib/passkey";

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
      add("conectando ao relayer (patrocina só as taxas)…");
      const info = await fetch(`${RELAYER_BASE}/info`).then((r) => r.json()).catch(() => ({}));
      if (!info.sponsor) throw new Error("relayer indisponível: " + (info.error ?? "sem resposta"));
      setSponsor(info.sponsor);
      setNetwork(info.network === "PUBLIC" ? "PUBLIC" : "TESTNET");
      add(`✅ relayer ${info.network}`);

      add("toca o Face ID pra criar tua passkey…");
      const h = await createPasskey("slippay");
      setHandle(h);
      add("✅ passkey criada (sua chave, ninguém mais tem)");

      add("criando tua carteira on-chain (uns segundos)…");
      const resp = await fetch(`${RELAYER_BASE}/deploy`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ passkey_pubkey_hex: bytesToHex(h.pubKey), cred_id_hex: bytesToHex(h.credId) }),
      });
      const j = await resp.json().catch(() => ({}));
      if (!resp.ok || !j.wallet_id) {
        throw new Error("deploy falhou: " + (j.reason ?? j.error ?? resp.status));
      }
      setWallet(j.wallet_id);
      add(`✅ carteira: ${short(j.wallet_id)} · saldo inicial ${stroopsToXlm(j.funded)} XLM`);
      add("conta pronta. Escaneia um QR de cobrança.");
    } catch (e) { add(`✗ ${(e as Error).message}`); } finally { setBusy(false); }
  }

  function onScanned(text: string) {
    setScanning(false);
    try {
      const r = decodeRequest(text);
      setReq(r);
      add(`QR lido: ${stroopsToXlm(r.amount)} ${r.asset ?? "USDC"} → ${short(r.to)}`);
    } catch (e) { add(`✗ ${(e as Error).message}`); }
  }

  async function onPayReq() {
    if (!handle || !wallet || !sponsor || !req) return;
    setBusy(true); setPayHash(null);
    try {
      add(`toca o Face ID pra pagar ${stroopsToXlm(req.amount)} ${req.asset ?? "USDC"}…`);
      const hash = await payViaRelayer({
        network, relayerBase: RELAYER_BASE, sponsor,
        walletId: wallet, recipient: req.to, amount: req.amount,
        asset: req.asset ?? "USDC", credId: handle.credId,
      });
      setPayHash(hash);
      setReq(null);
      add(`✅ PAGO · tx ${short(hash)}`);
    } catch (e) { add(`✗ ${(e as Error).message}`); } finally { setBusy(false); }
  }

  return (
    <div className="min-h-screen bg-[#f1eee7] text-[#0a0a0a] grain overflow-x-hidden">
      <header className="px-5 md:px-10 py-5 flex items-center justify-between border-b border-[#0a0a0a]/8">
        <Logo />
        <Link to="/" className="text-[10px] uppercase tracking-[0.22em] hover:opacity-60">Home</Link>
      </header>
      <main className="max-w-[680px] mx-auto px-5 md:px-10 pt-12 pb-24">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#0a0a0a]/55 mb-5">
          ┃ demo grátis · um pagamento de verdade · {network === "PUBLIC" ? "mainnet" : "testnet"}
        </div>
        <h1 className="text-4xl md:text-6xl font-medium tracking-[-0.04em] leading-[0.98]">
          Veja o pagamento sair.<span className="inline-block w-2.5 h-2.5 bg-[#65a30d] ml-2 align-baseline" />
        </h1>
        <p className="mt-6 text-base text-[#0a0a0a]/75 leading-relaxed max-w-[52ch]">
          Esse é o trilho que seu agente usa pra pagar as contas. Crie uma carteira
          com Face ID e dispare um pagamento de verdade — autorizado só pelo seu
          rosto e verificado na blockchain. Grátis, no seu celular.
        </p>
        <a href="/anchor-demo" className="mt-4 inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-[#0a0a0a]/55 hover:text-[#0a0a0a] border-b border-[#0a0a0a]/20 pb-0.5">
          Sem dólar ainda? Adicionar fundos<span className="text-[#0a0a0a]/40">→</span>
        </a>

        <div className="mt-10 flex flex-col gap-3 max-w-[360px]">
          <button onClick={onCreateAccount} disabled={busy}
            className="lift px-6 py-4 bg-[#0a0a0a] text-[#f1eee7] text-[11px] uppercase tracking-[0.22em] disabled:opacity-40">
            1 · Criar minha carteira (Face ID)
          </button>
          <button onClick={() => setScanning(true)} disabled={busy || !wallet}
            className="lift px-6 py-4 bg-[#b5e853] text-[#0a0a0a] text-[11px] uppercase tracking-[0.22em] font-medium disabled:opacity-40">
            2 · Pagar uma cobrança (QR)
          </button>
        </div>

        {/* confirm screen — see WHO and HOW MUCH before your face authorizes */}
        {req && (
          <div className="mt-8 p-6 border-2 border-[#0a0a0a] max-w-[360px]">
            <div className="text-[10px] uppercase tracking-[0.22em] text-[#0a0a0a]/55 font-mono mb-3">Confirma o pagamento</div>
            <div className="text-4xl font-medium tabular-nums tracking-[-0.03em]">{stroopsToXlm(req.amount)} <span className="text-base text-[#0a0a0a]/55">{req.asset ?? "USDC"}</span></div>
            <div className="text-xs font-mono text-[#0a0a0a]/55 mt-2 break-all">para {short(req.to, 8, 8)}</div>
            <button onClick={onPayReq} disabled={busy}
              className="lift mt-5 w-full px-6 py-4 bg-[#b5e853] text-[#0a0a0a] text-[11px] uppercase tracking-[0.22em] font-medium disabled:opacity-40">
              {busy ? "…" : "Autorizar com o rosto"}
            </button>
            <button onClick={() => setReq(null)} disabled={busy}
              className="mt-2 w-full px-6 py-3 text-[11px] uppercase tracking-[0.22em] text-[#0a0a0a]/55 hover:text-[#0a0a0a]">
              Cancelar
            </button>
          </div>
        )}

        {scanning && <QrScanner onScan={onScanned} onClose={() => setScanning(false)} />}

        {payHash && (
          <div className="mt-8 p-5 border" style={{ borderColor: "#3f7d20" }}>
            <div className="text-lg font-medium" style={{ color: "#3f7d20" }}>✅ Pago. O dinheiro se moveu de verdade.</div>
            <a href={`https://stellar.expert/explorer/${explorerNet}/tx/${payHash}`} target="_blank" rel="noopener noreferrer"
              className="text-xs font-mono underline underline-offset-4 mt-2 inline-block break-all">
              ver na blockchain ↗
            </a>
            <p className="text-sm text-[#0a0a0a]/70 mt-2">
              Nenhuma senha. Só teu rosto autorizou — e o contrato verificou on-chain.
            </p>
          </div>
        )}

        <div className="mt-8">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#0a0a0a]/55 mb-3">┃ log</div>
          <div className="bg-[#0a0a0a] text-[#b5e853] font-mono text-xs p-4 min-h-[180px] whitespace-pre-wrap break-all">
            {log.length === 0 ? "// toca em 1 · Criar minha carteira\n" : log.join("\n")}
          </div>
        </div>

        <p className="mt-6 text-xs text-[#0a0a0a]/45 leading-relaxed">
          {network === "PUBLIC"
            ? "Mainnet — dinheiro real. O relayer patrocina só a taxa de rede; teu dinheiro fica na carteira que só teu rosto move."
            : "Testnet (dinheiro de mentira, grátis) — pra provar o fluxo no seu aparelho."}
          {" "}Precisa de Face ID / Touch ID / digital + navegador moderno.
        </p>
      </main>
    </div>
  );
}
