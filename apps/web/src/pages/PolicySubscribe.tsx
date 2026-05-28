// Policy-checkout subscribe page · /s/:subId
//
// Per spec docs/product/policy-checkout-spec.md v1: single screen, one
// biometric tap, zero typed characters. The "Stripe-impossible" property
// — a user-enforced on-chain spending policy — is the lock-icon panel
// derived from the user's smart-wallet storage.
//
// M4c · scaffold ONLY. Subscription metadata is read from a tiny in-memory
// demo registry (real merchant dashboard out of v1 scope per spec §2).
// The biometric tap is currently stubbed: it toggles UI state without
// touching WebAuthn or the smart-wallet contract. M4d wires the real
// flow against contract CAAS2RFE7UQGZBEXJRAO7RKW33GMRGMKPJ6JZAAI27JYTU4PYGYWP26V.
//
// Editorial register matches AnchorDemo + Home: BONE bg, INK text, KLEIN
// chartreuse accents, all caps mono labels.

import { useState } from "react";
import { useParams } from "react-router-dom";
import { Logo } from "../components/Logo";

type SubMeta = {
  merchant: string;
  plan: string;
  amount_label: string;       // human display, e.g. "USDC 29.00"
  interval_label: string;     // human display, e.g. "30 dias"
  max_per_charge_label: string;
  expires_in_label: string;
};

// Demo registry. Each entry corresponds to a subId in the URL. M4c stub.
const DEMO_FALLBACK: SubMeta = {
  merchant: "Slippay Demo Co.",
  plan: "Premium",
  amount_label: "USDC 29.00",
  interval_label: "30 dias",
  max_per_charge_label: "USDC 35.00",
  expires_in_label: "12 meses",
};

const DEMO_REGISTRY: Record<string, SubMeta> = {
  demo: DEMO_FALLBACK,
};

export default function PolicySubscribe() {
  const { subId = "demo" } = useParams<{ subId: string }>();
  const meta: SubMeta = DEMO_REGISTRY[subId] ?? DEMO_FALLBACK;

  const [active, setActive] = useState(false);
  const [showGuarantees, setShowGuarantees] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // M4c stub: toggles UI state on biometric "tap". M4d replaces with real
  // WebAuthn + smart-wallet deploy + install_policy.
  function onBiometricTap() {
    setError(null);
    setActive(true);
  }

  // M4c stub: same shape as the future real revoke flow.
  function onRevoke() {
    setError(null);
    setActive(false);
  }

  return (
    <div className="min-h-screen bg-[#f1eee7] text-[#0a0a0a] font-mono">
      <header className="border-b border-[#0a0a0a]/15">
        <div className="max-w-[640px] mx-auto px-5 md:px-10 py-5 flex items-center justify-between">
          <Logo />
          <span className="text-[10px] uppercase tracking-[0.22em] opacity-60">
            policy checkout · v1
          </span>
        </div>
      </header>

      <main className="max-w-[640px] mx-auto px-5 md:px-10 py-16 md:py-24">
        {/* Merchant identity */}
        <div className="mb-12">
          <div className="text-[10px] uppercase tracking-[0.22em] opacity-60 mb-3">
            assinatura
          </div>
          <h1 className="text-3xl md:text-5xl font-medium tracking-tight leading-tight">
            {meta.merchant}
          </h1>
          <div className="mt-4 text-lg md:text-xl">
            {meta.plan} —{" "}
            <span className="font-mono">
              {meta.amount_label} / {meta.interval_label}
            </span>
          </div>
        </div>

        {/* Primary action OR active state */}
        {!active ? (
          <button
            onClick={onBiometricTap}
            className="w-full bg-[#0a0a0a] text-[#f1eee7] py-5 text-base uppercase tracking-[0.22em] hover:bg-[#0a0a0a]/90 transition-colors"
            data-testid="confirm-biometric"
          >
            confirmar com biometria
          </button>
        ) : (
          <div className="border border-[#0a0a0a]/15 p-8">
            <div className="flex items-center gap-3 mb-5">
              <span className="inline-block w-2 h-2 bg-[#b5e853]" />
              <span className="text-[10px] uppercase tracking-[0.22em]">
                assinatura ativa
              </span>
            </div>
            <div className="text-2xl mb-2">{meta.merchant}</div>
            <div className="text-base opacity-70 mb-8">
              {meta.plan} — {meta.amount_label} / {meta.interval_label}
            </div>
            <button
              onClick={onRevoke}
              className="text-[11px] uppercase tracking-[0.22em] underline underline-offset-4 hover:opacity-60"
            >
              cancelar assinatura
            </button>
          </div>
        )}

        {/* Lock icon · guarantees panel */}
        <button
          onClick={() => setShowGuarantees(v => !v)}
          className="mt-6 flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] opacity-60 hover:opacity-100"
        >
          <LockIcon />
          o que você está autorizando
          <span className="opacity-50">{showGuarantees ? "▾" : "▸"}</span>
        </button>

        {showGuarantees && (
          <div className="mt-4 border border-[#0a0a0a]/15 p-6 text-sm space-y-3">
            <Guarantee
              n={1}
              label={`só ${meta.merchant} pode cobrar você. nenhum outro endereço.`}
            />
            <Guarantee
              n={2}
              label={`máximo ${meta.max_per_charge_label} por ciclo. valores acima são rejeitados on-chain.`}
            />
            <Guarantee
              n={3}
              label={`liquidação em segundos. sem janela de estorno de 7 dias.`}
            />
            <Guarantee
              n={4}
              label={`cancele com 1 toque. a Slippay não pode impedir.`}
            />
            <div className="mt-4 pt-3 border-t border-[#0a0a0a]/10 text-[10px] uppercase tracking-[0.22em] opacity-50">
              policy expira em {meta.expires_in_label}
            </div>
          </div>
        )}

        {error && (
          <div className="mt-6 border border-red-500/30 bg-red-50 p-4 text-sm text-red-900">
            {error}
          </div>
        )}

        {/* M4c stub banner — removed in M4d when wired to real WebAuthn */}
        <div className="mt-12 text-[10px] uppercase tracking-[0.22em] opacity-30">
          spike · m4c stub · webauthn lands in m4d
        </div>
      </main>
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
    >
      <rect x="4" y="11" width="16" height="10" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" />
    </svg>
  );
}

function Guarantee({ n, label }: { n: number; label: string }) {
  return (
    <div className="flex gap-3">
      <span className="text-[10px] uppercase tracking-[0.22em] opacity-50 pt-1 w-4">
        0{n}
      </span>
      <span className="flex-1">{label}</span>
    </div>
  );
}
