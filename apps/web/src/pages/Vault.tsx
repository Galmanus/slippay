import { useCallback, useEffect, useState } from "react";
import { Logo } from "../components/Logo.tsx";
import { connectWallet, signTx } from "../lib/wallet.ts";
import { submitSignedTx } from "../lib/stellar.ts";
import * as vault from "../lib/defindex.ts";
import { loadAccount, type Account } from "../lib/account.ts";
import { cofrinhoPasskeyEnabled, moveCofrinho } from "../lib/cofrinho.ts";
import { hexToBytesSafe } from "../lib/passkeyHex.ts";
import {
  earnedStroops, getBasis, recordDeposit, recordWithdraw, stroopsToDisplay,
} from "../lib/cofreYield.ts";

type Mode = "deposit" | "withdraw";

const NETWORK = (import.meta.env.VITE_STELLAR_NETWORK ?? "PUBLIC").toUpperCase() as "TESTNET" | "PUBLIC";
const EXPLORER = NETWORK === "PUBLIC" ? "public" : "testnet";
const RELAYER_BASE = (import.meta.env.VITE_RELAYER_BASE as string | undefined)
  ?? "https://api.slippay.cc/api/v1/relayer";

export default function Vault() {
  const [wallet, setWallet] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("deposit");
  const [amount, setAmount] = useState("");
  const [pos, setPos] = useState<vault.VaultPosition | null>(null);
  const [apy, setApy] = useState<number | null>(null);
  // Concrete earnings, computed from on-chain value vs a locally-tracked basis.
  // usdcToStroops throws on "0" (rejects <= 0), and a throw in render crashes
  // the component — parse safely here.
  const basis = wallet ? getBasis(wallet) : null;
  const currentStroops = Math.round(Number(pos?.usdc ?? "0") * 10_000_000);
  const earned = basis && Number.isFinite(currentStroops)
    ? earnedStroops(currentStroops, basis.basisStroops) : null;
  const [txHash, setTxHash] = useState<string | null>(null);
  // Prefer the passkey account (the "mãe" flow: Face ID, no browser wallet). Only
  // fall back to an external wallet when there is no passkey account on device.
  const [acct] = useState<Account | null>(() => loadAccount());
  const passkeyFlow = Boolean(acct) && cofrinhoPasskeyEnabled();

  const refresh = useCallback(async (user: string) => {
    try {
      const [p, a] = await Promise.all([vault.getPosition(user), vault.getApy().catch(() => null)]);
      setPos(p);
      setApy(a);
    } catch (e) { setError(msg(e)); }
  }, []);

  useEffect(() => { if (wallet) void refresh(wallet); }, [wallet, refresh]);
  // A passkey account is already "connected" — its wallet id is the account.
  useEffect(() => { if (passkeyFlow && acct) setWallet(acct.walletId); }, [passkeyFlow, acct]);

  async function doConnect() {
    setError(null);
    try { setWallet(await connectWallet()); } catch (e) { setError(msg(e)); }
  }

  async function doSubmit() {
    setError(null); setTxHash(null); setBusy(true);
    try {
      if (!wallet) throw new Error("abra o cofre primeiro");
      if (vault.usdcToStroops(amount) <= 0) throw new Error("informe um valor");
      let hash: string;
      if (passkeyFlow && acct) {
        // Face ID authorizes; the relayer sponsors gas. No seed, no extension.
        const info = await fetch(`${RELAYER_BASE}/info`).then((r) => r.json()).catch(() => ({}));
        if (!info.sponsor) throw new Error("Sistema acordando. Tente de novo em instantes.");
        // Snapshot the position value before a withdrawal so we can reduce the
        // basis proportionally (keeps "rendeu" honest across partial withdraws).
        const valueBefore = Math.round(Number(pos?.usdc ?? "0") * 10_000_000);
        hash = await moveCofrinho({
          acct, mode, usdcAmount: amount, relayerBase: RELAYER_BASE, sponsor: info.sponsor,
          credId: acct.credIdHex ? hexToBytesSafe(acct.credIdHex) : undefined,
        });
        const amtStroops = vault.usdcToStroops(amount);
        if (mode === "deposit") recordDeposit(wallet, amtStroops, Date.now());
        else recordWithdraw(wallet, valueBefore, amtStroops);
      } else {
        const xdr = mode === "deposit"
          ? await vault.buildDepositTx(wallet, amount)
          : await vault.buildWithdrawTx(wallet, amount);
        const signed = await signTx(xdr);
        ({ hash } = await submitSignedTx(NETWORK, signed));
      }
      setTxHash(hash);
      setAmount("");
      await refresh(wallet);
    } catch (e) { setError(msg(e)); }
    finally { setBusy(false); }
  }

  return (
    <div className="min-h-screen bg-[#f1eee7] text-[#0a0a0a] flex flex-col">
      <header className="max-w-[1400px] w-full mx-auto px-8 md:px-12 py-8 flex items-center justify-between">
        <Logo />
        <div className="text-[10px] uppercase tracking-[0.18em] text-[#0a0a0a]/55">Cofre de dólar</div>
      </header>

      <main className="flex-1 flex items-center">
        <div className="max-w-[1400px] w-full mx-auto px-8 md:px-12 grid md:grid-cols-12 gap-8 md:gap-16 py-16 md:py-24">
          <div className="md:col-span-3 text-xs uppercase tracking-[0.18em] text-[#0a0a0a]/55">
            <span className="inline-block w-3 h-3 bg-[#b5e853] mr-2 align-middle" />
            001. Seu dinheiro, só seu
          </div>

          <div className="md:col-span-9 max-w-xl">
            {acct && !passkeyFlow ? (
              // Has a passkey account, but the cofrinho isn't switched on yet.
              // Honest holding state — never bounce a normal user to a browser wallet.
              <>
                <p className="text-sm text-[#0a0a0a]/70 mb-2 leading-relaxed">
                  Seu dinheiro já está seguro na sua conta. O cofre de dólar que rende está
                  chegando: em breve você vai poder guardar e ver render, com um toque.
                </p>
                <div className="mt-6 text-[10px] uppercase tracking-[0.18em] text-[#0a0a0a]/45">Chegando</div>
              </>
            ) : !wallet ? (
              <>
                <p className="text-sm text-[#0a0a0a]/70 mb-6 leading-relaxed">
                  Um cofre de dólar que é só seu. Só você guarda, só você saca, a qualquer
                  momento. A Slippay nunca segura o seu dinheiro.
                </p>
                <button onClick={doConnect}
                  className="w-full border border-[#0a0a0a] py-5 text-sm uppercase tracking-[0.18em] hover:bg-[#0a0a0a] hover:text-[#f1eee7]">
                  Abrir meu cofre
                </button>
              </>
            ) : (
              <>
                {/* position */}
                <div className="text-xs uppercase tracking-[0.18em] text-[#0a0a0a]/55 mb-2">Seu dinheiro no cofre</div>
                <div className="text-6xl md:text-7xl font-medium tabular-nums tracking-[-0.04em] leading-[0.9]">
                  {pos ? `$ ${pos.usdc}` : "—"}
                </div>
                {/* concrete earnings — the tangible "está rendendo", on-chain truth */}
                {earned !== null && basis && basis.basisStroops > 0 && (
                  <div className="mt-4 flex items-baseline gap-6 text-sm">
                    <div>
                      <span className="text-[#0a0a0a]/50">Você guardou </span>
                      <span className="tabular-nums">$ {stroopsToDisplay(basis.basisStroops)}</span>
                    </div>
                    <div>
                      <span className="text-[#0a0a0a]/50">Rendeu </span>
                      <span className={`tabular-nums ${earned > 0 ? "text-[#2f7d32]" : ""}`}>
                        + $ {stroopsToDisplay(earned)}
                      </span>
                    </div>
                  </div>
                )}
                <div className="mt-3 text-[10px] uppercase tracking-[0.18em] text-[#0a0a0a]/55">
                  {passkeyFlow
                    ? "Sua conta · aprova com o seu rosto ou digital"
                    : <>Conectado · <span className="font-mono normal-case">{wallet.slice(0,8)}...{wallet.slice(-4)}</span></>}
                </div>

                {/* mode toggle */}
                <div className="mt-10 flex gap-2 text-sm uppercase tracking-[0.18em]">
                  {(["deposit","withdraw"] as Mode[]).map(m => (
                    <button key={m} onClick={() => { setMode(m); setError(null); }}
                      className={`flex-1 py-3 border ${mode === m ? "bg-[#0a0a0a] text-[#f1eee7] border-[#0a0a0a]" : "border-[#0a0a0a]/20 text-[#0a0a0a]/60"}`}>
                      {m === "deposit" ? "Depositar" : "Sacar"}
                    </button>
                  ))}
                </div>

                <input type="text" inputMode="decimal" value={amount}
                  onChange={e => setAmount(e.target.value)} disabled={busy}
                  placeholder="valor em dólares"
                  className="mt-4 w-full bg-transparent border-b border-[#0a0a0a]/30 text-4xl tabular-nums py-2 disabled:opacity-60" />

                <button onClick={doSubmit} disabled={busy || !amount.trim()}
                  className="mt-6 w-full bg-[#0a0a0a] text-[#f1eee7] py-5 text-sm uppercase tracking-[0.18em] hover:bg-[#1a1a1a] disabled:opacity-50">
                  {busy ? "Processando..." : mode === "deposit" ? "Guardar dólares" : "Sacar dólares"}
                </button>

                {/* honest yield disclosure — describes the asset, never promises a return */}
                <div className="mt-8 border-l-2 border-[#0a0a0a]/20 pl-4 text-xs text-[#0a0a0a]/60 leading-relaxed space-y-1">
                  {(() => {
                    // The indexer may report apy as a fraction (0.04) or as
                    // percentage points (4). Normalize, then refuse to display
                    // anything outside a sane USDC-lending band — a format
                    // surprise must never show "400%" to a normal person.
                    if (apy === null || apy <= 0) return null;
                    const pct = apy <= 1 ? apy * 100 : apy;
                    if (pct <= 0 || pct > 30) return null;
                    return <div>Rende cerca de <span className="tabular-nums">{pct.toFixed(1)}%</span> ao ano (estimativa, varia todo dia).</div>;
                  })()}
                  <div>
                    O rendimento varia e não é garantido: pode subir, cair, e dá até pra perder
                    parte do valor. Não é poupança nem investimento oferecido pela Slippay.
                  </div>
                </div>

                {txHash && (
                  <div className="mt-6 border-l-2 border-[#b5e853] pl-4">
                    <div className="text-[10px] uppercase tracking-[0.18em] flex items-center gap-2">
                      <span className="inline-block w-1.5 h-1.5 bg-[#b5e853]" /> Confirmado · comprovante público
                    </div>
                    <a className="text-xs font-mono mt-2 block break-all hover:opacity-60"
                       href={`https://stellar.expert/explorer/${EXPLORER}/tx/${txHash}`} target="_blank" rel="noreferrer">
                      {txHash}
                    </a>
                  </div>
                )}
              </>
            )}

            {error && <div className="mt-6 text-xs uppercase tracking-[0.18em] text-red-700 border-l-2 border-red-700 pl-3">{error}</div>}
          </div>
        </div>
      </main>

      <footer className="border-t border-[#0a0a0a]/10">
        <div className="max-w-[1400px] mx-auto px-8 md:px-12 py-6 text-[10px] uppercase tracking-[0.18em] text-[#0a0a0a]/55">
          Seu dinheiro fica com você · todo movimento tem comprovante público
        </div>
      </footer>
    </div>
  );
}

function msg(e: unknown): string { return e instanceof Error ? e.message : "erro desconhecido"; }
