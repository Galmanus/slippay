// AttackLab — "try to rob the vault". Each button builds a real attack on Slippay's AgentVault
// on Arc mainnet and asks the network what would happen (eth_call at the latest block, from the
// visitor's browser). Nothing is signed with a key of ours and nothing is broadcast. The vault's
// own refusal comes back with the block it was read at. If the network ever said a request
// would settle, the terminal prints that too: it does not pretend.
import { useEffect, useMemo, useRef, useState } from "react";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { MERCHANT, PILOT_AGENT, REDTEAM_REPORT, SETTLED_TX, runAttack, short, type AttackKind } from "../lib/arcLive.ts";

type Lang = "pt" | "en";
type Line = { k: "cmd" | "ok" | "bad" | "info"; text: string };

const T = {
  pt: {
    stamp: "ataque", h: "Tente roubar o cofre.",
    body: "Daqui mesmo. Cada botão monta um ataque de verdade contra o cofre na rede principal da Arc e pergunta à rede o que aconteceria. Seu navegador fala direto com a Arc. Nada é transmitido, nada sai do cofre.",
    attacks: {
      payMe: ["Mandar o dinheiro pra mim", (v: string) => `pagar 0,000001 USDC do agente ${short(PILOT_AGENT)} para você (${short(v)})`],
      overCap: ["Passar do teto", () => `pagar 0,200001 USDC ao comerciante ${short(MERCHANT)} (teto: 0,20)`],
      wrongKey: ["Assinar com a minha chave", () => "ordem de pagamento de 0,000001 USDC assinada por uma chave sua, não pela do agente"],
      replay: ["Repetir um pagamento antigo", () => `reenviar, byte a byte, o pagamento real de 19/10 (${short(SETTLED_TX)})`],
    } as Record<AttackKind, [string, (v: string) => string]>,
    why: {
      RecipientNotAllowed: "você não está na lista de quem o agente pode pagar",
      AmountExceedsCap: "acima do teto por pagamento",
      BadSignature: "a assinatura não é a do agente",
      Expired: "ordem vencida, e o número dela já foi usado",
      BadAttestation: "falta o atestado de que o agente não foi comprometido",
    } as Record<string, string>,
    keyUsed: "chave usada", refused: "RECUSADO", block: "bloco", settles: "ATENÇÃO: a rede disse que isto passaria", fail: "a rede não respondeu, tente de novo",
    tty: "tty · arc mainnet · ao vivo", count: (n: number, r: number) => `ataques ${n} · recusados ${r}`,
    idle: "escolha um ataque", nothing: "nada foi transmitido · simulação eth_call contra o estado real",
    stolen: "E se roubarem a chave do agente? Fizemos isso na mainnet: 10 ataques, 10 recusados.", report: "Ler o relatório ↗",
  },
  en: {
    stamp: "attack", h: "Try to rob the vault.",
    body: "Right here. Each button builds a real attack against the vault on Arc mainnet and asks the network what would happen. Your browser talks straight to Arc. Nothing is broadcast, nothing leaves the vault.",
    attacks: {
      payMe: ["Send the money to me", (v: string) => `pay 0.000001 USDC from agent ${short(PILOT_AGENT)} to you (${short(v)})`],
      overCap: ["Go over the cap", () => `pay 0.200001 USDC to merchant ${short(MERCHANT)} (cap: 0.20)`],
      wrongKey: ["Sign with my own key", () => "a 0.000001 USDC payment order signed by a key of yours, not the agent's"],
      replay: ["Replay an old payment", () => `resend, byte for byte, the real 19/10 payment (${short(SETTLED_TX)})`],
    } as Record<AttackKind, [string, (v: string) => string]>,
    why: {
      RecipientNotAllowed: "you are not on the list of who the agent may pay",
      AmountExceedsCap: "above the per-payment cap",
      BadSignature: "the signature isn't the agent's",
      Expired: "the order has expired, and its number was already used",
      BadAttestation: "no attestation that the agent is uncompromised",
    } as Record<string, string>,
    keyUsed: "key used", refused: "REFUSED", block: "block", settles: "WARNING: the network said this would settle", fail: "the network didn't answer, try again",
    tty: "tty · arc mainnet · live", count: (n: number, r: number) => `attacks ${n} · refused ${r}`,
    idle: "pick an attack", nothing: "nothing was broadcast · eth_call simulation against real state",
    stolen: "What if the agent's key is stolen? We did that on mainnet: 10 attacks, 10 refused.", report: "Read the report ↗",
  },
} as const;

const ORDER: AttackKind[] = ["payMe", "overCap", "wrongKey", "replay"];

