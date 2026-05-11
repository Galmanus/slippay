import { Link } from "react-router-dom";
import { Logo } from "../components/Logo.tsx";
import { AskSlippay } from "../components/AskSlippay.tsx";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#f1eee7] text-[#0a0a0a] grain">
      {/* Top scrim — guarantees nav legibility regardless of hero pixels underneath */}
      <div className="fixed top-0 left-0 right-0 h-24 bg-gradient-to-b from-[#0a0a0a]/70 via-[#0a0a0a]/30 to-transparent z-10 pointer-events-none" />

      <header className="absolute top-0 left-0 right-0 z-20 max-w-[1400px] mx-auto px-6 md:px-10 py-6 flex items-center justify-between">
        <Logo />
        <nav className="flex items-center gap-7 text-[10px] uppercase tracking-[0.22em] text-[#f1eee7]">
          <Link to="/preview" className="hover:opacity-60 transition-opacity hidden md:inline">See it live</Link>
          <a href="#how" className="hover:opacity-60 transition-opacity hidden md:inline">How it works</a>
          <Link to="/demo" className="hover:opacity-60 transition-opacity hidden md:inline">SDK</Link>
          <Link to="/login" className="hover:opacity-60 transition-opacity">Log in</Link>
          <Link to="/signup"
            className="bg-[#b5e853] text-[#0a0a0a] px-4 py-2 hover:bg-[#a8d949] transition-colors text-[10px] uppercase tracking-[0.22em] flex items-center gap-2 font-medium">
            <span className="inline-block w-1 h-1 bg-[#0a0a0a]" />
            Sign up
          </Link>
        </nav>
      </header>

      {/* HERO IMAGE — full-bleed */}
      <div
        className="relative w-full bg-[#0a0a0a]"
        style={{
          height: "min(100vh, 880px)",
          backgroundImage: "url('/hero.png')",
          backgroundSize: "cover",
          backgroundPosition: "center 25%",
          backgroundRepeat: "no-repeat",
        }}
      >
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-b from-transparent to-[#f1eee7] pointer-events-none" />
        {/* Editorial pre-suasion stamp — bottom-left, doesn't fight with AskSlippay launcher on the right */}
        <div className="absolute bottom-6 left-6 md:left-10 z-10 inline-flex items-center gap-3 bg-[#b5e853] text-[#0a0a0a] px-4 py-2 text-[10px] uppercase tracking-[0.22em] font-mono">
          <span>slippay</span>
          <span className="text-[#0a0a0a]/55">·</span>
          <span>etiqueta do produto</span>
          <span className="text-[#0a0a0a]/55">·</span>
          <span className="text-[#0a0a0a]/55">sp-ss26-fl001</span>
        </div>
      </div>

      {/* HERO TEXT */}
      <section className="max-w-[1400px] mx-auto px-8 md:px-12 pt-16 md:pt-24 pb-24 md:pb-32 relative">
        <div className="grid grid-cols-12 gap-6 items-end">
          <div className="col-span-12 md:col-span-3">
            <div className="text-[10px] uppercase tracking-[0.22em] text-[#0a0a0a]/55 flex items-center gap-3">
              <span className="inline-block w-2 h-2 bg-[#b5e853]" />
              Pre-launch
            </div>
            <div className="mt-4 text-[10px] uppercase tracking-[0.22em] text-[#0a0a0a]/55 font-mono">
              <span className="tabular-nums">2026 · v0.0.3</span>
            </div>
          </div>
          <div className="col-span-12 md:col-span-9">
            <div className="text-[10px] uppercase tracking-[0.22em] text-[#0a0a0a]/55 mb-4 font-mono">
              ╱╱  Issue 001 · for BR exporters
            </div>
            <h1 className="text-[12vw] md:text-[5.2vw] font-medium leading-[0.95] tracking-[-0.04em] max-w-[20ch]">
              Bill the world<br/>
              from Brazil.<br/>
              <em className="not-italic relative">
                Get paid in dollars
                <span className="inline-block align-middle ml-3 w-2.5 h-2.5 bg-[#b5e853] -translate-y-[0.45em]" />
              </em>
            </h1>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-6 mt-20 md:mt-28 border-t border-[#0a0a0a]/15 pt-12">
          <div className="col-span-12 md:col-span-3">
            <div className="text-[10px] uppercase tracking-[0.22em] text-[#0a0a0a]/55 font-mono">
              ┃ The thesis
            </div>
          </div>
          <div className="col-span-12 md:col-span-6">
            <p className="text-lg md:text-xl leading-[1.55] tracking-tight max-w-[54ch]">
              Brazilian SaaS, agencies, and digital exporters lose roughly
              <em className="font-light"> 6% per international invoice</em> — Stripe 4.4%, IOF 0.38%,
              FX spread 1-2%. SlipPay charges <em className="font-light">1%</em>, settles to your wallet
              in USDC or PYUSD on Stellar in six seconds, no chargebacks. You hold dollars
              until you choose to convert.
            </p>
          </div>
          <div className="col-span-12 md:col-span-3 flex md:justify-end items-end">
            <Link to="/signup"
              className="group inline-flex items-center gap-3 text-[11px] uppercase tracking-[0.22em] border-b border-[#0a0a0a] pb-1 hover:opacity-60">
              Stop the 6% leak <span className="group-hover:translate-x-1 transition-transform">→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* NUMBERS */}
      <section className="border-t border-[#0a0a0a]/15">
        <div className="max-w-[1400px] mx-auto px-8 md:px-12 py-20 md:py-32">
          <div className="grid grid-cols-12 gap-6 mb-16">
            <div className="col-span-12 md:col-span-3 font-mono text-[10px] uppercase tracking-[0.22em] text-[#0a0a0a]/55">
              ┃ Numbers
            </div>
            <div className="col-span-12 md:col-span-9 font-mono text-[10px] uppercase tracking-[0.22em] text-[#0a0a0a]/55 tabular-nums">
              002 · The economics
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-[#0a0a0a]/15 border border-[#0a0a0a]/15">
            <Stat n="~6%" label="What Stripe + IOF takes"
              body="Stripe 4.4% on international cards, IOF 0.38% on FX out, plus 1-2% bank spread. Per-invoice leakage that compounds across the year." />
            <Stat n="1%" label="What SlipPay takes"
              body="Single platform fee, charged in USDC at settlement. No FX spread, no IOF (USDC stays USDC). You convert when you want, where you want." />
            <Stat n="6s" label="On-chain finality"
              body="Deterministic settlement on Stellar. No T+1, no batch windows, no chargebacks. Confirmation lands in the next ledger close." />
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="border-t border-[#0a0a0a]/15">
        <div className="max-w-[1400px] mx-auto px-8 md:px-12 py-20 md:py-32">
          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-12 md:col-span-3 font-mono text-[10px] uppercase tracking-[0.22em] text-[#0a0a0a]/55">
              ┃ Mechanics
            </div>
            <div className="col-span-12 md:col-span-9">
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#0a0a0a]/55 mb-6 tabular-nums">
                003 · How it works
              </div>
              <h2 className="text-3xl md:text-5xl font-medium tracking-[-0.03em] leading-[1.05] max-w-[24ch]">
                Four moving parts.<br/>One <em className="font-light">atomic</em> transaction.
              </h2>
              <div className="mt-16 grid md:grid-cols-2 gap-x-16 gap-y-14">
                <Step n="01" title="Invoice the customer in USD or BRL"
                  body="POST /v1/orders with usd_amount (BR-export flow) or brl_amount (domestic). USDC denominated 1:1 against USD; no FX round-trip." />
                <Step n="02" title="Customer pays via wallet or Pix"
                  body="Global customer signs USDC payment from a Stellar wallet. Brazilian customer pays Pix BRL via licensed anchor (when partnership lands), anchor mints USDC against your address." />
                <Step n="03" title="Listener confirms on-chain"
                  body="Horizon stream watches your merchant address, matches the payment by memo, validates amount and asset issuer, marks status=paid in 6s deterministic finality." />
                <Step n="04" title="Webhook fires, signed with HMAC"
                  body="Your endpoint receives an order.paid (or subscription.charged) event. Exponential retry: 1m, 5m, 30m, 2h, 12h, 24h, dead. USDC sits in your wallet until you decide to convert." />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* REGULATORY / STACK */}
      <section id="stack" className="border-t border-[#0a0a0a]/15">
        <div className="max-w-[1400px] mx-auto px-8 md:px-12 py-20 md:py-32">
          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-12 md:col-span-3 font-mono text-[10px] uppercase tracking-[0.22em] text-[#0a0a0a]/55">
              ┃ Position
            </div>
            <div className="col-span-12 md:col-span-9">
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#0a0a0a]/55 mb-6 tabular-nums">
                004 · Regulatory
              </div>
              <h2 className="text-3xl md:text-5xl font-medium tracking-[-0.03em] leading-[1.05] max-w-[26ch]">
                Built for the window<br/>that <em className="font-light">just opened</em>.
              </h2>
              <p className="mt-10 text-base md:text-lg leading-[1.65] text-[#0a0a0a]/75 max-w-[64ch]">
                BCB Resoluções 519/520/521 (effective February 2026) reclassified BRL ↔ stablecoin flow as
                <em className="font-light"> operações de câmbio</em>. SlipPay operates as a technology layer
                on top of licensed BR VASPs — the anchor handles BRL custody and FX,
                slippay handles the merchant API, settlement matching, and webhook delivery.
                Merchant funds remain on Stellar in the merchant&rsquo;s own wallet from the moment
                of payment forward. Non-custodial where it matters.
              </p>

              <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-px bg-[#0a0a0a]/15 border border-[#0a0a0a]/15">
                <Cell label="Chain" value="Stellar" />
                <Cell label="Assets" value="USDC · PYUSD" />
                <Cell label="Buyer rail" value="Pix · BRL" />
                <Cell label="Cash payout" value="MoneyGram · 180+ countries" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-[#0a0a0a]/15">
        <div className="max-w-[1400px] mx-auto px-8 md:px-12 py-32 md:py-40 relative">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#0a0a0a]/55 mb-8 tabular-nums">
            005 · Onboard <span className="inline-block w-2 h-2 bg-[#b5e853] ml-2 align-middle" />
          </div>
          <h2 className="text-[12vw] md:text-[5.2vw] font-medium tracking-[-0.04em] leading-[0.95] max-w-[14ch]">
            Ready when<br/><em className="font-light">your store is</em>.
          </h2>
          <p className="mt-10 text-base md:text-lg text-[#0a0a0a]/75 max-w-[48ch]">
            Sign up. Drop your Stellar receive address. Pick USDC or PYUSD.
            Copy your API key. First Pix-to-dollar order in under five minutes.
          </p>
          <Link to="/signup"
            className="inline-flex items-center gap-3 mt-12 bg-[#0a0a0a] text-[#f1eee7] px-10 py-5 text-[11px] uppercase tracking-[0.22em] hover:bg-[#1a1a1a]">
            Create merchant account <span>→</span>
          </Link>
        </div>
      </section>

      {/* FOOTER — oversized wordmark, editorial */}
      <footer className="border-t border-[#0a0a0a]/15 bg-[#0a0a0a] text-[#f1eee7]">
        <div className="max-w-[1400px] mx-auto px-8 md:px-12 pt-20 pb-8">
          <div className="grid grid-cols-12 gap-6 pb-16 border-b border-[#f1eee7]/15">
            <div className="col-span-12 md:col-span-4">
              <div className="text-[10px] uppercase tracking-[0.22em] text-[#f1eee7]/55 font-mono mb-4">
                ┃ Product
              </div>
              <ul className="space-y-2 text-sm">
                <li><Link to="/signup" className="hover:opacity-60">Sign up</Link></li>
                <li><Link to="/login" className="hover:opacity-60">Log in</Link></li>
                <li><a href="#how" className="hover:opacity-60">How it works</a></li>
              </ul>
            </div>
            <div className="col-span-12 md:col-span-4">
              <div className="text-[10px] uppercase tracking-[0.22em] text-[#f1eee7]/55 font-mono mb-4">
                ┃ Resources
              </div>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:opacity-60">API docs</a></li>
                <li><a href="#" className="hover:opacity-60">Webhook guide</a></li>
                <li><a href="#" className="hover:opacity-60">Security</a></li>
              </ul>
            </div>
            <div className="col-span-12 md:col-span-4">
              <div className="text-[10px] uppercase tracking-[0.22em] text-[#f1eee7]/55 font-mono mb-4">
                ┃ Legal
              </div>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:opacity-60">Terms</a></li>
                <li><a href="#" className="hover:opacity-60">Privacy</a></li>
                <li className="text-[#f1eee7]/55">CNPJ 66.381.800/0001-08</li>
              </ul>
            </div>
          </div>

          <div className="pt-16 pb-8 leading-none">
            <span className="block text-[#f1eee7] text-[20vw] md:text-[14vw] font-medium tracking-[-0.05em] -mb-4">
              slippay<span className="text-[#b5e853]">.</span>
            </span>
          </div>

          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-[10px] uppercase tracking-[0.22em] text-[#f1eee7]/55 font-mono">
            <div>© 2026 · Bluewave AI · Pre-launch · Confidential</div>
            <div>Blumenau · BR · America/Sao_Paulo</div>
          </div>
        </div>
      </footer>

      <AskSlippay />
    </div>
  );
}

function Stat({ n, label, body }: { n: string; label: string; body: string }) {
  return (
    <div className="bg-[#f1eee7] p-8 md:p-10">
      <div className="text-5xl md:text-6xl font-medium tabular-nums tracking-[-0.04em] leading-none">{n}</div>
      <div className="mt-6 text-[10px] uppercase tracking-[0.22em] text-[#0a0a0a]/55 font-mono">{label}</div>
      <p className="mt-4 text-sm leading-[1.6] text-[#0a0a0a]/75 max-w-[28ch]">{body}</p>
    </div>
  );
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="grid grid-cols-12 gap-4">
      <div className="col-span-2 md:col-span-1">
        <div className="text-3xl md:text-4xl font-medium tabular-nums tracking-tight text-[#0a0a0a]/30 leading-none font-mono">
          {n}
        </div>
      </div>
      <div className="col-span-10 md:col-span-11">
        <div className="text-xl md:text-2xl tracking-tight font-medium leading-[1.2]">{title}</div>
        <p className="mt-3 text-sm md:text-base leading-[1.65] text-[#0a0a0a]/75 max-w-[48ch]">{body}</p>
      </div>
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-[#f1eee7] p-6 md:p-8">
      <div className="text-[10px] uppercase tracking-[0.22em] text-[#0a0a0a]/55 font-mono">{label}</div>
      <div className="mt-3 text-base md:text-lg font-medium tracking-tight">{value}</div>
    </div>
  );
}
