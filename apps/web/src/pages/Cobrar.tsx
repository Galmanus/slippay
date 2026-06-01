// /cobrar — merchant side. Enter an amount, get a QR the customer scans and
// pays with their face. Testnet: a fresh recipient is friendbot-funded so the
// payment can land. (Production: this is the merchant's real receive address.)

import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Keypair } from "@stellar/stellar-sdk";
import QRCode from "qrcode";
import { Logo } from "../components/Logo";
import { encodeRequest } from "../lib/slippayqr";
import { friendbotFund } from "../lib/passkey";

const PRESETS = [0.1, 0.3, 0.5, 1];

export default function Cobrar() {
  const [recipient, setRecipient] = useState<Keypair | null>(null);
  const [ready, setReady] = useState(false);
  const [amount, setAmount] = useState(0.3);
  const [qr, setQr] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const gen = useRef(false);

  useEffect(() => {
    if (gen.current) return;
    gen.current = true;
    const r = Keypair.random();
    setRecipient(r);
    friendbotFund(r.publicKey()).then(() => setReady(true)).catch((e) => setErr((e as Error).message));
  }, []);

  useEffect(() => {
    if (!recipient) return;
    const uri = encodeRequest({
      to: recipient.publicKey(),
      amount: String(Math.round(amount * 1e7)),
      label: "Slippay",
    });
    QRCode.toDataURL(uri, { margin: 1, width: 320, color: { dark: "#0a0a0a", light: "#f1eee7" } })
      .then(setQr).catch((e) => setErr((e as Error).message));
  }, [recipient, amount]);

  return (
    <div className="min-h-screen bg-[#f1eee7] text-[#0a0a0a] grain overflow-x-hidden">
      <header className="px-5 md:px-10 py-5 flex items-center justify-between border-b border-[#0a0a0a]/8">
        <Logo />
        <Link to="/pay" className="text-[10px] uppercase tracking-[0.22em] hover:opacity-60">Pagar →</Link>
      </header>
      <main className="max-w-[560px] mx-auto px-5 md:px-10 pt-10 pb-24 text-center">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#0a0a0a]/55 mb-4">
          ┃ cobrar · mostre o QR pro cliente
        </div>
        <h1 className="text-4xl md:text-5xl font-medium tracking-[-0.04em] leading-[0.98]">
          Quanto cobrar?<span className="inline-block w-2.5 h-2.5 bg-[#b5e853] ml-2 align-baseline" />
        </h1>

        <div className="mt-8 flex flex-wrap justify-center gap-2">
          {PRESETS.map((p) => (
            <button key={p} onClick={() => setAmount(p)}
              className={"lift px-5 py-3 text-sm font-mono tabular-nums border transition-colors " +
                (amount === p ? "bg-[#0a0a0a] text-[#f1eee7] border-[#0a0a0a]" : "border-[#0a0a0a]/25 hover:border-[#0a0a0a]/60")}>
              {p} XLM
            </button>
          ))}
        </div>

        <div className="mt-10 inline-flex flex-col items-center">
          {qr ? (
            <img src={qr} alt="QR de cobrança" className="w-[280px] h-[280px] border border-[#0a0a0a]/15" />
          ) : (
            <div className="w-[280px] h-[280px] border border-[#0a0a0a]/15 flex items-center justify-center text-xs text-[#0a0a0a]/45">gerando…</div>
          )}
          <div className="mt-5 text-2xl font-medium tabular-nums">{amount} XLM</div>
          <div className="mt-2 text-[10px] uppercase tracking-[0.22em] font-mono"
            style={{ color: ready ? "#3f7d20" : "rgba(10,10,10,0.45)" }}>
            {err ? "✗ " + err : ready ? "● pronto pra receber" : "preparando…"}
          </div>
        </div>

        <p className="mt-10 text-xs text-[#0a0a0a]/45 leading-relaxed max-w-[44ch] mx-auto">
          O cliente abre <Link to="/pay" className="underline">/pay</Link>, aponta a câmera nesse QR, vê o
          valor e toca o rosto. Testnet — dinheiro de teste, grátis.
        </p>
      </main>
    </div>
  );
}
