import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { Logo } from "../components/Logo.tsx";
import { AskSlippay } from "../components/AskSlippay.tsx";
import { Reveal, CountUp } from "../components/Reveal.tsx";

function useScrolled(threshold = 80) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > threshold);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);
  return scrolled;
}

// Magnetic CTA · button follows cursor with a 6px max offset while hovered.
// Cheap premium-fintech tell · no library needed.
function MagneticCTA({ to, children }: { to: string; children: React.ReactNode }) {
  const ref = useRef<HTMLAnchorElement>(null);
  function onMove(e: React.MouseEvent<HTMLAnchorElement>) {
    const el = ref.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const mx = e.clientX - r.left - r.width / 2;
    const my = e.clientY - r.top - r.height / 2;
    el.style.transform = `translate(${(mx / r.width) * 8}px, ${(my / r.height) * 8}px)`;
  }
  function onLeave() {
    const el = ref.current; if (!el) return;
    el.style.transform = "translate(0,0)";
  }
  return (
    <Link to={to} ref={ref as any}
      onMouseMove={onMove} onMouseLeave={onLeave}
      style={{ transition: "transform 200ms cubic-bezier(0.22,1,0.36,1)" }}
      className="inline-flex items-center gap-3 bg-[#0a0a0a] text-[#f1eee7] px-8 py-4 text-[11px] uppercase tracking-[0.22em] hover:bg-[#1a1a1a]">
      {children}
    </Link>
  );
}

