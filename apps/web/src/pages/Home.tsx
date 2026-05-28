import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { Logo } from "../components/Logo.tsx";
import { AskSlippay } from "../components/AskSlippay.tsx";
import { Reveal, CountUp } from "../components/Reveal.tsx";
import PolicyDemoAnimation from "../components/PolicyDemoAnimation.tsx";
import { useLang, type Lang } from "../lib/lang.ts";
import { homeCopy } from "../copy/home.tsx";

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

// PT|EN toggle. Inherits text color from the nav (light over hero, ink when
// scrolled), so it reads on both backgrounds.
function LangToggle({ lang, setLang, className = "" }: { lang: Lang; setLang: (l: Lang) => void; className?: string }) {
  return (
    <div className={"flex items-center gap-1.5 tabular-nums " + className}>
      <button onClick={() => setLang("pt")} className={lang === "pt" ? "font-semibold" : "opacity-50 hover:opacity-100 transition-opacity"}>PT</button>
      <span className="opacity-30">/</span>
      <button onClick={() => setLang("en")} className={lang === "en" ? "font-semibold" : "opacity-50 hover:opacity-100 transition-opacity"}>EN</button>
    </div>
  );
}

export default function Home() {
  const scrolled = useScrolled(80);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [lang, setLang] = useLang();
  const t = homeCopy[lang];
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
        <Logo variant={scrolled ? "ink" : "bone"} />
        {/* Desktop nav */}
        <nav
          className={"hidden md:flex items-center gap-7 text-[10px] uppercase tracking-[0.22em] transition-colors duration-300 " +
            (scrolled ? "text-[#0a0a0a]" : "text-[#f1eee7]")}
          style={scrolled ? undefined : { textShadow: "0 1px 3px rgba(0,0,0,0.6)" }}
        >
          <Link to="/x402-demo" className="hover:opacity-60 transition-opacity">x402 demo</Link>
          <a href="https://slippay.gitbook.io/slippay-docs" className="hover:opacity-60 transition-opacity">{t.nav.docs}</a>
          <a href="#how" className="hover:opacity-60 transition-opacity">{t.nav.how}</a>
          <Link to="/login" className="hover:opacity-60 transition-opacity">{t.nav.login}</Link>
          <LangToggle lang={lang} setLang={setLang} />
          <Link to="/signup"
            style={{ textShadow: "none" }}
            className="bg-[#b5e853] text-[#0a0a0a] px-4 py-2 hover:bg-[#a8d949] transition-colors text-[10px] uppercase tracking-[0.22em] flex items-center gap-2 font-medium">
            <span className="inline-block w-1 h-1 bg-[#0a0a0a]" />
            {t.nav.signup}
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
              { to: "/", label: t.nav.home },
              { to: "/x402-demo", label: "x402 demo" },
              { to: "https://slippay.gitbook.io/slippay-docs", label: t.nav.docs },
              { to: "/login", label: t.nav.login },
            ].map(l => (
              l.to.startsWith("http") ? (
                <a
                  key={l.to} href={l.to}
                  className="py-4 text-3xl font-medium tracking-tight border-b border-[#f1eee7]/15"
                >
                  {l.label}
                </a>
              ) : (
                <Link
                  key={l.to} to={l.to}
                  onClick={() => setMobileMenu(false)}
                  className="py-4 text-3xl font-medium tracking-tight border-b border-[#f1eee7]/15"
                >
                  {l.label}
                </Link>
              )
            ))}
            <Link
              to="/signup"
              onClick={() => setMobileMenu(false)}
              className="mt-8 bg-[#b5e853] text-[#0a0a0a] py-4 text-center text-sm uppercase tracking-[0.22em] font-medium flex items-center justify-center gap-3"
            >
              <span className="inline-block w-1.5 h-1.5 bg-[#0a0a0a]" />
              {t.nav.signup}
            </Link>
            <LangToggle lang={lang} setLang={setLang} className="mt-8 text-sm uppercase tracking-[0.22em]" />
          </nav>
          <div className="px-5 py-6 text-[10px] uppercase tracking-[0.22em] text-[#f1eee7]/55 font-mono">
            {t.mobileFooter}
          </div>
        </div>
      )}
      {/* Spacer to offset the now-fixed header from the hero photo. */}
      <div className="h-0" />

      {/* HERO IMAGE — full-bleed. */}
      <div className="relative w-full bg-[#0a0a0a]">
        <picture className="hidden md:block">
          <source srcSet="/hero.webp?v=opt1" type="image/webp" />
          <img
            src="/hero.jpg?v=opt1"
            alt="slippay · the statue of liberty blindfolded in a KLEIN green band reading slippay in gold leaf"
            className="w-full h-auto"
            loading="eager"
            decoding="async"
          />
        </picture>
        <div
          className="md:hidden w-full h-[48vh] min-h-[340px] max-h-[480px] bg-[position:center_30%]"
          style={{
            backgroundImage: "image-set(url('/hero.webp?v=opt1') type('image/webp'), url('/hero.jpg?v=opt1') type('image/jpeg'))",
            backgroundSize: "cover",
            backgroundRepeat: "no-repeat",
          }}
          aria-label="slippay · the statue of liberty blindfolded in a KLEIN green band reading slippay in gold leaf"
        />
        <div className="absolute bottom-0 left-0 right-0 h-16 md:h-12 bg-gradient-to-b from-transparent via-[#f1eee7]/40 to-[#f1eee7] pointer-events-none" />
        <div className="absolute bottom-4 left-4 md:bottom-6 md:left-10 z-10 inline-flex items-center gap-2 md:gap-3 bg-[#b5e853] text-[#0a0a0a] px-3 md:px-4 py-1.5 md:py-2 text-[9px] md:text-[10px] uppercase tracking-[0.22em] font-mono">
          <span>slippay</span>
          <span className="text-[#0a0a0a]/55 hidden md:inline">·</span>
          <span className="hidden md:inline">product label</span>
          <span className="text-[#0a0a0a]/55">·</span>
          <span className="text-[#0a0a0a]/55">sp-ss26-fl001</span>
        </div>
      </div>

      {/* HERO TEXT */}
      <Reveal as="section" className="max-w-[1400px] mx-auto px-5 md:px-12 pt-6 md:pt-24 pb-16 md:pb-32 relative">
        <div className="grid grid-cols-12 gap-6 md:gap-6 items-end">
          <div className="col-span-12 mb-4 md:mb-0">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] uppercase tracking-[0.22em] text-[#0a0a0a]/55 font-mono">
              <span className="flex items-center gap-2">
                <span className="inline-block w-2 h-2 bg-[#b5e853]" />
                Mainnet · Stellar
              </span>
              <span className="opacity-50 hidden md:inline">·</span>
              <span className="tabular-nums">{t.hero.statusLive}</span>
            </div>
          </div>
          <Reveal className="col-span-12 text-center">
            <div className="text-[10px] uppercase tracking-[0.22em] text-[#0a0a0a]/55 mb-3 md:mb-4 font-mono">
              ╱╱  {t.hero.eyebrow}
            </div>
            <h1 className="title-grad text-[7.5vw] sm:text-[6vw] md:text-[3.4vw] font-medium leading-[1.06] tracking-[-0.03em] max-w-[28ch] mx-auto break-words">
              {t.hero.h1}
            </h1>
            <p className="mt-5 md:mt-8 text-[15px] md:text-xl leading-[1.5] text-[#0a0a0a]/80 max-w-[54ch] mx-auto">
              {t.hero.sub}
            </p>
            <div className="mt-8 md:mt-10 flex justify-center">
              <MagneticCTA to="/signup">
                {t.hero.cta} <span>→</span>
              </MagneticCTA>
            </div>
          </Reveal>
        </div>

        <div className="grid grid-cols-12 gap-6 mt-20 md:mt-28 border-t border-[#0a0a0a]/15 pt-12">
          <div className="col-span-12">
            <div className="text-[10px] uppercase tracking-[0.22em] text-[#0a0a0a]/55 font-mono text-center">
              {t.tese.label}
            </div>
          </div>
          <div className="col-span-12 max-w-[60ch] mx-auto space-y-12">
            <TeseBlock label={t.tese.b1Label}>{t.tese.b1}</TeseBlock>
            <TeseBlock label={t.tese.b2Label}>{t.tese.b2}</TeseBlock>
            <TeseBlock label={t.tese.b3Label}>{t.tese.b3}</TeseBlock>
          </div>
          <div className="col-span-12 flex justify-center md:justify-end items-end">
            <Link to="/signup"
              className="group inline-flex items-center gap-3 text-[11px] uppercase tracking-[0.22em] border-b border-[#0a0a0a] pb-1 hover:opacity-60">
              {t.tese.cta} <span className="group-hover:translate-x-1 transition-transform">→</span>
            </Link>
          </div>
        </div>
      </Reveal>

      {/* COMMERCE STACK · 3 modules */}
      <Reveal as="section" id="stack-modules" className="border-t border-[#0a0a0a]/15 bg-[#0a0a0a] text-[#f1eee7]">
        <div className="max-w-[1400px] mx-auto px-5 md:px-12 py-20 md:py-32">
          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-12 font-mono text-[10px] uppercase tracking-[0.22em] text-[#f1eee7]/55 text-center">
              {t.modules.label}
            </div>
            <div className="col-span-12">
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#f1eee7]/55 mb-6 tabular-nums text-center">
                {t.modules.kicker}
              </div>
              <h2 className="title-grad-dark text-3xl md:text-5xl font-medium tracking-[-0.03em] leading-[1.05] max-w-[24ch] mx-auto text-center">
                {t.modules.h2}
              </h2>
              <p className="mt-8 text-base md:text-lg leading-[1.6] text-[#f1eee7]/70 max-w-[60ch] mx-auto text-center">
                {t.modules.intro}
              </p>
              <div className="mt-14 grid md:grid-cols-3 gap-px bg-[#f1eee7]/15 border border-[#f1eee7]/15">
                <Module tag={t.modules.m1.tag} status="live" statusLabel={t.modules.m1.statusLabel} title={t.modules.m1.title} body={t.modules.m1.body} />
                <Module tag={t.modules.m2.tag} status="soon" statusLabel={t.modules.m2.statusLabel} title={t.modules.m2.title} body={t.modules.m2.body} />
                <Module tag={t.modules.m3.tag} status="ecosystem" statusLabel={t.modules.m3.statusLabel} title={t.modules.m3.title} body={t.modules.m3.body} />
              </div>
            </div>
          </div>
        </div>
      </Reveal>

      {/* NUMBERS */}
      <Reveal as="section" className="border-t border-[#0a0a0a]/15">
        <div className="max-w-[1400px] mx-auto px-5 md:px-12 py-20 md:py-32">
          <div className="grid grid-cols-12 gap-6 mb-16">
            <div className="col-span-12 font-mono text-[10px] uppercase tracking-[0.22em] text-[#0a0a0a]/55 text-center">
              {t.numbers.label}
            </div>
            <div className="col-span-12 font-mono text-[10px] uppercase tracking-[0.22em] text-[#0a0a0a]/55 tabular-nums text-center">
              {t.numbers.kicker}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-[#0a0a0a]/15 border border-[#0a0a0a]/15 text-center">
            <Stat n="98%" label={t.numbers.s1Label}
              count={{ to: 98, decimals: 0, suffix: "%" }}
              body={t.numbers.s1Body} />
            <Stat n={t.numbers.s2N} label={t.numbers.s2Label}
              body={t.numbers.s2Body} />
            <Stat n="6s" label={t.numbers.s3Label}
              count={{ to: 6, decimals: 0, suffix: "s" }}
              body={t.numbers.s3Body} />
          </div>
        </div>
      </Reveal>

      {/* PROOF · verifiable on-chain */}
      <Reveal as="section" id="proof" className="border-t border-[#0a0a0a]/15 bg-[#0a0a0a] text-[#f1eee7]">
        <div className="max-w-[1400px] mx-auto px-5 md:px-12 py-20 md:py-28">
          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-12 font-mono text-[10px] uppercase tracking-[0.22em] text-[#f1eee7]/55 text-center">
              {t.proof.label}
            </div>
            <div className="col-span-12">
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#f1eee7]/55 mb-6 tabular-nums">
                {t.proof.kicker}
              </div>
              <h2 className="title-grad-dark text-2xl md:text-4xl font-medium tracking-[-0.03em] leading-[1.1] max-w-[26ch] mx-auto text-center">
                {t.proof.h2}
              </h2>
              <p className="mt-6 text-sm md:text-base leading-[1.65] text-[#f1eee7]/75 max-w-[60ch] mx-auto text-center">
                {t.proof.body}
              </p>
              <div className="mt-10 border border-[#f1eee7]/15">
                <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-[#f1eee7]/15">
                  <div className="p-6 md:p-8">
                    <div className="text-[10px] uppercase tracking-[0.22em] text-[#b5e853] font-mono">{t.proof.contractLabel}</div>
                    <a href="https://stellar.expert/explorer/public/contract/CBJMQ6ZYQJ2OMM46FGXPEIKKZDRHHERBXUVE54ZN64FDPKN5DJKSEVQN"
                       target="_blank" rel="noopener noreferrer"
                       className="mt-3 block font-mono text-xs md:text-sm break-all hover:text-[#b5e853]">
                      CBJMQ6ZY...DJKSEVQN
                    </a>
                    <div className="mt-2 text-[10px] uppercase tracking-[0.22em] text-[#f1eee7]/55 font-mono">{t.proof.contractMeta}</div>
                  </div>
                  <div className="p-6 md:p-8">
                    <div className="text-[10px] uppercase tracking-[0.22em] text-[#b5e853] font-mono">{t.proof.payLabel}</div>
                    <a href="https://stellar.expert/explorer/public/tx/aa3304c93beffde1809ced4989b898cf419b8121e8ca9b50d01d407ccbf8326b"
                       target="_blank" rel="noopener noreferrer"
                       className="mt-3 block font-mono text-xs md:text-sm break-all hover:text-[#b5e853]">
                      aa3304c9...0d407ccb
                    </a>
                    <div className="mt-2 text-[10px] uppercase tracking-[0.22em] text-[#f1eee7]/55 font-mono">{t.proof.payMeta}</div>
                  </div>
                </div>
                <div className="border-t border-[#f1eee7]/15 px-6 md:px-8 py-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-[10px] uppercase tracking-[0.22em] text-[#f1eee7]/55 font-mono">
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                    <div className="flex items-center gap-3">
                      <span className="inline-block w-2 h-2 bg-[#b5e853] animate-pulse" />
                      {t.proof.liveTag}
                    </div>
                    <span className="opacity-40 hidden md:inline">·</span>
                    <a href="https://galmanus.github.io/ssl-spec/" target="_blank" rel="noopener noreferrer"
                       className="hover:text-[#b5e853]">
                      Agent · SSL v7 ↗
                    </a>
                  </div>
                  <a href="https://bluewaveai.online" target="_blank" rel="noopener noreferrer"
                     className="flex items-center gap-2 text-[#b5e853] hover:opacity-70">
                    <span className="inline-block w-2 h-2 bg-[#b5e853]" />
                    {t.proof.auditTag} ↗
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Reveal>

      {/* HOW IT WORKS · ANIMATED DEMO */}
      <PolicyDemoAnimation />

      {/* HOW IT WORKS · 4 STEPS */}
      <Reveal as="section" id="how" className="border-t border-[#0a0a0a]/15">
        <div className="max-w-[1400px] mx-auto px-5 md:px-12 py-20 md:py-32">
          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-12 font-mono text-[10px] uppercase tracking-[0.22em] text-[#0a0a0a]/55">
              {t.how.label}
            </div>
            <div className="col-span-12">
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#0a0a0a]/55 mb-6 tabular-nums">
                {t.how.kicker}
              </div>
              <h2 className="title-grad text-3xl md:text-5xl font-medium tracking-[-0.03em] leading-[1.05] max-w-[24ch] mx-auto text-center">
                {t.how.h2}
              </h2>
              <div className="mt-16 grid md:grid-cols-2 gap-x-16 gap-y-14">
                <Step n="01" title={t.how.s1Title} body={t.how.s1Body} />
                <Step n="02" title={t.how.s2Title} body={t.how.s2Body} />
                <Step n="03" title={t.how.s3Title} body={t.how.s3Body} />
                <Step n="04" title={t.how.s4Title} body={t.how.s4Body} />
              </div>
            </div>
          </div>
        </div>
      </Reveal>

      {/* REGULATORY / STACK */}
      <Reveal as="section" id="stack" className="border-t border-[#0a0a0a]/15">
        <div className="max-w-[1400px] mx-auto px-5 md:px-12 py-20 md:py-32">
          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-12 font-mono text-[10px] uppercase tracking-[0.22em] text-[#0a0a0a]/55">
              {t.reg.label}
            </div>
            <div className="col-span-12">
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#0a0a0a]/55 mb-6 tabular-nums">
                {t.reg.kicker}
              </div>
              <h2 className="title-grad text-3xl md:text-5xl font-medium tracking-[-0.03em] leading-[1.05] max-w-[26ch] mx-auto text-center">
                {t.reg.h2}
              </h2>
              <p className="mt-10 text-base md:text-lg leading-[1.65] text-[#0a0a0a]/75 max-w-[66ch] mx-auto text-center">
                {t.reg.body}
              </p>

              <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-px bg-[#0a0a0a]/15 border border-[#0a0a0a]/15">
                <Cell label={t.reg.cNetwork} value="Stellar" />
                <Cell label={t.reg.cAssets} value={t.reg.cAssetsV} />
                <Cell label={t.reg.cOnramp} value="Pix · BRL" />
                <Cell label={t.reg.cCustody} value={t.reg.cCustodyV} />
              </div>
            </div>
          </div>
        </div>
      </Reveal>

      {/* COMPETITION · the empty quadrant */}
      <Reveal as="section" id="competition" className="border-t border-[#0a0a0a]/15 bg-[#0a0a0a] text-[#f1eee7]">
        <div className="max-w-[1400px] mx-auto px-5 md:px-12 py-20 md:py-32">
          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-12 font-mono text-[10px] uppercase tracking-[0.22em] text-[#f1eee7]/55 text-center">
              {t.comp.label}
            </div>
            <div className="col-span-12">
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#f1eee7]/55 mb-6 tabular-nums text-center">
                {t.comp.kicker}
              </div>
              <h2 className="title-grad-dark text-3xl md:text-5xl font-medium tracking-[-0.03em] leading-[1.05] max-w-[22ch] mx-auto text-center">
                {t.comp.h2}
              </h2>
              <div className="mt-12 overflow-x-auto -mx-5 md:mx-0 px-5 md:px-0">
                <table className="w-full min-w-[680px] border-collapse text-sm">
                  <thead>
                    <tr className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#f1eee7]/55">
                      <th className="text-left font-normal py-4 pr-4"></th>
                      <th className="text-left font-normal py-4 px-3">Stripe · Bridge</th>
                      <th className="text-left font-normal py-4 px-3">Coinbase Commerce</th>
                      <th className="text-left font-normal py-4 px-3">Paywit</th>
                      <th className="text-left font-normal py-4 px-3">Paykit</th>
                      <th className="text-left font-medium py-4 px-3 text-[#b5e853] border-x border-[#b5e853]/30">SlipPay</th>
                    </tr>
                  </thead>
                  <tbody className="align-top">
                    <Row label={t.comp.rRegional} cells={["—","—","—","—"]} slip={t.comp.sNative} />
                    <Row label={t.comp.rPix} cells={["—","—","—","—"]} slip={t.comp.sFx} slipNote={t.comp.sFxNote} />
                    <Row label={t.comp.rSub} cells={["—","—","—","—"]} slip={t.comp.sSub} />
                    <Row label={t.comp.rYield} cells={["—","—","—","—"]} slip="Etherfuse" slipNote={t.comp.sYieldNote} />
                    <Row label={t.comp.rCashout} cells={["—","—","—","—"]} slip="MoneyGram · Stellar" slipNote={t.comp.sYieldNote} />
                    <Row label={t.comp.rCustody} cells={["—",t.comp.yes,t.comp.yes,t.comp.yes]} slip={t.comp.sCustody} />
                    <Row label={t.comp.rTake} cells={[t.comp.stripeTake,t.comp.coinbaseTake,t.comp.na,t.comp.na]} slip={t.comp.slipTake} last />
                  </tbody>
                </table>
              </div>
              <div className="mt-6 font-mono text-[10px] uppercase tracking-[0.18em] text-[#f1eee7]/45 flex flex-wrap items-center gap-x-5 gap-y-2">
                <span className="flex items-center gap-2"><span className="inline-block w-2 h-2 bg-[#b5e853]" /> {t.comp.legendLive}</span>
                <span className="flex items-center gap-2"><span className="inline-block w-2 h-2 border border-[#f1eee7]/40" /> {t.comp.legendRoadmap}</span>
              </div>
              <p className="mt-8 text-base md:text-lg leading-[1.6] text-[#f1eee7]/75 max-w-[64ch] mx-auto text-center border-l-2 border-[#b5e853] pl-4 md:border-l-0 md:pl-0">
                {t.comp.kickerP}
              </p>
            </div>
          </div>
        </div>
      </Reveal>

      {/* CTA */}
      <Reveal as="section" className="border-t border-[#0a0a0a]/15">
        <div className="max-w-[1400px] mx-auto px-5 md:px-12 py-32 md:py-40 relative text-center flex flex-col items-center">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#0a0a0a]/55 mb-8 tabular-nums">
            {t.cta.kicker} <span className="inline-block w-2 h-2 bg-[#b5e853] ml-2 align-middle" />
          </div>
          <h2 className="title-grad text-[12vw] md:text-[5.2vw] font-medium tracking-[-0.04em] leading-[0.95] max-w-[14ch] mx-auto text-center">
            {t.cta.h2}
          </h2>
          <p className="mt-10 text-base md:text-lg text-[#0a0a0a]/75 max-w-[50ch] mx-auto text-center">
            {t.cta.body}
          </p>
          <Link to="/signup"
            className="inline-flex items-center gap-3 mt-12 bg-[#0a0a0a] text-[#f1eee7] px-10 py-5 text-[11px] uppercase tracking-[0.22em] hover:bg-[#1a1a1a]">
            {t.cta.button} <span>→</span>
          </Link>
        </div>
      </Reveal>

      {/* FOOTER */}
      <footer className="border-t border-[#0a0a0a]/15 bg-[#0a0a0a] text-[#f1eee7]">
        <div className="max-w-[1400px] mx-auto px-5 md:px-12 pt-20 pb-8">
          <div className="grid grid-cols-12 gap-6 pb-16 border-b border-[#f1eee7]/15">
            <div className="col-span-12 md:col-span-4">
              <div className="text-[10px] uppercase tracking-[0.22em] text-[#f1eee7]/55 font-mono mb-4">
                {t.footer.product}
              </div>
              <ul className="space-y-2 text-sm">
                <li><Link to="/signup" className="hover:opacity-60">{t.footer.fSignup}</Link></li>
                <li><Link to="/login" className="hover:opacity-60">{t.footer.fLogin}</Link></li>
                <li><a href="#how" className="hover:opacity-60">{t.footer.fHow}</a></li>
              </ul>
            </div>
            <div className="col-span-12 md:col-span-4">
              <div className="text-[10px] uppercase tracking-[0.22em] text-[#f1eee7]/55 font-mono mb-4">
                {t.footer.resources}
              </div>
              <ul className="space-y-2 text-sm">
                <li><a href="https://slippay.gitbook.io/slippay-docs" className="hover:opacity-60">{t.footer.fApi}</a></li>
                <li><a href="https://slippay.gitbook.io/slippay-docs" className="hover:opacity-60">{t.footer.fGuides}</a></li>
                <li><a href="https://slippay.gitbook.io/slippay-docs" className="hover:opacity-60">{t.footer.fAudits}</a></li>
                <li><a href="https://slippay.gitbook.io/slippay-docs" className="hover:opacity-60">{t.footer.fX402}</a></li>
                <li><a href="https://galmanus.github.io/ssl-spec/" target="_blank" rel="noopener noreferrer" className="hover:opacity-60">{t.footer.fSsl}</a></li>
              </ul>
            </div>
            <div className="col-span-12 md:col-span-4">
              <div className="text-[10px] uppercase tracking-[0.22em] text-[#f1eee7]/55 font-mono mb-4">
                {t.footer.legal}
              </div>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:opacity-60">{t.footer.fTerms}</a></li>
                <li><a href="#" className="hover:opacity-60">{t.footer.fPrivacy}</a></li>
              </ul>
            </div>
          </div>

          <div className="pt-16 pb-8 leading-none">
            <span className="block text-[#f1eee7] text-[20vw] md:text-[14vw] font-medium tracking-[-0.05em] -mb-4">
              slippay<span className="text-[#b5e853]">.</span>
            </span>
          </div>

          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-[10px] uppercase tracking-[0.22em] text-[#f1eee7]/55 font-mono">
            <div>© 2026 · SlipPay</div>
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
      <p className="mt-4 text-sm leading-[1.6] text-[#0a0a0a]/75 max-w-[28ch] mx-auto">{body}</p>
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

function Module({ tag, status, statusLabel, title, body }: {
  tag: string; status: "live" | "soon" | "ecosystem"; statusLabel: string; title: string; body: string;
}) {
  const dot = status === "live" ? "bg-[#b5e853]" : "border border-[#f1eee7]/40";
  const labelColor = status === "live" ? "text-[#b5e853]" : "text-[#f1eee7]/50";
  return (
    <div className="bg-[#0a0a0a] p-8 md:p-10">
      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#b5e853]">{tag}</div>
      <div className={"mt-3 flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.22em] " + labelColor}>
        <span className={"inline-block w-2 h-2 " + dot + (status === "live" ? " animate-pulse" : "")} />
        {statusLabel}
      </div>
      <div className="mt-6 text-xl md:text-2xl font-medium tracking-tight leading-[1.15]">{title}</div>
      <p className="mt-4 text-sm leading-[1.6] text-[#f1eee7]/70">{body}</p>
    </div>
  );
}

function TeseBlock({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#0a0a0a]/45 mb-3">{label}</div>
      <p className="text-lg md:text-2xl leading-[1.45] tracking-tight text-[#0a0a0a]/90">{children}</p>
    </div>
  );
}

function Row({ label, cells, slip, slipNote, last }: {
  label: string; cells: string[]; slip: string; slipNote?: string; last?: boolean;
}) {
  const isLive = !slipNote;
  return (
    <tr className={last ? "" : "border-b border-[#f1eee7]/10"}>
      <td className="py-4 pr-4 font-medium">{label}</td>
      {cells.map((c, i) => (
        <td key={i} className="py-4 px-3 text-[#f1eee7]/45">{c}</td>
      ))}
      <td className="py-4 px-3 border-x border-[#b5e853]/30 bg-[#b5e853]/[0.06]">
        <span className="flex items-start gap-2">
          <span className={"mt-1.5 shrink-0 inline-block w-2 h-2 " + (isLive ? "bg-[#b5e853]" : "border border-[#f1eee7]/40")} />
          <span>
            <span className="font-medium">{slip}</span>
            {slipNote && <span className="block font-mono text-[9px] uppercase tracking-[0.18em] text-[#f1eee7]/45">{slipNote}</span>}
          </span>
        </span>
      </td>
    </tr>
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
