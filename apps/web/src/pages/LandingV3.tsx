// /v3 — dark security-grade prototype (Secuury-style). Deep navy canvas, white
// type, electric-cyan accent, animated glow gradient, grain, scroll reveals.
// CSS-only effects (no 3D). Self-contained: all styles scoped via a <style> block,
// no dependency on the bone/gold design system. Adult copy, no mascot.

import { Link } from "react-router-dom";
import { useEffect, useState } from "react";

const ZK_CONTRACT = "CBDS2YSLATINQVUDG5Y5HV4KQBEAVFDRPEINVEUTYSX3CZZQKBY5U3FE";

type Lang = "pt" | "en";

const COPY = {
  pt: {
    nav: [["Receber", "/receber"], ["Prova", "/zk"], ["Builders", "/builders"], ["Docs", "https://slippay.gitbook.io/slippay-docs"]] as [string, string][],
    cta: "Começar",
    eyebrow: "infraestrutura de dólar · não-custodial · stellar",
    h1a: "Dólar de verdade.",
    h1b: "Sem banco no meio.",
    sub: "Receba, guarde e mova dólar direto do Pix. A chave é sua, a biometria assina, ninguém congela. Cada movimento deixa prova on-chain.",
    ctaPrimary: "Abrir conta",
    ctaGhost: "ver a prova on-chain",
    metrics: [
      ["non-custodial", "a chave nunca sai do seu aparelho"],
      ["mainnet stellar", "contrato vivo, verificável agora"],
      ["zero-knowledge", "prova de conformidade sem revelar nada"],
    ],
    sectionsTitle: "Construído como infraestrutura, não como app.",
    features: [
      ["Carteira biométrica", "Sem seed phrase, sem senha. Face ID ou digital assina cada transação, dentro do enclave seguro do aparelho."],
      ["Prova confidencial", "Um agente prova on-chain que obedeceu as regras, sem revelar valores nem recebedores. Só o regulador, com a chave, abre o total."],
      ["Rail para agentes", "Servidor MCP nativo: qualquer agente de IA paga dentro de limites provados. Non-custodial, sem backend no caminho."],
    ],
    proofTitle: "Não confie. Verifique.",
    proofSub: "A prova de compliance verifica na mainnet Stellar agora, num contrato que qualquer um audita.",
    proofBtn: "Verificar on-chain",
    closeTitle: "Dólar soberano,",
    closeTitle2: "provado on-chain.",
    closeBtn: "Começar",
    footer: "slippay · infraestrutura de dólar não-custodial · stellar",
  },
  en: {
    nav: [["Receive", "/receber"], ["Proof", "/zk"], ["Builders", "/builders"], ["Docs", "https://slippay.gitbook.io/slippay-docs"]] as [string, string][],
    cta: "Get started",
    eyebrow: "dollar infrastructure · non-custodial · stellar",
    h1a: "Real dollars.",
    h1b: "No bank in between.",
    sub: "Receive, hold and move dollars straight from Pix. The key is yours, biometrics sign, nobody freezes it. Every move leaves on-chain proof.",
    ctaPrimary: "Open account",
    ctaGhost: "see the on-chain proof",
    metrics: [
      ["non-custodial", "the key never leaves your device"],
      ["stellar mainnet", "live contract, verifiable now"],
      ["zero-knowledge", "compliance proof revealing nothing"],
    ],
    sectionsTitle: "Built as infrastructure, not an app.",
    features: [
      ["Biometric wallet", "No seed phrase, no password. Face ID or fingerprint signs every transaction inside the device's secure enclave."],
      ["Confidential proof", "An agent proves on-chain it obeyed the rules, without revealing amounts or recipients. Only the regulator, with the key, opens the total."],
      ["Rail for agents", "Native MCP server: any AI agent pays within proven limits. Non-custodial, no backend in the path."],
    ],
    proofTitle: "Don't trust. Verify.",
    proofSub: "The compliance proof verifies on Stellar mainnet now, in a contract anyone can audit.",
    proofBtn: "Verify on-chain",
    closeTitle: "Sovereign dollars,",
    closeTitle2: "proven on-chain.",
    closeBtn: "Get started",
    footer: "slippay · non-custodial dollar infrastructure · stellar",
  },
} as const;

