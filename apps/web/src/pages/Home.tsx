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
        <Logo variant={scrolled ? "ink" : "bone"} />
        {/* Desktop nav */}
        <nav
          className={"hidden md:flex items-center gap-7 text-[10px] uppercase tracking-[0.22em] transition-colors duration-300 " +
            (scrolled ? "text-[#0a0a0a]" : "text-[#f1eee7]")}
          style={scrolled ? undefined : { textShadow: "0 1px 3px rgba(0,0,0,0.6)" }}
        >
          <Link to="/x402-demo" className="hover:opacity-60 transition-opacity">x402 demo</Link>
          <Link to="/docs" className="hover:opacity-60 transition-opacity">Docs</Link>
          <a href="#how" className="hover:opacity-60 transition-opacity">Como funciona</a>
          <Link to="/login" className="hover:opacity-60 transition-opacity">Entrar</Link>
          <Link to="/signup"
            style={{ textShadow: "none" }}
            className="bg-[#b5e853] text-[#0a0a0a] px-4 py-2 hover:bg-[#a8d949] transition-colors text-[10px] uppercase tracking-[0.22em] flex items-center gap-2 font-medium">
            <span className="inline-block w-1 h-1 bg-[#0a0a0a]" />
            Criar conta
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
              { to: "/", label: "Início" },
              { to: "/x402-demo", label: "x402 demo" },
              { to: "/docs", label: "Docs" },
              { to: "/login", label: "Entrar" },
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
              Criar conta
            </Link>
          </nav>
          <div className="px-5 py-6 text-[10px] uppercase tracking-[0.22em] text-[#f1eee7]/55 font-mono">
            Vivo na mainnet Stellar · contrato CBJMQ6ZY…
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
          className="md:hidden w-full h-[48vh] min-h-[340px] max-h-[480px] bg-[position:center_30%]"
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
      <section className="max-w-[1400px] mx-auto px-5 md:px-12 pt-6 md:pt-24 pb-16 md:pb-32 relative">
        <div className="grid grid-cols-12 gap-6 md:gap-6 items-end">
          <div className="col-span-12 mb-4 md:mb-0">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] uppercase tracking-[0.22em] text-[#0a0a0a]/55 font-mono">
              <span className="flex items-center gap-2">
                <span className="inline-block w-2 h-2 bg-[#b5e853]" />
                Mainnet · Stellar
              </span>
              <span className="opacity-50 hidden md:inline">·</span>
              <span className="tabular-nums">Live · v0.2</span>
            </div>
          </div>
          <div className="col-span-12">
            <div className="text-[10px] uppercase tracking-[0.22em] text-[#0a0a0a]/55 mb-3 md:mb-4 font-mono">
              ╱╱  Issue 001 · pra quem vende no Brasil
            </div>
            <h1 className="text-[9vw] sm:text-[7.5vw] md:text-[4.2vw] font-medium leading-[1.04] tracking-[-0.03em] max-w-[14ch] md:max-w-[20ch] break-words">
              A conta em dólar que mora<br/>
              <em className="not-italic">dentro do Pix.</em>
              <span className="inline-block align-middle ml-2 md:ml-3 w-2 md:w-2.5 h-2 md:h-2.5 bg-[#b5e853] -translate-y-[0.45em]" />
            </h1>
            <p className="mt-5 md:mt-8 text-[15px] md:text-xl leading-[1.5] text-[#0a0a0a]/80 max-w-[54ch]">
              Toda venda vira dólar na sua carteira em 6 segundos, com taxa de
              0,98% — a mais barata do mercado. Sem custódia, sem chargeback.
              Hoje em USDC; a entrada via Pix chega com parceiro de câmbio licenciado.
            </p>
            <div className="mt-8 md:mt-10">
              <MagneticCTA to="/signup">
                Criar conta <span>→</span>
              </MagneticCTA>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-12 gap-6 mt-20 md:mt-28 border-t border-[#0a0a0a]/15 pt-12">
          <div className="col-span-12">
            <div className="text-[10px] uppercase tracking-[0.22em] text-[#0a0a0a]/55 font-mono">
              ┃ A tese
            </div>
          </div>
          <div className="col-span-12">
            <p className="text-lg md:text-xl leading-[1.55] tracking-tight max-w-[54ch]">
              O brasileiro já se dolariza em massa: <em className="font-light">98%</em> das
              compras de cripto no país no 1º trimestre de 2026 foram stablecoin —
              US$ 6,8 bi de US$ 6,9 bi, hedge contra o real. Mas esse dólar mora numa
              exchange, longe do caixa do negócio. O Slippay coloca o dólar
              <em className="font-light"> no recebimento</em>: você recebe e fica em
              dólar na própria carteira, em 6 segundos, sem custódia e sem chargeback.
              Não é poupança em dólar — é caixa em dólar.
            </p>
          </div>
          <div className="col-span-12 flex md:justify-end items-end">
            <Link to="/signup"
              className="group inline-flex items-center gap-3 text-[11px] uppercase tracking-[0.22em] border-b border-[#0a0a0a] pb-1 hover:opacity-60">
              Entrar na lista <span className="group-hover:translate-x-1 transition-transform">→</span>
            </Link>
          </div>
        </div>
      </section>

      {/* NUMBERS */}
      <section className="border-t border-[#0a0a0a]/15">
        <div className="max-w-[1400px] mx-auto px-5 md:px-12 py-20 md:py-32">
          <div className="grid grid-cols-12 gap-6 mb-16">
            <div className="col-span-12 font-mono text-[10px] uppercase tracking-[0.22em] text-[#0a0a0a]/55">
              ┃ Números
            </div>
            <div className="col-span-12 font-mono text-[10px] uppercase tracking-[0.22em] text-[#0a0a0a]/55 tabular-nums">
              002 · A economia
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-[#0a0a0a]/15 border border-[#0a0a0a]/15">
            <Stat n="98%" label="das compras cripto no BR são stablecoin"
              count={{ to: 98, decimals: 0, suffix: "%" }}
              body="No 1º trimestre de 2026, US$ 6,8 bi de US$ 6,9 bi em compras de cripto no Brasil foram stablecoin (MEXC · Chainalysis). Dolarização não é tese — é o fluxo dominante." />
            <Stat n="$6-8bi" label="volume cripto/mês no Brasil"
              body="~90% em stablecoin, +250% ano a ano. Brasil é o 5º maior mercado de adoção do mundo (era 10º). O motivo declarado: hedge contra o real." />
            <Stat n="6s" label="finalidade na Stellar"
              count={{ to: 6, decimals: 0, suffix: "s" }}
              body="Settlement determinístico on-chain. Sem T+1, sem janela de lote, sem chargeback. Taxa de rede 0,00001 XLM (~US$0,000001), auditável por qualquer um." />
          </div>
        </div>
      </section>

      {/* PROOF · verifiable on-chain */}
      <section id="proof" className="border-t border-[#0a0a0a]/15 bg-[#0a0a0a] text-[#f1eee7]">
        <div className="max-w-[1400px] mx-auto px-5 md:px-12 py-20 md:py-28">
          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-12 font-mono text-[10px] uppercase tracking-[0.22em] text-[#f1eee7]/55">
              ┃ Prova
            </div>
            <div className="col-span-12">
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#f1eee7]/55 mb-6 tabular-nums">
                002b · Verificável on-chain
              </div>
              <h2 className="text-2xl md:text-4xl font-medium tracking-[-0.03em] leading-[1.1] max-w-[26ch]">
                Não é promessa. Não é protótipo.<br/><em className="font-light">Vivo na mainnet da Stellar.</em>
              </h2>
              <p className="mt-6 text-sm md:text-base leading-[1.65] text-[#f1eee7]/75 max-w-[60ch]">
                Primitiva de assinatura v0.2 implantada na mainnet da Stellar em
                16/05/2026. USDC real movido on-chain pelo fluxo de demo x402.
                As duas transações abaixo são auditáveis publicamente no stellar.expert.
                A auditoria completa (8 críticas + 14 altas fechadas) está no
                link abaixo.
              </p>
              <div className="mt-10 border border-[#f1eee7]/15">
                <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-[#f1eee7]/15">
                  <div className="p-6 md:p-8">
                    <div className="text-[10px] uppercase tracking-[0.22em] text-[#b5e853] font-mono">Contrato · MAINNET v0.2</div>
                    <a href="https://stellar.expert/explorer/public/contract/CBJMQ6ZYQJ2OMM46FGXPEIKKZDRHHERBXUVE54ZN64FDPKN5DJKSEVQN"
                       target="_blank" rel="noopener noreferrer"
                       className="mt-3 block font-mono text-xs md:text-sm break-all hover:text-[#b5e853]">
                      CBJMQ6ZY...DJKSEVQN
                    </a>
                    <div className="mt-2 text-[10px] uppercase tracking-[0.22em] text-[#f1eee7]/55 font-mono">Soroban SDK 26 · F5 fechado pré-deploy</div>
                  </div>
                  <div className="p-6 md:p-8">
                    <div className="text-[10px] uppercase tracking-[0.22em] text-[#b5e853] font-mono">Pagamento x402 · MAINNET</div>
                    <a href="https://stellar.expert/explorer/public/tx/aa3304c93beffde1809ced4989b898cf419b8121e8ca9b50d01d407ccbf8326b"
                       target="_blank" rel="noopener noreferrer"
                       className="mt-3 block font-mono text-xs md:text-sm break-all hover:text-[#b5e853]">
                      aa3304c9...0d407ccb
                    </a>
                    <div className="mt-2 text-[10px] uppercase tracking-[0.22em] text-[#f1eee7]/55 font-mono">0,05 USDC · comprador → vendedor · 6s de finalidade</div>
                  </div>
                </div>
                <div className="border-t border-[#f1eee7]/15 px-6 md:px-8 py-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-[10px] uppercase tracking-[0.22em] text-[#f1eee7]/55 font-mono">
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                    <div className="flex items-center gap-3">
                      <span className="inline-block w-2 h-2 bg-[#b5e853] animate-pulse" />
                      Vivo na mainnet Stellar
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
                    6 auditorias · 8 críticas + 14 altas fechadas →
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
            <div className="col-span-12 font-mono text-[10px] uppercase tracking-[0.22em] text-[#0a0a0a]/55">
              ┃ Mecânica
            </div>
            <div className="col-span-12">
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#0a0a0a]/55 mb-6 tabular-nums">
                003 · Como funciona
              </div>
              <h2 className="text-3xl md:text-5xl font-medium tracking-[-0.03em] leading-[1.05] max-w-[24ch]">
                Quatro partes.<br/>Uma transação <em className="font-light">atômica</em>.
              </h2>
              <div className="mt-16 grid md:grid-cols-2 gap-x-16 gap-y-14">
                <Step n="01" title="Crie a cobrança"
                  body="POST /v1/orders com o valor em dólar. USDC denominado 1:1 contra o USD; sem ida e volta de FX embutida na cobrança." />
                <Step n="02" title="O cliente paga"
                  body="Hoje, o cliente paga em USDC direto da carteira Stellar. Em breve, paga em Pix (BRL) via parceiro de câmbio licenciado, que entrega o USDC no seu endereço." />
                <Step n="03" title="O listener confirma on-chain"
                  body="O stream da Horizon observa o seu endereço, casa o pagamento pelo memo, valida valor e emissor do ativo, e marca status=pago em 6s de finalidade determinística." />
                <Step n="04" title="O webhook dispara, assinado com HMAC"
                  body="Seu endpoint recebe order.paid (ou subscription.charged). Retry exponencial: 1m, 5m, 30m, 2h, 12h, 24h, dead. O USDC fica na sua carteira até você decidir converter." />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* REGULATORY / STACK */}
      <section id="stack" className="border-t border-[#0a0a0a]/15">
        <div className="max-w-[1400px] mx-auto px-5 md:px-12 py-20 md:py-32">
          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-12 font-mono text-[10px] uppercase tracking-[0.22em] text-[#0a0a0a]/55">
              ┃ Posição
            </div>
            <div className="col-span-12">
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#0a0a0a]/55 mb-6 tabular-nums">
                004 · Regulatório
              </div>
              <h2 className="text-3xl md:text-5xl font-medium tracking-[-0.03em] leading-[1.05] max-w-[26ch]">
                Feito para a janela<br/>que <em className="font-light">acabou de abrir</em>.
              </h2>
              <p className="mt-10 text-base md:text-lg leading-[1.65] text-[#0a0a0a]/75 max-w-[66ch]">
                O Slippay é provedor de tecnologia de pagamento — não detém custódia,
                não opera câmbio e não é instituição financeira. A conversão BRL→USDC
                será executada por instituição autorizada pelo BCB (câmbio + PSAV),
                parceiro de câmbio em definição. O fluxo
                é <em className="font-light">doméstico</em>: não há liquidação cross-border
                via blockchain, e a Res. BCB 561/2026 não se aplica a ele por design
                arquitetural. Risco residual de reinterpretação regulatória existe e é
                monitorado ativamente.
              </p>

              <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-px bg-[#0a0a0a]/15 border border-[#0a0a0a]/15">
                <Cell label="Rede" value="Stellar" />
                <Cell label="Ativos" value="USDC · PYUSD" />
                <Cell label="Entrada" value="Pix · BRL" />
                <Cell label="Custódia" value="Sua · não-custodial" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-[#0a0a0a]/15">
        <div className="max-w-[1400px] mx-auto px-5 md:px-12 py-32 md:py-40 relative">
          <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#0a0a0a]/55 mb-8 tabular-nums">
            005 · Comece <span className="inline-block w-2 h-2 bg-[#b5e853] ml-2 align-middle" />
          </div>
          <h2 className="text-[12vw] md:text-[5.2vw] font-medium tracking-[-0.04em] leading-[0.95] max-w-[14ch]">
            Pronto quando<br/><em className="font-light">seu caixa estiver</em>.
          </h2>
          <p className="mt-10 text-base md:text-lg text-[#0a0a0a]/75 max-w-[50ch]">
            Cadastre-se. Informe seu endereço Stellar de recebimento. Escolha USDC
            ou PYUSD. Copie sua API key. Comece a receber em dólar on-chain hoje;
            a entrada via Pix entra com o parceiro de câmbio.
          </p>
          <Link to="/signup"
            className="inline-flex items-center gap-3 mt-12 bg-[#0a0a0a] text-[#f1eee7] px-10 py-5 text-[11px] uppercase tracking-[0.22em] hover:bg-[#1a1a1a]">
            Criar conta <span>→</span>
          </Link>
        </div>
      </section>

      {/* FOOTER — oversized wordmark, editorial */}
      <footer className="border-t border-[#0a0a0a]/15 bg-[#0a0a0a] text-[#f1eee7]">
        <div className="max-w-[1400px] mx-auto px-5 md:px-12 pt-20 pb-8">
          <div className="grid grid-cols-12 gap-6 pb-16 border-b border-[#f1eee7]/15">
            <div className="col-span-12 md:col-span-4">
              <div className="text-[10px] uppercase tracking-[0.22em] text-[#f1eee7]/55 font-mono mb-4">
                ┃ Produto
              </div>
              <ul className="space-y-2 text-sm">
                <li><Link to="/signup" className="hover:opacity-60">Criar conta</Link></li>
                <li><Link to="/login" className="hover:opacity-60">Entrar</Link></li>
                <li><a href="#how" className="hover:opacity-60">Como funciona</a></li>
              </ul>
            </div>
            <div className="col-span-12 md:col-span-4">
              <div className="text-[10px] uppercase tracking-[0.22em] text-[#f1eee7]/55 font-mono mb-4">
                ┃ Recursos
              </div>
              <ul className="space-y-2 text-sm">
                <li><Link to="/docs/api-reference/orders" className="hover:opacity-60">API docs</Link></li>
                <li><Link to="/docs/api-reference/webhooks" className="hover:opacity-60">Guia de webhook</Link></li>
                <li><Link to="/docs/security/audit-001" className="hover:opacity-60">Auditorias de segurança</Link></li>
                <li><Link to="/docs/integrations/x402" className="hover:opacity-60">x402 protocol</Link></li>
                <li><a href="https://galmanus.github.io/ssl-spec/" target="_blank" rel="noopener noreferrer" className="hover:opacity-60">SSL spec ↗</a></li>
              </ul>
            </div>
            <div className="col-span-12 md:col-span-4">
              <div className="text-[10px] uppercase tracking-[0.22em] text-[#f1eee7]/55 font-mono mb-4">
                ┃ Legal
              </div>
              <ul className="space-y-2 text-sm">
                <li><a href="#" className="hover:opacity-60">Termos</a></li>
                <li><a href="#" className="hover:opacity-60">Privacidade</a></li>
              </ul>
            </div>
          </div>

          <div className="pt-16 pb-8 leading-none">
            <span className="block text-[#f1eee7] text-[20vw] md:text-[14vw] font-medium tracking-[-0.05em] -mb-4">
              slippay<span className="text-[#b5e853]">.</span>
            </span>
          </div>

          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 text-[10px] uppercase tracking-[0.22em] text-[#f1eee7]/55 font-mono">
            <div>© 2026 · Bluewave AI · Mainnet · Stellar</div>
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