export function AttackLab({ lang = "pt", n = "005" }: { lang?: Lang; n?: string }) {
  const t = T[lang];
  const visitor = useMemo(() => privateKeyToAccount(generatePrivateKey()).address, []);
  const [lines, setLines] = useState<Line[]>([]);
  const [busy, setBusy] = useState<AttackKind | null>(null);
  const [tally, setTally] = useState({ n: 0, r: 0 });
  const box = useRef<HTMLDivElement>(null);

  const push = (l: Line[]) => {
    setLines((cur) => [...cur, ...l].slice(-14));
    requestAnimationFrame(() => box.current?.scrollTo({ top: box.current.scrollHeight, behavior: "smooth" }));
  };

  const fire = async (k: AttackKind) => {
    if (busy) return;
    setBusy(k);
    push([{ k: "cmd", text: `$ ${t.attacks[k][1](visitor)}` }]);
    try {
      const r = await runAttack(k, visitor);
      const blk = Number(r.block).toLocaleString("pt-BR");
      if (k === "wrongKey") push([{ k: "info", text: `  ${t.keyUsed}: ${short(r.detail)}` }]);
      if (r.error === "SETTLES") {
        push([{ k: "bad", text: `  ↳ ${t.block} ${blk} · ${t.settles}` }]);
        setTally((x) => ({ n: x.n + 1, r: x.r }));
      } else {
        push([{ k: "ok", text: `  ↳ ${t.block} ${blk} · ${t.refused} · ${r.error}` }, { k: "info", text: `    ${t.why[r.error] ?? ""}` }]);
        setTally((x) => ({ n: x.n + 1, r: x.r + 1 }));
      }
    } catch {
      push([{ k: "bad", text: `  ↳ ${t.fail}` }]);
    } finally {
      setBusy(null);
    }
  };

  // The first attack runs by itself, once, when the lab scrolls into view: a real refusal, not a
  // recorded one. Skipped for reduced motion (the visitor can still press any button).
  const root = useRef<HTMLDivElement>(null);
  const started = useRef(false);
  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches || !root.current) return;
    const io = new IntersectionObserver((ents) => {
      if (ents.some((e) => e.isIntersecting) && !started.current) { started.current = true; void fire("payMe"); io.disconnect(); }
    }, { threshold: 0.35 });
    io.observe(root.current);
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const color: Record<Line["k"], string> = { cmd: "text-[#f1eee7]", ok: "text-[#ff8a7a]", bad: "text-[#ffd166]", info: "text-[#f1eee7]/45" };

  return (
    <div ref={root} className="grid md:grid-cols-[0.9fr_1.1fr] md:grid-rows-[auto_1fr] gap-10 md:gap-x-14 md:gap-y-8 items-start">
      {/* mobile order: text, terminal, buttons (so a tap shows its result without scrolling) */}
      <div className="md:col-start-1 md:row-start-1">
        <div className="flex items-baseline gap-3 font-mono text-[11px] uppercase tracking-[0.3em] text-[#f1eee7]/40">
          <span className="text-[#5B82FF]">{n}</span><span className="h-px w-8 bg-[#f1eee7]/30" /><span>{t.stamp}</span>
        </div>
        <h2 className="mt-8 font-black uppercase tracking-[-0.04em] leading-[0.88] text-[clamp(2.5rem,7vw,5rem)] max-w-[12ch]">{t.h}</h2>
        <p className="mt-6 text-lg text-[#f1eee7]/65 leading-relaxed max-w-[44ch]">{t.body}</p>
      </div>

      <div className="md:col-start-2 md:row-start-1 md:row-span-2 rounded-[22px] border border-[#f1eee7]/12 bg-[#0d0f14] shadow-[0_40px_100px_-40px_rgba(91,130,255,.45)] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#f1eee7]/10">
          <div className="flex gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#f1eee7]/15" /><span className="w-2.5 h-2.5 rounded-full bg-[#f1eee7]/15" /><span className="w-2.5 h-2.5 rounded-full bg-[#f1eee7]/15" /></div>
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#f1eee7]/40">{t.tty}</span>
        </div>
        <div className="px-5 pt-5 font-mono text-[11px] tracking-[0.12em] text-[#5B82FF] select-none" aria-hidden>
          == SLIPPAY AGENTVAULT · ARC MAINNET ==
        </div>
        <div ref={box} className="px-5 py-4 h-[260px] overflow-y-auto font-mono text-[12px] leading-[1.7]">
          {lines.length === 0 && <div className="text-[#f1eee7]/35">{t.idle}</div>}
          {lines.map((l, i) => <div key={i} className={`${color[l.k]} whitespace-pre-wrap break-all`}>{l.text}</div>)}
          {busy && <div className="text-[#f1eee7]/50 animate-pulse">…</div>}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 border-t border-[#f1eee7]/10 font-mono text-[10px] uppercase tracking-[0.16em] text-[#f1eee7]/40">
          <span>{t.count(tally.n, tally.r)}</span><span>{t.nothing}</span>
        </div>
      </div>

      <div className="md:col-start-1 md:row-start-2">
        <div className="flex flex-col gap-3">
          {ORDER.map((k) => (
            <button key={k} onClick={() => fire(k)} disabled={busy !== null}
              className={"group flex items-center justify-between rounded-2xl border px-5 py-4 text-left transition-all " +
                (busy === k ? "border-[#5B82FF] bg-[#5B82FF]/10" : "border-[#f1eee7]/15 hover:border-[#5B82FF] hover:bg-[#5B82FF]/[0.07]") +
                (busy && busy !== k ? " opacity-40" : "")}>
              <span className="font-semibold tracking-[-0.01em]">{t.attacks[k][0]}</span>
              <span className="font-mono text-[11px] text-[#5B82FF] group-hover:translate-x-1 transition-transform">{busy === k ? "…" : "→"}</span>
            </button>
          ))}
        </div>
        <div className="mt-8 text-[14px] text-[#f1eee7]/60 max-w-[44ch]">
          {t.stolen} <a href={REDTEAM_REPORT} target="_blank" rel="noreferrer" className="text-[#5B82FF] hover:underline whitespace-nowrap">{t.report}</a>
        </div>
      </div>

    </div>
  );
}
