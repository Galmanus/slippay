// /pay — REAL biometric payment on Stellar testnet, fully on your phone.
//
// "Criar conta" mints a device passkey (Face ID), deploys a smart-wallet bound
// to it, and funds it. "Pagar" moves XLM out — authorized ONLY by a live Face ID
// tap, verified on-chain by the wallet's __check_auth. No seed phrase, no typing.
//
// Testnet path is fully client-side: a throwaway friendbot-funded account pays
// the network fees (free testnet XLM). Mainnet would use a server relayer.

import { useState } from "react";
import { Link } from "react-router-dom";
import { Keypair } from "@stellar/stellar-sdk";
import { Logo } from "../components/Logo";
import {
  createPasskey, deployPasskeyWallet, friendbotFund, fundWalletXlm,
  payWithBiometric, type PasskeyHandle,
} from "../lib/passkey";

// Smart-wallet wasm on testnet WITH on-chain WebAuthn verification.
const WASM_HASH_HEX = "497adb62a98134658ab04edb8a7a4dd9b008432bfa5c0a38f8ec95cc07f5fe83";
function hexToBytes(h: string): Uint8Array {
  const out = new Uint8Array(h.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(h.slice(i * 2, i * 2 + 2), 16);
  return out;
}
function short(s: string, h = 6, t = 6) { return s.length <= h + t + 1 ? s : `${s.slice(0, h)}…${s.slice(-t)}`; }

export default function PayDemo() {
  const [handle, setHandle] = useState<PasskeyHandle | null>(null);
  const [feeSource, setFeeSource] = useState<Keypair | null>(null);
  const [wallet, setWallet] = useState<string | null>(null);
  const [recipient, setRecipient] = useState<Keypair | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [payHash, setPayHash] = useState<string | null>(null);

  const add = (s: string) => setLog((l) => [...l, s]);

  async function onCreateAccount() {
    setBusy(true); setPayHash(null); setLog([]);
    try {
      add("preparando conta de rede (testnet, grátis)…");
      const fee = Keypair.random();
      await friendbotFund(fee.publicKey());
      setFeeSource(fee);
      const rcpt = Keypair.random();
      await friendbotFund(rcpt.publicKey());
      setRecipient(rcpt);
      add("✅ rede pronta");

      add("toca o Face ID pra criar tua passkey…");
      const h = await createPasskey("slippay");
      setHandle(h);
      add(`✅ passkey criada (sua chave, ninguém mais tem)`);

      add("criando tua carteira on-chain (uns segundos)…");
      const w = await deployPasskeyWallet({
        network: "TESTNET", wasmHash: hexToBytes(WASM_HASH_HEX),
        feeSource: fee, pubKey: h.pubKey, credId: h.credId,
        admin: fee.publicKey(), maxAbsolutePerCharge: "1000000000",
      });
      setWallet(w);
      add(`✅ carteira: ${short(w)}`);

      add("depositando 2 XLM de teste na carteira…");
      await fundWalletXlm({ network: "TESTNET", feeSource: fee, walletId: w, amount: "20000000" });
      add("✅ conta pronta. Agora toca em PAGAR.");
    } catch (e) { add(`✗ ${(e as Error).message}`); } finally { setBusy(false); }
  }

  async function onPay() {
    if (!handle || !feeSource || !wallet || !recipient) return;
    setBusy(true); setPayHash(null);
    try {
      add("toca o Face ID pra autorizar o pagamento de 0,3 XLM…");
      const hash = await payWithBiometric({
        network: "TESTNET", walletId: wallet, recipient: recipient.publicKey(),
        amount: "3000000", feeSource, credId: handle.credId,
      });
      setPayHash(hash);
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
          ┃ pagar com o rosto · testnet · no seu celular
        </div>
        <h1 className="text-4xl md:text-6xl font-medium tracking-[-0.04em] leading-[0.98]">
          Paga com o rosto.<span className="inline-block w-2.5 h-2.5 bg-[#b5e853] ml-2 align-baseline" />
        </h1>
        <p className="mt-6 text-base text-[#0a0a0a]/75 leading-relaxed max-w-[52ch]">
          Sem senha, sem frase de doze palavras. Cria a conta com Face ID, e o
          pagamento sai só quando teu rosto autoriza — verificado na blockchain.
        </p>

        <div className="mt-10 flex flex-col gap-3 max-w-[360px]">
          <button onClick={onCreateAccount} disabled={busy}
            className="lift px-6 py-4 bg-[#0a0a0a] text-[#f1eee7] text-[11px] uppercase tracking-[0.22em] disabled:opacity-40">
            1 · Criar minha conta (Face ID)
          </button>
          <button onClick={onPay} disabled={busy || !wallet}
            className="lift px-6 py-4 bg-[#b5e853] text-[#0a0a0a] text-[11px] uppercase tracking-[0.22em] font-medium disabled:opacity-40">
            2 · Pagar 0,3 XLM com o rosto
          </button>
        </div>

        {payHash && (
          <div className="mt-8 p-5 border" style={{ borderColor: "#3f7d20" }}>
            <div className="text-lg font-medium" style={{ color: "#3f7d20" }}>✅ Pago com o rosto. O dinheiro se moveu.</div>
            <a href={`https://stellar.expert/explorer/testnet/tx/${payHash}`} target="_blank" rel="noopener noreferrer"
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
            {log.length === 0 ? "// toca em 1 · Criar minha conta\n" : log.join("\n")}
          </div>
        </div>

        <p className="mt-6 text-xs text-[#0a0a0a]/45 leading-relaxed">
          Testnet (dinheiro de mentira, grátis) — pra provar o fluxo no seu
          aparelho. Precisa de Face ID / Touch ID / digital + navegador moderno.
          O setup leva uns segundos; o pagamento é instantâneo.
        </p>
      </main>
    </div>
  );
}
