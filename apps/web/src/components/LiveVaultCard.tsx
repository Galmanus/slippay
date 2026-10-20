// LiveVaultCard — the hero object: Slippay's AgentVault on Arc mainnet, read live from the
// visitor's browser (public RPC). Every number on it comes from the chain at the block it
// prints; while loading it shows nothing rather than a placeholder number. Behind it, a second
// floating chip teases the attack lab further down the page (a real refusal, linked).
import { useEffect, useState } from "react";
import { addrUrl, readVault, short, usdc, VAULT, type VaultSnapshot } from "../lib/arcLive.ts";

type Lang = "pt" | "en";
const T = {
  pt: {
    tag: "AgentVault · Arc mainnet", live: "ao vivo", now: "no cofre agora", perTx: "Teto por pagamento", perDay: "Teto por dia",
    settled: "Pagamentos liquidados", attest: "Atestado", attestAll: "em todo pagamento", agents: (n: number) => `${n} agente${n === 1 ? "" : "s"} com limite`,
    read: "lido ao vivo no bloco", loading: "lendo a Arc…", down: "a rede não respondeu, tentando de novo",
    back: "Tentativa de saque", backV: "RECUSADA", backSub: "fora da lista do agente", backCta: "tente você ↓",
  },
  en: {
    tag: "AgentVault · Arc mainnet", live: "live", now: "in the vault now", perTx: "Per-payment cap", perDay: "Daily cap",
    settled: "Payments settled", attest: "Attested", attestAll: "on every payment", agents: (n: number) => `${n} agent${n === 1 ? "" : "s"} with limits`,
    read: "read live at block", loading: "reading Arc…", down: "the network didn't answer, retrying",
    back: "Withdrawal attempt", backV: "REFUSED", backSub: "not on the agent's list", backCta: "try it yourself ↓",
  },
} as const;

const fmtBlock = (b: bigint) => Number(b).toLocaleString("pt-BR");

export function LiveVaultCard({ lang = "pt" }: { lang?: Lang }) {
  const t = T[lang];
  const [v, setV] = useState<VaultSnapshot | null>(null);
  const [down, setDown] = useState(false);

  useEffect(() => {
    let on = true;
    const tick = async () => {
      try {
        const s = await readVault();
        if (on) { setV(s); setDown(false); }
      } catch {
        if (on) setDown(true);
      }
    };
    tick();
    const id = setInterval(tick, 8000);
    return () => { on = false; clearInterval(id); };
  }, []);

  const row = "flex items-center justify-between py-3 border-t border-white/12 text-[13px]";
  return (
    <div className="relative w-full max-w-[400px] mx-auto">
      {/* glow */}
      <div aria-hidden className="absolute -inset-10 rounded-full bg-[#002FA7]/25 blur-3xl" />

      {/* front card: the vault, live */}
      <div className="relative rounded-[28px] overflow-hidden text-white shadow-[0_40px_100px_-30px_rgba(0,47,167,.7)]"
        style={{ background: "radial-gradient(130% 120% at 8% 0%, #3a6bff 0%, #002FA7 40%, #00175a 100%)" }}>
        <div aria-hidden className="absolute inset-0 opacity-[0.13]"
          style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
        <div className="relative px-7 pt-7 pb-6">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase tracking-[0.24em] text-white/70">{t.tag}</span>
            <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-[#9df0c4]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#9df0c4] animate-pulse" />{t.live}
            </span>
          </div>
          <a href={addrUrl(VAULT)} target="_blank" rel="noreferrer" className="mt-1 inline-block font-mono text-[11px] text-white/55 hover:text-white">{short(VAULT)} ↗</a>

          <div className="mt-7 flex items-end gap-3">
            <span className="font-black tracking-[-0.05em] leading-none text-[64px]">{v ? `US$ ${usdc(v.balance)}` : "US$ ·"}</span>
          </div>
          <div className="mt-2 text-[13px] text-white/65">{v ? `${t.now} · ${t.agents(v.agents)}` : t.now}</div>

          <div className="mt-7">
            <div className={row}><span className="text-white/60">{t.perTx}</span><span className="font-semibold">{v ? `US$ ${usdc(v.perTxCap)}` : "·"}</span></div>
            <div className={row}><span className="text-white/60">{t.perDay}</span><span className="font-semibold">{v ? `US$ ${usdc(v.windowCap)}` : "·"}</span></div>
            <div className={row}><span className="text-white/60">{t.settled}</span><span className="font-semibold">{v ? v.settled.toString() : "·"}</span></div>
            <div className={row}><span className="text-white/60">{t.attest}</span><span className="font-semibold">{v ? (v.everySpendAttested ? t.attestAll : "·") : "·"}</span></div>
          </div>

          <div className="mt-5 flex items-center gap-2 font-mono text-[11px] text-[#9df0c4]">
            {v && !down ? (<>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden><circle cx="12" cy="12" r="10" /><path d="m7.5 12.5 3 3 6-6.5" /></svg>
              <span>{t.read} {fmtBlock(v.block)}</span>
            </>) : <span className="text-white/60">{down ? t.down : t.loading}</span>}
          </div>
        </div>
      </div>
      {/* floating chip: a real refusal from the mainnet red-team, links to the attack lab */}
      <a href="#ataque" className="group absolute z-20 -left-2 md:-left-14 top-[calc(100%-14px)] w-[236px] -rotate-[4deg] rounded-2xl bg-white border border-[#0a0a0a]/10 shadow-[0_24px_60px_-20px_rgba(10,10,10,.45)] px-5 py-4 transition-transform duration-300 hover:rotate-0 hover:-translate-y-1">
        <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-[#0a0a0a]/45">{t.back}</div>
        <div className="mt-2 flex items-center gap-2">
          <span className="rounded-full bg-[#ffe9e7] text-[#c0281c] font-mono text-[10px] font-semibold tracking-[0.12em] px-2.5 py-1">{t.backV}</span>
          <span className="font-mono text-[11px] text-[#0a0a0a]/55 line-through">US$ 0,000001</span>
        </div>
        <div className="mt-2 text-[12px] text-[#0a0a0a]/60">{t.backSub}</div>
        <div className="mt-1 font-mono text-[10px] text-[#002FA7] group-hover:underline">{t.backCta}</div>
      </a>

    </div>
  );
}
