// PolicyDemoAnimation — landing-page recreation of the /s/demo flow.
//
// Auto-loops a 5-phase sequence that mirrors the actual Slippay policy-checkout
// experience:
//   1. idle           · merchant logo + plan + "confirmar com biometria"
//   2. provisioning   · spinner + 3 steps (deploy → init → install)
//   3. active         · vault links + cancel + "simular cobrança" buttons
//   4. under_cap      · within-cap charge animates to "transferida"
//   5. over_cap       · over-cap charge animates to "rejeitada pelo bytecode"
//   → back to idle after a pause
//
// The external links point at REAL artifacts on Stellar testnet (a wallet +
// policy_installed event from earlier today's audit-verification run). Clicks
// land on stellar.expert. Not a mockup — re-enactment.
//
// Triggers on IntersectionObserver so off-screen viewers don't burn CPU. The
// section pauses when the tab is hidden.

import { useEffect, useRef, useState } from "react";
import { useLang } from "../lib/lang.ts";
import { homeCopy } from "../copy/home.tsx";

type Phase = "idle" | "provisioning" | "active" | "under_cap" | "over_cap";

const PHASE_DURATIONS_MS: Record<Phase, number> = {
  idle: 2400,
  provisioning: 6500,   // covers 3 steps animating in
  active: 3000,         // brief settle before enforcement
  under_cap: 3000,
  over_cap: 3500,
};

const ORDER: Phase[] = ["idle", "provisioning", "active", "under_cap", "over_cap"];

// Real on-chain artifacts (testnet · 2026-05-28 audit verification).
const REAL_WALLET = "CCFFQRFBKRQIZHQKHXREDFB42Y6NIP27ZHNWIND7FGZFR5V6BFFAMQEP";
const REAL_POLICY_TX = "2fd68a5b78284bdc2ce0b0c9569aee0736f4e42d52324f07a448643a2611c42e";
const STELLAR_EXPLORER = "https://stellar.expert/explorer/testnet";

function short(s: string, head = 6, tail = 6): string {
  if (s.length <= head + tail + 3) return s;
  return `${s.slice(0, head)}…${s.slice(-tail)}`;
}