export default function Home() {
  const scrolled = useScrolled(80);
  const [mobileMenu, setMobileMenu] = useState(false);
  // Lock body scroll while mobile menu is open
  useEffect(() => {
    document.body.style.overflow = mobileMenu ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileMenu]);
  return (
    <div className="min-h-screen bg-[#f1eee7] text-[#0a0a0a] grain">
      <header
        className={
          "fixed top-0 left-0 right-0 z-30 transition-colors duration-300 " +
          (scrolled ? "bg-[#f1eee7]/80 backdrop-blur-md border-b border-[#0a0a0a]/8" : "bg-transparent")
        }
      >
        <div className="max-w-[1400px] mx-auto px-5 md:px-10 py-4 md:py-6 flex items-center justify-between">
        <Logo variant="bone" />
        {/* Desktop nav */}
        <nav
          className={"hidden md:flex items-center gap-7 text-[10px] uppercase tracking-[0.22em] transition-colors duration-300 " +
            (scrolled ? "text-[#0a0a0a]" : "text-[#f1eee7]")}
          style={scrolled ? undefined : { textShadow: "0 1px 3px rgba(0,0,0,0.6)" }}
        >
          <Link to="/x402-demo" className="hover:opacity-60 transition-opacity">x402 demo</Link>
          <Link to="/docs" className="hover:opacity-60 transition-opacity">Docs</Link>
          <a href="#how" className="hover:opacity-60 transition-opacity">How it works</a>
          <Link to="/login" className="hover:opacity-60 transition-opacity">Log in</Link>
          <Link to="/signup"
            style={{ textShadow: "none" }}
            className="bg-[#b5e853] text-[#0a0a0a] px-4 py-2 hover:bg-[#a8d949] transition-colors text-[10px] uppercase tracking-[0.22em] flex items-center gap-2 font-medium">
            <span className="inline-block w-1 h-1 bg-[#0a0a0a]" />
            Sign up
          </Link>
        </nav>
        {/* Mobile hamburger */}
        <button
          aria-label="Open menu"
          onClick={() => setMobileMenu(v => !v)}
          className={"md:hidden flex flex-col gap-1.5 p-2 -mr-2 transition-colors " + (scrolled ? "text-[#0a0a0a]" : "text-[#f1eee7]")}
          style={scrolled ? undefined : { filter: "drop-shadow(0 1px 3px rgba(0,0,0,0.6))" }}
        >
          <span className="block w-6 h-[2px] bg-current" />
          <span className="block w-6 h-[2px] bg-current" />
          <span className="block w-4 h-[2px] bg-current ml-auto" />
        </button>
        </div>
      </header>

      {/* Mobile menu overlay */}
      {mobileMenu && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-[#0a0a0a] text-[#f1eee7] flex flex-col"
          role="dialog"
          aria-modal="true"
        >
          <div className="flex items-center justify-between px-5 py-4">
            <Logo variant="bone" />
            <button
              aria-label="Close menu"
              onClick={() => setMobileMenu(false)}
              className="text-3xl leading-none px-2 py-1 -mr-2"
            >×</button>
          </div>
          <nav className="flex-1 flex flex-col px-5 pt-8 gap-1 text-[#f1eee7]">
            {[
              { to: "/", label: "Home" },
              { to: "/x402-demo", label: "x402 demo" },
              { to: "/docs", label: "Docs" },
              { to: "/login", label: "Log in" },
            ].map(l => (
              <Link
                key={l.to} to={l.to}
                onClick={() => setMobileMenu(false)}
                className="py-4 text-3xl font-medium tracking-tight border-b border-[#f1eee7]/15"
              >
                {l.label}
              </Link>
            ))}
            <Link
              to="/signup"
              onClick={() => setMobileMenu(false)}
              className="mt-8 bg-[#b5e853] text-[#0a0a0a] py-4 text-center text-sm uppercase tracking-[0.22em] font-medium flex items-center justify-center gap-3"
            >
              <span className="inline-block w-1.5 h-1.5 bg-[#0a0a0a]" />
              Sign up
            </Link>
          </nav>
          <div className="px-5 py-6 text-[10px] uppercase tracking-[0.22em] text-[#f1eee7]/55 font-mono">
            Live on Stellar PUBLIC · contract CBJMQ6ZY…
          </div>
        </div>
      )}
      {/* Spacer to offset the now-fixed header from the hero photo. */}
      <div className="h-0" />

      {/* HERO IMAGE — full-bleed. Mobile uses ~72vh so the headline below
          peeks above the fold (signaling "more here"). Desktop keeps full
          monumental presence. Position Y differs: 30% on mobile favors
          face/blindfold; 40% on desktop reveals full jaw. */}
      {/* Hero · img on desktop (shows the full 16:9 monumental frame),
          bg-cover on mobile (uses the band as focal anchor so the wordmark
          stays visible at portrait aspect). */}
      <div className="relative w-full bg-[#0a0a0a]">
        <img
          src="/hero.png?v=liberty3"
          alt="slippay · the statue of liberty blindfolded in a KLEIN green band reading slippay in gold leaf"
          className="hidden md:block w-full h-auto"
          loading="eager"
          decoding="async"
        />
        <div
          className="md:hidden w-full h-[68vh] min-h-[440px] bg-[position:center_35%]"
          style={{
            backgroundImage: "url('/hero.png?v=liberty3')",
            backgroundSize: "cover",
            backgroundRepeat: "no-repeat",
          }}
          aria-label="slippay · the statue of liberty blindfolded in a KLEIN green band reading slippay in gold leaf"
        />
        <div className="absolute bottom-0 left-0 right-0 h-16 md:h-12 bg-gradient-to-b from-transparent via-[#f1eee7]/40 to-[#f1eee7] pointer-events-none" />
        {/* Editorial pre-suasion stamp — bottom-left, doesn't fight with AskSlippay launcher.
            Shorter on mobile (no "etiqueta do produto" mid-segment) to avoid wrapping. */}
        <div className="absolute bottom-4 left-4 md:bottom-6 md:left-10 z-10 inline-flex items-center gap-2 md:gap-3 bg-[#b5e853] text-[#0a0a0a] px-3 md:px-4 py-1.5 md:py-2 text-[9px] md:text-[10px] uppercase tracking-[0.22em] font-mono">
          <span>slippay</span>
          <span className="text-[#0a0a0a]/55 hidden md:inline">·</span>
          <span className="hidden md:inline">product label</span>
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
              <MagneticCTA to="/signup">
                Join the waitlist <span>→</span>
              </MagneticCTA>
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
            <Stat n="7.8%" label="Stripe BR + IOF takes"
              count={{ to: 7.8, decimals: 1, suffix: "%" }}
              body="Stripe BR 0.7% + 3.99% + R$0.50 per international transaction. IOF 3.5% on cross-border FX (raised from 0.38% in May 2025). Compounds across every invoice." />
            <Stat n="1 in 5" label="LATAM card decline rate"
              body="Cross-border card failure 15-25% across LATAM (Rapyd, 2025). Revenue that never reaches your dashboard. Stellar settlement removes the card rail entirely." />
            <Stat n="6s" label="Stellar finality"
              count={{ to: 6, decimals: 0, suffix: "s" }}
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
                Not a deck. Not a mock.<br/><em className="font-light">Live on Stellar mainnet.</em>
              </h2>
              <p className="mt-6 text-sm md:text-base leading-[1.65] text-[#f1eee7]/75 max-w-[60ch]">
                Subscription primitive v0.2 deployed on Stellar PUBLIC network on
                2026-05-16. Real USDC moved on chain through the x402 demo flow.
                Both transactions below are publicly auditable on stellar.expert.
                The full audit posture (8 critical + 14 high findings closed) sits
                behind the link below.
              </p>
              <div className="mt-10 border border-[#f1eee7]/15">
                <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-[#f1eee7]/15">
                  <div className="p-6 md:p-8">
                    <div className="text-[10px] uppercase tracking-[0.22em] text-[#b5e853] font-mono">Contract · MAINNET v0.2</div>
                    <a href="https://stellar.expert/explorer/public/contract/CBJMQ6ZYQJ2OMM46FGXPEIKKZDRHHERBXUVE54ZN64FDPKN5DJKSEVQN"
                       target="_blank" rel="noopener noreferrer"
                       className="mt-3 block font-mono text-xs md:text-sm break-all hover:text-[#b5e853]">
                      CBJMQ6ZY...DJKSEVQN
                    </a>
                    <div className="mt-2 text-[10px] uppercase tracking-[0.22em] text-[#f1eee7]/55 font-mono">Soroban SDK 26 · F5 closed pre-deploy</div>
                  </div>
                  <div className="p-6 md:p-8">
                    <div className="text-[10px] uppercase tracking-[0.22em] text-[#b5e853] font-mono">x402 payment · MAINNET</div>
                    <a href="https://stellar.expert/explorer/public/tx/aa3304c93beffde1809ced4989b898cf419b8121e8ca9b50d01d407ccbf8326b"
                       target="_blank" rel="noopener noreferrer"
                       className="mt-3 block font-mono text-xs md:text-sm break-all hover:text-[#b5e853]">
                      aa3304c9...0d407ccb
                    </a>
                    <div className="mt-2 text-[10px] uppercase tracking-[0.22em] text-[#f1eee7]/55 font-mono">0.05 USDC · buyer → merchant · 6s finality</div>
                  </div>
                </div>
                <div className="border-t border-[#f1eee7]/15 px-6 md:px-8 py-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-[10px] uppercase tracking-[0.22em] text-[#f1eee7]/55 font-mono">
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                    <div className="flex items-center gap-3">
                      <span className="inline-block w-2 h-2 bg-[#b5e853] animate-pulse" />
                      Live on Stellar PUBLIC
                    </div>
                    <span className="opacity-40 hidden md:inline">·</span>
                    <a href="https://galmanus.github.io/ssl-spec/" target="_blank" rel="noopener noreferrer"
                       className="hover:text-[#b5e853]">
                      Agent · SSL v7 ↗
                    </a>
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
                <li><Link to="/docs/api-reference/orders" className="hover:opacity-60">API docs</Link></li>
                <li><Link to="/docs/api-reference/webhooks" className="hover:opacity-60">Webhook guide</Link></li>
                <li><Link to="/docs/security/audit-001" className="hover:opacity-60">Security audits</Link></li>
                <li><Link to="/docs/integrations/x402" className="hover:opacity-60">x402 protocol</Link></li>
                <li><a href="https://galmanus.github.io/ssl-spec/" target="_blank" rel="noopener noreferrer" className="hover:opacity-60">SSL spec ↗</a></li>
              </ul>
            </div>
            <div className="col-span-12 md:col-span-4">
              <div className="text-[10px] uppercase tracking-[0.22em] text-[#f1eee7]/55 font-mono mb-4">
                ┃ Legal
              </div>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:opacity-60">Terms</a></li>
                <li><a href="#" className="hover:opacity-60">Privacy</a></li>
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

function Stat({ n, label, body, count }: { n: string; label: string; body: string; count?: { to: number; decimals?: number; suffix?: string; prefix?: string } }) {
  return (
    <div className="bg-[#f1eee7] p-8 md:p-10">
      <div className="text-5xl md:text-6xl font-medium tabular-nums tracking-[-0.04em] leading-none">
        {count ? (
          <CountUp to={count.to} decimals={count.decimals ?? 0} suffix={count.suffix ?? ""} prefix={count.prefix ?? ""} durationMs={1600} />
        ) : n}
      </div>
      <div className="mt-6 text-[10px] uppercase tracking-[0.22em] text-[#0a0a0a]/55 font-mono">{label}</div>
      <p className="mt-4 text-sm leading-[1.6] text-[#0a0a0a]/75 max-w-[28ch]">{body}</p>
    </div>
  );
}

function Step({ n, title, body }: { n: string; title: string; body: string }) {
  return (
    <div className="flex gap-5 md:gap-7">
      <div className="shrink-0 w-10 md:w-14 text-3xl md:text-4xl font-medium tabular-nums tracking-tight text-[#0a0a0a]/30 leading-none font-mono">
        {n}
      </div>
      <div className="flex-1 min-w-0">
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
