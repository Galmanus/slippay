// Policy-checkout subscribe page · /s/:subId
//
// Per spec docs/product/policy-checkout-spec.md v1: single screen, one
// biometric tap, zero typed characters. The "Stripe-impossible" property
// — a user-enforced on-chain spending policy — is the lock-icon panel
// derived from the user's smart-wallet storage.
//
// M5 · wired to the spike HTTP endpoint at `scripts/policy-checkout-spike-
// server.mjs` (default http://localhost:8787). On biometric tap, the page
// POSTs to /api/policy-checkout/spike which deploys a fresh smart-wallet
// instance on Stellar testnet, calls init(), and calls install_policy().
// The response carries the new contract id + tx hashes that the active
// state surfaces as stellar.expert links — real on-chain artifacts the
// mentor can inspect during the Rio demo.
//
// v0.1 gaps documented in contracts/smart-wallet/DEPLOYED.md still apply:
// install_policy is server-mediated, secp256r1_verify is stubbed in
// __check_auth. v0.2 closes both.
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

type SpikeResult = {
  wallet_contract_id: string;
  init_tx: string | null;
  policy_tx: string | null;
  wallet_url: string;
  init_tx_url: string | null;
  policy_tx_url: string | null;
  network: string;
  timing_ms: { deploy: number; init: number; install: number };
};

// Demo registry. Each entry corresponds to a subId in the URL. The amounts
// here match the defaults the spike server installs on chain.
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

const SPIKE_API_BASE =
  (import.meta.env.VITE_POLICY_CHECKOUT_API as string | undefined) ??
  "http://localhost:8787";

type Phase = "idle" | "deploying" | "active" | "error";

export default function PolicySubscribe() {
  const { subId = "demo" } = useParams<{ subId: string }>();
  const meta: SubMeta = DEMO_REGISTRY[subId] ?? DEMO_FALLBACK;

  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<SpikeResult | null>(null);
  const [showGuarantees, setShowGuarantees] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onBiometricTap() {
    setError(null);
    setPhase("deploying");
    try {
      const r = await fetch(`${SPIKE_API_BASE}/api/policy-checkout/spike`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!r.ok) {
        throw new Error(`server returned ${r.status}`);
      }
      const data: SpikeResult = await r.json();
      setResult(data);
      setPhase("active");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setPhase("error");
    }
  }

  function onRevoke() {
    // v0.1 stub. Real revoke wires a separate endpoint that calls
    // wallet.revoke_policy on chain. Left local-only for now.
    setError(null);
    setResult(null);
    setPhase("idle");
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

        {/* Primary action / loading / active state */}
        {phase === "idle" || phase === "error" ? (
          <button
            onClick={onBiometricTap}
            className="w-full bg-[#0a0a0a] text-[#f1eee7] py-5 text-base uppercase tracking-[0.22em] hover:bg-[#0a0a0a]/90 transition-colors"
            data-testid="confirm-biometric"
          >
            confirmar com biometria
          </button>
        ) : phase === "deploying" ? (
          <div className="border border-[#0a0a0a]/15 p-8">
            <div className="flex items-center gap-3 mb-5">
              <Spinner />
              <span className="text-[10px] uppercase tracking-[0.22em]">
                provisionando seu cofre on-chain
              </span>
            </div>
            <div className="text-sm opacity-70 space-y-1">
              <div>· deploy do smart wallet</div>
              <div>· gravando passkey</div>
              <div>· instalando policy: {meta.max_per_charge_label} max, {meta.interval_label} entre cobranças</div>
            </div>
            <div className="mt-5 text-[10px] uppercase tracking-[0.22em] opacity-50">
              ~20s · Stellar testnet
            </div>
          </div>
        ) : (
          <div className="border border-[#0a0a0a]/15 p-8">
            <div className="flex items-center gap-3 mb-5">
              <span className="inline-block w-2 h-2 bg-[#b5e853]" />
              <span className="text-[10px] uppercase tracking-[0.22em]">
                assinatura ativa
              </span>
            </div>
            <div className="text-2xl mb-2">{meta.merchant}</div>
            <div className="text-base opacity-70 mb-6">
              {meta.plan} — {meta.amount_label} / {meta.interval_label}
            </div>

            {result && (
              <div className="mb-8 space-y-2 text-[10px] uppercase tracking-[0.22em]">
                <a
                  href={result.wallet_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block underline underline-offset-4 hover:opacity-60"
                >
                  cofre on-chain · {short(result.wallet_contract_id)} ↗
                </a>
                {result.policy_tx_url && (
                  <a
                    href={result.policy_tx_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block underline underline-offset-4 hover:opacity-60"
                  >
                    policy_installed event · {short(result.policy_tx ?? "")} ↗
                  </a>
                )}
                <div className="opacity-50">
                  deploy {result.timing_ms.deploy}ms · init {result.timing_ms.init}ms · install {result.timing_ms.install}ms
                </div>
              </div>
            )}

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
            <Guarantee n={1} label={`só ${meta.merchant} pode cobrar você. nenhum outro endereço.`} />
            <Guarantee n={2} label={`máximo ${meta.max_per_charge_label} por ciclo. valores acima são rejeitados on-chain.`} />
            <Guarantee n={3} label={`liquidação em segundos. sem janela de estorno de 7 dias.`} />
            <Guarantee n={4} label={`cancele com 1 toque. a Slippay não pode impedir.`} />
            <div className="mt-4 pt-3 border-t border-[#0a0a0a]/10 text-[10px] uppercase tracking-[0.22em] opacity-50">
              policy expira em {meta.expires_in_label}
            </div>
          </div>
        )}

        {error && (
          <div className="mt-6 border border-red-500/30 bg-red-50 p-4 text-sm text-red-900">
            erro: {error}
            <div className="mt-2 text-xs opacity-70">
              verifica se o server local está rodando: <code className="font-mono">node scripts/policy-checkout-spike-server.mjs</code>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function short(s: string, head = 6, tail = 6): string {
  if (!s) return "—";
  if (s.length <= head + tail + 3) return s;
  return `${s.slice(0, head)}…${s.slice(-tail)}`;
}

function LockIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter">
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

function Guarantee({ n, label }: { n: number; label: string }) {
  return (
    <div className="flex gap-3">
      <span className="text-[10px] uppercase tracking-[0.22em] opacity-50 pt-1 w-4">0{n}</span>
      <span className="flex-1">{label}</span>
    </div>
  );
}