export default function PolicyDemoAnimation() {
  const [lang] = useLang();
  const t = homeCopy[lang].demoLoop;

  const [phase, setPhase] = useState<Phase>("idle");
  const [inView, setInView] = useState(false);
  const [paused, setPaused] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<number | null>(null);

  // Intersection observer: only run animation when in viewport.
  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      entries => {
        for (const e of entries) setInView(e.isIntersecting);
      },
      { threshold: 0.25 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Pause when tab hidden.
  useEffect(() => {
    const onVis = () => setPaused(document.hidden);
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  // State machine: schedule the next phase after PHASE_DURATIONS_MS[current].
  useEffect(() => {
    if (!inView || paused) return;
    const dur = PHASE_DURATIONS_MS[phase];
    timeoutRef.current = window.setTimeout(() => {
      setPhase(prev => {
        const idx = ORDER.indexOf(prev);
        return ORDER[(idx + 1) % ORDER.length] ?? "idle";
      });
    }, dur);
    return () => {
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, [phase, inView, paused]);

  function manualReplay() {
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    setPhase("idle");
  }

  return (
    <section ref={sectionRef} className="bg-[#f1eee7] text-[#0a0a0a] py-20 md:py-28 border-t border-[#0a0a0a]/15">
      <div className="max-w-[1280px] mx-auto px-5 md:px-10">
        <div className="text-[10px] uppercase tracking-[0.22em] opacity-60 font-mono mb-5">
          {t.label}
        </div>
        <h2 className="text-3xl md:text-5xl lg:text-6xl font-medium tracking-tight leading-[1.05]">
          {t.h2}
        </h2>
        <p className="mt-6 max-w-[60ch] text-base md:text-lg opacity-75 leading-relaxed">
          {t.sub}
        </p>

        <div className="mt-12 md:mt-16 grid md:grid-cols-[1fr_auto] gap-10 md:gap-16 items-start">
          {/* The animated card */}
          <div className="bg-[#f1eee7] border border-[#0a0a0a]/15 p-6 md:p-10 max-w-[640px] mx-auto md:mx-0 w-full font-mono">
            <DemoCard phase={phase} t={t} />
          </div>

          {/* Side notes · what's happening */}
          <div className="text-[11px] uppercase tracking-[0.22em] opacity-60 space-y-3 max-w-[260px]">
            <SideNote active={phase === "idle"} label={`01 · ${t.s_provisioning.replace(/^./, (c: string) => c.toUpperCase())}`} />
            <SideNote active={phase === "provisioning"} label={`02 · ${t.s_deploy} → ${t.s_init} → ${t.s_install}`} />
            <SideNote active={phase === "active"} label={`03 · ${t.s_active}`} />
            <SideNote active={phase === "under_cap"} label={`04 · ${t.s_result_under}`} />
            <SideNote active={phase === "over_cap"} label={`05 · ${t.s_result_over}`} />
            <button onClick={manualReplay} className="mt-6 underline underline-offset-4 hover:opacity-100 transition-opacity">
              ↻ {t.s_replay}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function SideNote({ active, label }: { active: boolean; label: string }) {
  return (
    <div className={`flex gap-2 items-start transition-opacity duration-500 ${active ? "opacity-100" : "opacity-25"}`}>
      <span className={`inline-block w-2 h-2 mt-1 flex-shrink-0 ${active ? "bg-[#b5e853]" : "bg-[#0a0a0a]/30"}`} />
      <span className="leading-relaxed">{label}</span>
    </div>
  );
}

function DemoCard({ phase, t }: { phase: Phase; t: typeof homeCopy["pt"]["demoLoop"] }) {
  return (
    <>
      {/* Header always present */}
      <div className="text-[10px] uppercase tracking-[0.22em] opacity-60 mb-3">assinatura</div>
      <div className="text-2xl md:text-3xl tracking-tight">Slippay Demo Co.</div>
      <div className="mt-2 text-sm md:text-base opacity-70">Premium — USDC 29.00 / 30 dias</div>

      <div className="mt-8 min-h-[260px] relative">
        {phase === "idle" && <IdleState t={t} />}
        {phase === "provisioning" && <ProvisioningState t={t} />}
        {(phase === "active" || phase === "under_cap" || phase === "over_cap") && (
          <ActiveState phase={phase} t={t} />
        )}
      </div>
    </>
  );
}

function IdleState({ t }: { t: typeof homeCopy["pt"]["demoLoop"] }) {
  void t;
  return (
    <div className="animate-[fadeIn_400ms_ease-out]">
      <button
        disabled
        className="w-full bg-[#0a0a0a] text-[#f1eee7] py-5 text-sm md:text-base uppercase tracking-[0.22em] relative overflow-hidden cursor-default"
      >
        <span className="relative z-10">confirmar com biometria</span>
        <span className="absolute inset-0 bg-[#b5e853]/15 opacity-0 animate-[pulse-fade_2.4s_ease-in-out_infinite]" />
      </button>
      <div className="mt-5 flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] opacity-60">
        <LockIcon />
        <span>o que você está autorizando</span>
        <span className="opacity-50">▸</span>
      </div>
    </div>
  );
}

function ProvisioningState({ t }: { t: typeof homeCopy["pt"]["demoLoop"] }) {
  // Steps appear staggered.
  const steps: Array<{ label: string; delay: number }> = [
    { label: `· ${t.s_deploy}`, delay: 0 },
    { label: `· ${t.s_init}`, delay: 1500 },
    { label: `· ${t.s_install}`, delay: 3000 },
  ];
  const [revealed, setRevealed] = useState(0);
  useEffect(() => {
    setRevealed(0);
    const timers = steps.map((_, i) =>
      window.setTimeout(() => setRevealed(r => Math.max(r, i + 1)), steps[i]!.delay + 350),
    );
    return () => timers.forEach(window.clearTimeout);
  }, [t.s_deploy]); // re-run on phase enter (key changes when phase changes)

  return (
    <div className="animate-[fadeIn_400ms_ease-out]">
      <div className="flex items-center gap-3 mb-5">
        <Spinner />
        <span className="text-[10px] uppercase tracking-[0.22em]">
          {t.s_provisioning}
        </span>
      </div>
      <div className="space-y-2 text-sm opacity-80">
        {steps.map((s, i) => (
          <div
            key={i}
            className="transition-opacity duration-500"
            style={{ opacity: revealed > i ? 1 : 0 }}
          >
            {s.label}
          </div>
        ))}
      </div>
      <div className="mt-6 text-[10px] uppercase tracking-[0.22em] opacity-50">
        ~25s · Stellar testnet
      </div>
    </div>
  );
}

function ActiveState({
  phase,
  t,
}: {
  phase: "active" | "under_cap" | "over_cap";
  t: typeof homeCopy["pt"]["demoLoop"];
}) {
  return (
    <div className="animate-[fadeIn_400ms_ease-out]">
      <div className="flex items-center gap-3 mb-5">
        <span className="inline-block w-2 h-2 bg-[#b5e853]" />
        <span className="text-[10px] uppercase tracking-[0.22em]">
          {t.s_active}
        </span>
      </div>

      <div className="space-y-1.5 text-[10px] uppercase tracking-[0.22em] mb-7">
        <a
          href={`${STELLAR_EXPLORER}/contract/${REAL_WALLET}`}
          target="_blank"
          rel="noopener noreferrer"
          className="block underline underline-offset-4 hover:opacity-60"
        >
          {t.s_vault} · {short(REAL_WALLET)} ↗
        </a>
        <a
          href={`${STELLAR_EXPLORER}/tx/${REAL_POLICY_TX}`}
          target="_blank"
          rel="noopener noreferrer"
          className="block underline underline-offset-4 hover:opacity-60"
        >
          {t.s_event} · {short(REAL_POLICY_TX)} ↗
        </a>
        <div className="opacity-50 normal-case tracking-normal text-[11px] pt-1">
          deploy 7523ms · init 8965ms · install 10022ms
        </div>
      </div>

      <div className="border-t border-[#0a0a0a]/15 pt-5">
        <div className="text-[10px] uppercase tracking-[0.22em] opacity-60 mb-3">
          {t.s_enforcement_label}
        </div>
        <div className="flex flex-col gap-2 text-[10px] uppercase tracking-[0.22em]">
          <ChargeButton
            label={t.s_btn_under}
            highlight={phase === "under_cap"}
            success={phase === "under_cap"}
            result={t.s_result_under}
          />
          <ChargeButton
            label={t.s_btn_over}
            highlight={phase === "over_cap"}
            success={false}
            result={t.s_result_over}
          />
        </div>
      </div>
    </div>
  );
}

function ChargeButton({
  label,
  highlight,
  success,
  result,
}: {
  label: string;
  highlight: boolean;
  success: boolean;
  result: string;
}) {
  return (
    <div className="space-y-1">
      <div
        className={`border px-3 py-2 transition-all duration-500 ${
          highlight
            ? success
              ? "border-[#b5e853] bg-[#b5e853]/10"
              : "border-red-500 bg-red-50"
            : "border-[#0a0a0a]/15 bg-transparent"
        }`}
      >
        {label}
      </div>
      {highlight && (
        <div
          className={`pl-3 normal-case tracking-normal text-[10px] leading-relaxed animate-[fadeIn_400ms_ease-out] ${
            success ? "text-[#0a0a0a]" : "text-red-700"
          }`}
        >
          {success ? "✓" : "✗"} {result}
        </div>
      )}
    </div>
  );
}

function LockIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="square"
      strokeLinejoin="miter"
      aria-hidden="true"
    >
      <rect x="4" y="11" width="16" height="10" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

function Spinner() {
  return (
    <span
      className="inline-block w-3 h-3 border-2 border-[#0a0a0a]/30 border-t-[#0a0a0a] rounded-full animate-spin"
      aria-label="loading"
    />
  );
}