export default function LandingV3() {
  const [lang, setLang] = useState<Lang>(() => {
    try { const s = localStorage.getItem("slippay.lang"); if (s === "pt" || s === "en") return s; } catch { /* */ }
    return (typeof navigator !== "undefined" && navigator.language?.toLowerCase().startsWith("pt")) ? "pt" : "en";
  });
  useEffect(() => { try { localStorage.setItem("slippay.lang", lang); } catch { /* */ } }, [lang]);
  const t = COPY[lang];

  useEffect(() => {
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const io = new IntersectionObserver((ents) => {
      for (const e of ents) if (e.isIntersecting) { e.target.classList.add("v3-in"); io.unobserve(e.target); }
    }, { rootMargin: "-8% 0px -10% 0px", threshold: 0.08 });
    document.querySelectorAll(".v3-reveal").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  const xurl = `https://stellar.expert/explorer/public/contract/${ZK_CONTRACT}`;

  return (
    <div className="v3">
      <style>{V3_CSS}</style>

      {/* animated glow field */}
      <div className="v3-bg" aria-hidden>
        <div className="v3-glow v3-glow-a" />
        <div className="v3-glow v3-glow-b" />
        <div className="v3-grid" />
        <div className="v3-grain" />
      </div>

      {/* header */}
      <header className="v3-header">
        <Link to="/" className="v3-logo">slippay<span>.</span></Link>
        <nav className="v3-nav">
          {t.nav.map(([label, href]) => href.startsWith("http")
            ? <a key={href} href={href} target="_blank" rel="noreferrer">{label}</a>
            : <Link key={href} to={href}>{label}</Link>)}
          <button className="v3-langbtn" onClick={() => setLang(lang === "pt" ? "en" : "pt")}>{lang === "pt" ? "EN" : "PT"}</button>
          <Link to="/account" className="v3-cta-sm">{t.cta}</Link>
        </nav>
      </header>

      {/* hero */}
      <section className="v3-hero">
        <span className="v3-eyebrow"><i className="v3-dot" />{t.eyebrow}</span>
        <h1 className="v3-h1">
          <span className="v3-line">{t.h1a}</span>
          <span className="v3-line v3-accent">{t.h1b}</span>
        </h1>
        <p className="v3-sub">{t.sub}</p>
        <div className="v3-actions">
          <Link to="/account" className="v3-cta">{t.ctaPrimary}<span className="v3-arrow">→</span></Link>
          <a href={xurl} target="_blank" rel="noreferrer" className="v3-ghost">{t.ctaGhost}</a>
        </div>
        <div className="v3-metrics">
          {t.metrics.map(([k, v]) => (
            <div key={k} className="v3-metric">
              <div className="v3-metric-k">{k}</div>
              <div className="v3-metric-v">{v}</div>
            </div>
          ))}
        </div>
      </section>

      {/* features */}
      <section className="v3-section v3-reveal">
        <h2 className="v3-h2">{t.sectionsTitle}</h2>
        <div className="v3-cards">
          {t.features.map(([h, b], i) => (
            <div key={h} className="v3-card v3-reveal" style={{ transitionDelay: `${i * 90}ms` }}>
              <div className="v3-card-n">{String(i + 1).padStart(2, "0")}</div>
              <div className="v3-card-h">{h}</div>
              <div className="v3-card-b">{b}</div>
            </div>
          ))}
        </div>
      </section>

      {/* proof */}
      <section className="v3-proof v3-reveal">
        <div className="v3-proof-inner">
          <h2 className="v3-h2">{t.proofTitle}</h2>
          <p className="v3-proof-sub">{t.proofSub}</p>
          <a href={xurl} target="_blank" rel="noreferrer" className="v3-cta">{t.proofBtn}<span className="v3-arrow">↗</span></a>
          <div className="v3-contract">{ZK_CONTRACT}</div>
        </div>
      </section>

      {/* close */}
      <section className="v3-close v3-reveal">
        <h2 className="v3-close-h">
          <span>{t.closeTitle}</span>
          <span className="v3-accent">{t.closeTitle2}</span>
        </h2>
        <Link to="/account" className="v3-cta v3-cta-lg">{t.closeBtn}<span className="v3-arrow">→</span></Link>
        <div className="v3-footer">{t.footer}</div>
      </section>
    </div>
  );
}

const V3_CSS = `
.v3{--bg:#0a0e1a;--bg2:#0d1322;--ink:#f3f5fb;--muted:#8a93ad;--cyan:#22d3ee;--cyan2:#38bdf8;--line:rgba(255,255,255,.08);
  position:relative;min-height:100vh;background:var(--bg);color:var(--ink);overflow-x:hidden;
  font-family:"Space Grotesk","DM Sans",system-ui,sans-serif;}
.v3 *{box-sizing:border-box;}
.v3 ::selection{background:var(--cyan);color:var(--bg);}

/* animated glow background */
.v3-bg{position:fixed;inset:0;z-index:0;pointer-events:none;background:radial-gradient(120% 80% at 50% -10%,#101a30 0%,var(--bg) 60%);}
.v3-glow{position:absolute;border-radius:50%;filter:blur(90px);opacity:.5;}
.v3-glow-a{width:46vw;height:46vw;top:-12vw;right:-6vw;background:radial-gradient(circle,rgba(34,211,238,.45),transparent 70%);animation:v3float-a 22s ease-in-out infinite;}
.v3-glow-b{width:40vw;height:40vw;bottom:-10vw;left:-8vw;background:radial-gradient(circle,rgba(56,189,248,.30),transparent 70%);animation:v3float-b 26s ease-in-out infinite;}
@keyframes v3float-a{0%,100%{transform:translate(0,0) scale(1);}50%{transform:translate(-4vw,4vw) scale(1.12);}}
@keyframes v3float-b{0%,100%{transform:translate(0,0) scale(1);}50%{transform:translate(5vw,-3vw) scale(1.1);}}
.v3-grid{position:absolute;inset:0;background-image:linear-gradient(var(--line) 1px,transparent 1px),linear-gradient(90deg,var(--line) 1px,transparent 1px);background-size:64px 64px;mask-image:radial-gradient(100% 60% at 50% 0%,#000 30%,transparent 80%);opacity:.5;}
.v3-grain{position:absolute;inset:0;opacity:.04;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");}
@media(prefers-reduced-motion:reduce){.v3-glow{animation:none;}}

/* layout */
.v3-header,.v3-hero,.v3-section,.v3-proof,.v3-close{position:relative;z-index:1;}
.v3-header{display:flex;align-items:center;justify-content:space-between;padding:22px clamp(20px,5vw,64px);}
.v3-logo{font-weight:800;font-size:22px;letter-spacing:-.04em;color:var(--ink);text-decoration:none;}
.v3-logo span{color:var(--cyan);}
.v3-nav{display:flex;align-items:center;gap:26px;font-size:13px;color:var(--muted);}
.v3-nav>a:not(.v3-cta-sm){display:none;color:var(--muted);text-decoration:none;transition:color .2s;}
.v3-nav>a:not(.v3-cta-sm):hover{color:var(--ink);}
@media(min-width:860px){.v3-nav>a:not(.v3-cta-sm){display:inline;}}
.v3-langbtn{background:none;border:none;color:var(--muted);font:inherit;font-size:12px;letter-spacing:.1em;cursor:pointer;}
.v3-cta-sm{background:var(--ink);color:var(--bg);text-decoration:none;padding:9px 18px;border-radius:999px;font-size:12px;font-weight:600;letter-spacing:.04em;transition:transform .25s,box-shadow .25s;}
.v3-cta-sm:hover{transform:translateY(-1px);box-shadow:0 8px 24px -8px rgba(34,211,238,.5);}

.v3-hero{max-width:1100px;margin:0 auto;padding:clamp(60px,12vh,140px) clamp(20px,5vw,64px) 80px;text-align:center;display:flex;flex-direction:column;align-items:center;}
.v3-eyebrow{display:inline-flex;align-items:center;gap:9px;font-family:"Space Mono",monospace;font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:var(--muted);}
.v3-dot{width:7px;height:7px;border-radius:50%;background:var(--cyan);box-shadow:0 0 10px var(--cyan);animation:v3pulse 2s infinite;}
@keyframes v3pulse{50%{opacity:.35;}}
.v3-h1{margin:26px 0 0;font-weight:800;letter-spacing:-.04em;line-height:.98;font-size:clamp(2.6rem,8vw,5.6rem);}
.v3-line{display:block;}
.v3-accent{background:linear-gradient(90deg,var(--cyan),var(--cyan2));-webkit-background-clip:text;background-clip:text;color:transparent;}
.v3-sub{margin:26px auto 0;max-width:52ch;font-size:clamp(1rem,2vw,1.3rem);line-height:1.55;color:var(--muted);}
.v3-actions{display:flex;flex-wrap:wrap;gap:16px;justify-content:center;margin-top:38px;}
.v3-cta{display:inline-flex;align-items:center;gap:10px;background:linear-gradient(90deg,var(--cyan),var(--cyan2));color:#04121a;text-decoration:none;padding:15px 30px;border-radius:999px;font-weight:700;font-size:14px;letter-spacing:.02em;transition:transform .25s,box-shadow .25s;box-shadow:0 10px 30px -10px rgba(34,211,238,.6);}
.v3-cta:hover{transform:translateY(-2px);box-shadow:0 16px 40px -10px rgba(34,211,238,.75);}
.v3-arrow{transition:transform .25s;}
.v3-cta:hover .v3-arrow{transform:translateX(4px);}
.v3-ghost{display:inline-flex;align-items:center;color:var(--ink);text-decoration:none;font-size:13px;letter-spacing:.04em;border-bottom:1px solid var(--cyan);padding-bottom:3px;opacity:.85;transition:opacity .2s;}
.v3-ghost:hover{opacity:1;}
.v3-metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--line);border:1px solid var(--line);border-radius:18px;overflow:hidden;margin-top:64px;width:100%;max-width:860px;}
@media(max-width:680px){.v3-metrics{grid-template-columns:1fr;}}
.v3-metric{background:var(--bg2);padding:24px;text-align:left;}
.v3-metric-k{font-family:"Space Mono",monospace;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--cyan);}
.v3-metric-v{margin-top:8px;font-size:14px;color:var(--muted);line-height:1.4;}

.v3-section{max-width:1100px;margin:0 auto;padding:clamp(60px,12vh,120px) clamp(20px,5vw,64px);}
.v3-h2{font-weight:800;letter-spacing:-.03em;font-size:clamp(1.8rem,5vw,3.4rem);line-height:1.05;max-width:18ch;}
.v3-cards{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;margin-top:48px;}
@media(max-width:860px){.v3-cards{grid-template-columns:1fr;}}
.v3-card{background:var(--bg2);border:1px solid var(--line);border-radius:20px;padding:30px 26px;transition:transform .3s,border-color .3s,box-shadow .3s;}
.v3-card:hover{transform:translateY(-4px);border-color:rgba(34,211,238,.4);box-shadow:0 20px 50px -24px rgba(34,211,238,.5);}
.v3-card-n{font-family:"Space Mono",monospace;font-size:12px;color:var(--cyan);letter-spacing:.2em;}
.v3-card-h{margin-top:16px;font-size:22px;font-weight:700;letter-spacing:-.02em;}
.v3-card-b{margin-top:12px;font-size:14.5px;line-height:1.6;color:var(--muted);}

.v3-proof{padding:clamp(40px,8vh,80px) clamp(20px,5vw,64px);}
.v3-proof-inner{max-width:1100px;margin:0 auto;background:linear-gradient(135deg,#0e1830,#0a1020);border:1px solid rgba(34,211,238,.25);border-radius:28px;padding:clamp(36px,7vw,72px);text-align:center;display:flex;flex-direction:column;align-items:center;}
.v3-proof-sub{margin:18px auto 32px;max-width:48ch;color:var(--muted);font-size:1.05rem;line-height:1.5;}
.v3-contract{margin-top:22px;font-family:"Space Mono",monospace;font-size:11px;color:var(--muted);word-break:break-all;max-width:560px;}

.v3-close{max-width:1100px;margin:0 auto;padding:clamp(60px,14vh,160px) clamp(20px,5vw,64px);text-align:center;display:flex;flex-direction:column;align-items:center;}
.v3-close-h{font-weight:800;letter-spacing:-.04em;line-height:1;font-size:clamp(2.4rem,9vw,6rem);}
.v3-close-h span{display:block;}
.v3-cta-lg{margin-top:40px;padding:18px 38px;font-size:15px;}
.v3-footer{margin-top:64px;font-family:"Space Mono",monospace;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:var(--muted);opacity:.6;}

/* scroll reveal */
.v3-reveal{opacity:0;transform:translateY(28px);transition:opacity .8s var(--ease,cubic-bezier(.16,1,.3,1)),transform .8s var(--ease,cubic-bezier(.16,1,.3,1));}
.v3-reveal.v3-in{opacity:1;transform:none;}
@media(prefers-reduced-motion:reduce){.v3-reveal{opacity:1;transform:none;}}
`;
