import { Link } from "react-router-dom";
import { Logo } from "../components/Logo.tsx";
import { AskSlippay } from "../components/AskSlippay.tsx";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#f1eee7] text-[#0a0a0a] grain">
      <header className="absolute top-0 left-0 right-0 z-20 max-w-[1400px] mx-auto px-5 md:px-10 py-5 md:py-6 flex items-center justify-between">
        <Logo variant="bone" />
        <nav
          className="flex items-center gap-7 text-[10px] uppercase tracking-[0.22em] text-[#f1eee7]"
          style={{ textShadow: "0 1px 3px rgba(0,0,0,0.6)" }}
        >
          <Link to="/preview" className="hover:opacity-60 transition-opacity hidden md:inline">See it live</Link>
          <a href="#how" className="hover:opacity-60 transition-opacity hidden md:inline">How it works</a>
          <Link to="/demo" className="hover:opacity-60 transition-opacity hidden md:inline">SDK</Link>
          <Link to="/login" className="hover:opacity-60 transition-opacity">Log in</Link>
          <Link to="/signup"
            style={{ textShadow: "none" }}
            className="bg-[#b5e853] text-[#0a0a0a] px-4 py-2 hover:bg-[#a8d949] transition-colors text-[10px] uppercase tracking-[0.22em] flex items-center gap-2 font-medium">
            <span className="inline-block w-1 h-1 bg-[#0a0a0a]" />
            Sign up
          </Link>
        </nav>
      </header>

      {/* HERO IMAGE — full-bleed. Mobile uses ~72vh so the headline below
          peeks above the fold (signaling "more here"). Desktop keeps full
          monumental presence. Position Y differs: 30% on mobile favors
          face/blindfold; 40% on desktop reveals full jaw. */}
      <div
        className="relative w-full bg-[#0a0a0a] bg-[position:center_55%] md:bg-[position:center_60%] h-[72vh] md:h-[min(100vh,880px)]"
        style={{
          backgroundImage: "url('/hero.png?v=hermes2')",
          backgroundSize: "cover",
          backgroundRepeat: "no-repeat",
        }}
      >
        <div className="absolute bottom-0 left-0 right-0 h-64 md:h-48 bg-gradient-to-b from-transparent from-0% via-[#f1eee7]/75 via-55% to-[#f1eee7] to-85% pointer-events-none" />
        {/* Editorial pre-suasion stamp — bottom-left, doesn't fight with AskSlippay launcher.
            Shorter on mobile (no "etiqueta do produto" mid-segment) to avoid wrapping. */}
        <div className="absolute bottom-4 left-4 md:bottom-6 md:left-10 z-10 inline-flex items-center gap-2 md:gap-3 bg-[#b5e853] text-[#0a0a0a] px-3 md:px-4 py-1.5 md:py-2 text-[9px] md:text-[10px] uppercase tracking-[0.22em] font-mono">
          <span>slippay</span>
          <span className="text-[#0a0a0a]/55 hidden md:inline">·</span>
          <span className="hidden md:inline">etiqueta do produto</span>
          <span className="text-[#0a0a0a]/55">·</span>
          <span className="text-[#0a0a0a]/55">sp-ss26-fl001</span>
        </div>
      </div>

      {/* HERO TEXT */}
      <section className="max-w-[1400px] mx-auto px-5 md:px-12 pt-10 md:pt-24 pb-20 md:pb-32 relative">
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
            <h1 className="text-[11vw] sm:text-[9vw] md:text-[4.2vw] font-medium leading-[1.02] tracking-[-0.035em] max-w-[24ch]">
              Stripe takes <span className="tabular-nums">7-8%</span>.<br/>
              <em className="not-italic">1 in 5 transactions silently fails.</em>
              <span className="inline-block align-middle ml-2 md:ml-3 w-2 md:w-2.5 h-2 md:h-2.5 bg-[#b5e853] -translate-y-[0.45em]" />
            </h1>
            <p className="mt-6 md:mt-8 text-base md:text-xl leading-[1.45] text-[#0a0a0a]/80 max-w-[52ch]">
              SlipPay settles in 6 seconds on Stellar. No IOF. No card declines.
              You hold USDC, you choose when to convert.
            </p>
            <div className="mt-8 md:mt-10">
              <Link to="/signup"
                className="inline-flex items-center gap-3 bg-[#0a0a0a] text-[#f1eee7] px-8 py-4 text-[11px] uppercase tracking-[0.22em] hover:bg-[#1a1a1a]">
                Join the waitlist <span>→</span>
              </Link>
            </div>
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
              <em className="font-light"> 7-8% per international invoice</em> — Stripe BR 0.7% +
              3.99% + R$0.50, plus IOF 3.5% on cross-border FX (raised May 2025).
              On top of that, <em className="font-light">15-25%</em> of LATAM card transactions
              decline silently. Revenue you never see in the dashboard. SlipPay routes
              the same payment via Stellar in six seconds — no IOF, no decline, no chargeback.
              You hold USDC, you convert when you want.
            </p>
          </div>
          <div className="col-span-12 md:col-span-3 flex md:justify-end items-end">
            <Link to="/signup"
              className="group inline-flex items-center gap-3 text-[11px] uppercase tracking-[0.22em] border-b border-[#0a0a0a] pb-1 hover:opacity-60">
              Join the waitlist <span className="group-hover:translate-x-1 transition-transform">→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* NUMBERS */}
      <section className="border-t border-[#0a0a0a]/15">
        <div className="max-w-[1400px] mx-auto px-5 md:px-12 py-20 md:py-32">
          <div className="grid grid-cols-12 gap-6 mb-16">
            <div className="col-span-12 md:col-span-3 font-mono text-[10px] uppercase tracking-[0.22em] text-[#0a0a0a]/55">
              ┃ Numbers
            </div>
            <div className="col-span-12 md:col-span-9 font-mono text-[10px] uppercase tracking-[0.22em] text-[#0a0a0a]/55 tabular-nums">
              002 · The economics
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-[#0a0a0a]/15 border border-[#0a0a0a]/15">
            <Stat n="7-8%" label="Stripe BR + IOF takes"
              body="Stripe BR 0.7% + 3.99% + R$0.50 per international transaction. IOF 3.5% on cross-border FX (raised from 0.38% in May 2025). Compounds across every invoice." />
            <Stat n="1 in 5" label="LATAM card decline rate"
              body="Cross-border card failure 15-25% across LATAM (Rapyd, 2025). Revenue that never reaches your dashboard. Stellar settlement removes the card rail entirely." />
            <Stat n="6s" label="Stellar finality"
              body="Deterministic on-chain settlement. No T+1, no batch windows, no chargebacks. Network fee: 0.00001 XLM (~$0.000001), auditable by anyone." />
          </div>
        </div>
      </section>

      {/* PROOF · verifiable on-chain */}
      <section id="proof" className="border-t border-[#0a0a0a]/15 bg-[#0a0a0a] text-[#f1eee7]">
        <div className="max-w-[1400px] mx-auto px-5 md:px-12 py-20 md:py-28">
          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-12 md:col-span-3 font-mono text-[10px] uppercase tracking-[0.22em] text-[#f1eee7]/55">
              ┃ Proof
            </div>
            <div className="col-span-12 md:col-span-9">
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#f1eee7]/55 mb-6 tabular-nums">
                002b · Verifiable on-chain
              </div>
              <h2 className="text-2xl md:text-4xl font-medium tracking-[-0.03em] leading-[1.1] max-w-[26ch]">
                Not a deck. Not a mock.<br/><em className="font-light">A working contract.</em>
              </h2>
              <p className="mt-6 text-sm md:text-base leading-[1.65] text-[#f1eee7]/75 max-w-[60ch]">
                Subscription primitive v0.2 deployed on Stellar testnet. Every
                transaction below is signed by a real wallet, settles in 6 seconds,
                and is publicly auditable on stellar.expert. The auth chain
                buyer&nbsp;→&nbsp;contract&nbsp;→&nbsp;SAC.transfer was exercised
                end&#8209;to&#8209;end (audit-002 F5 closed).
              </p>
              <div className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-px bg-[#f1eee7]/15 border border-[#f1eee7]/15">
                <div className="bg-[#0a0a0a] p-6 md:p-7">
                  <div className="text-[10px] uppercase tracking-[0.22em] text-[#f1eee7]/55 font-mono">Contract · testnet v0.2</div>
                  <a href="https://stellar.expert/explorer/testnet/contract/CBN3M7IAKNSCSDQIUUGDBHSFUQDOFAQQQK6UXJZYGGIWERQGT24VBTFQ"
                     target="_blank" rel="noopener noreferrer"
                     className="mt-3 block font-mono text-xs md:text-sm break-all hover:text-[#b5e853]">
                    CBN3M7IA...GT24VBTFQ
                  </a>
                  <div className="mt-2 text-[10px] uppercase tracking-[0.22em] text-[#f1eee7]/55 font-mono">Soroban SDK 26 · audit-002 fixed</div>
                </div>
                <div className="bg-[#0a0a0a] p-6 md:p-7">
                  <div className="text-[10px] uppercase tracking-[0.22em] text-[#f1eee7]/55 font-mono">Real-wallet charge · F5 proof</div>
                  <a href="https://stellar.expert/explorer/testnet/tx/eee0d71f2f2100da1b97c971cec98fe367e89758c0b8b91c29ef6d5e84a602ff"
                     target="_blank" rel="noopener noreferrer"
                     className="mt-3 block font-mono text-xs md:text-sm break-all hover:text-[#b5e853]">
                    eee0d71f...4a602ff
                  </a>
                  <div className="mt-2 text-[10px] uppercase tracking-[0.22em] text-[#f1eee7]/55 font-mono">Buyer 1000→990 USDC · merchant 0→10 USDC</div>
                </div>
              </div>
              <div className="mt-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-[10px] uppercase tracking-[0.22em] text-[#f1eee7]/55 font-mono">
                <div className="flex items-center gap-3">
                  <span className="inline-block w-2 h-2 bg-[#b5e853]" />
                  Building on Stellar
                </div>
                <a href="https://github.com/Galmanus/slippay/tree/main/docs/security"
                   target="_blank" rel="noopener noreferrer"
                   className="hover:text-[#b5e853]">
                  6 audits · 8 critical + 14 high closed →
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how" className="border-t border-[#0a0a0a]/15">
        <div className="max-w-[1400px] mx-auto px-5 md:px-12 py-20 md:py-32">
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
        <div className="max-w-[1400px] mx-auto px-5 md:px-12 py-20 md:py-32">
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
        <div className="max-w-[1400px] mx-auto px-5 md:px-12 py-32 md:py-40 relative">
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
        <div className="max-w-[1400px] mx-auto px-5 md:px-12 pt-20 pb-8">
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
