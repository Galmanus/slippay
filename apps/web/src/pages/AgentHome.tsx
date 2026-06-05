// SlipPay landing — PT-BR, minimalista/editorial. Fundo bone, tipografia grande,
// muito ar, verde money (#65a30d) como acento único (#b5e853 sobre preto). Card +
// MandateDemo são as âncoras visuais. Funil: o que é → por que (controle) →
// prova → quanto custa → testar grátis. Comércio exterior NÃO aparece (deck).

import { Link } from "react-router-dom";
import { Logo } from "../components/Logo.tsx";
import { MandateDemo } from "../components/MandateDemo.tsx";
import { LivePaymentCard } from "../components/LivePaymentCard.tsx";
import { ConnectWallet } from "../components/ConnectWallet.tsx";
import { useEffect, useState } from "react";

const AUDIT_CONTRACT = "CBJMQ6ZYQJ2OMM46FGXPEIKKZDRHHERBXUVE54ZN64FDPKN5DJKSEVQN";
const AUDIT_URL = `https://stellar.expert/explorer/public/contract/${AUDIT_CONTRACT}`;

const TIERS = [
  { name: "Starter", price: "R$2.500", per: "/mês", who: "pra começar e testar", featured: false },
  { name: "Growth", price: "R$7.500", per: "/mês", who: "quando os pagamentos crescem", featured: true },
  { name: "Business", price: "R$20.000", per: "/mês", who: "pro time financeiro inteiro", featured: false },
];

const FAQ = [
  ["É seguro deixar um agente pagando minhas contas?",
    "Sim. O agente não decide nada. Ele só executa o que você aprovou. Antes de cada pagamento, confere o destinatário, o valor e o limite. Se algo fugir da regra, ele para e te chama. E você pausa quando quiser."],
  ["O dinheiro fica com a SlipPay?",
    "Nunca. O dinheiro fica numa carteira que é só sua. Nem a SlipPay consegue mexer nele. A gente cuida da automação, não do seu dinheiro."],
  ["Como ele paga sem eu aprovar toda vez?",
    "Você define as regras uma vez: quanto pode gastar, pra quem e com que frequência. Dentro disso, o agente executa sozinho. Passou do limite ou fugiu da regra, ele para na hora."],
  ["Preciso entender de cripto ou blockchain?",
    "Não. Você usa como qualquer aplicativo. A blockchain é só onde cada pagamento fica registrado, pra você poder conferir tudo sem depender da nossa palavra."],
  ["Em que moeda o agente paga?",
    "Hoje, em dólar digital (USDC): liquida em segundos, sem estorno. Pagamento direto em real, via Pix, está no roadmap."],
  ["Já funciona de verdade ou é protótipo?",
    "Já funciona. Pagamentos reais já aconteceram e ficam registrados. Você verifica cada transação. Não é simulação nem maquete."],
  ["Tem teste grátis? Quanto custa?",
    "14 dias grátis, sem cartão. Depois, um plano sob medida pro tamanho da sua operação, sempre menos que as horas que o agente te devolve."],
  ["Consigo pausar ou cancelar?",
    "A qualquer momento, num clique. O controle é sempre seu."],
];

function Eyebrow({ children, dark = false }: { children: React.ReactNode; dark?: boolean }) {
  return <div className={`font-mono text-[10px] uppercase tracking-[0.3em] ${dark ? "text-[#b5e853]" : "text-[#0a0a0a]/40"} mb-6`}>{children}</div>;
}

export default function AgentHome() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const bar = document.getElementById("scrollbar");
    const onScroll = () => {
      const h = document.documentElement;
      const max = h.scrollHeight - h.clientHeight;
      if (bar) bar.style.width = (max > 0 ? (h.scrollTop / max) * 100 : 0) + "%";
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    root.classList.add("js-reveal");
    const io = new IntersectionObserver((ents) => {
      for (const e of ents) if (e.isIntersecting) { e.target.classList.add("reveal-in"); io.unobserve(e.target); }
    }, { rootMargin: "-8% 0px -8% 0px", threshold: 0.06 });
    document.querySelectorAll("[data-reveal]").forEach((el) => io.observe(el));
    return () => { io.disconnect(); root.classList.remove("js-reveal"); };
  }, []);

  return (
    <div className="min-h-screen bg-[#f1eee7] text-[#0a0a0a] overflow-x-hidden">
      <div className="scroll-progress" id="scrollbar" />
      <header className="relative px-6 md:px-12 py-7 flex items-center justify-between">
        <Logo />
        <nav className="flex items-center gap-8 text-[10px] uppercase tracking-[0.22em] text-[#0a0a0a]/55">
          <Link to="/manifesto" className="navlink hover:text-[#0a0a0a] hidden sm:inline">Manifesto</Link>
          <Link to="/seguranca" className="navlink hover:text-[#0a0a0a] hidden sm:inline">Segurança</Link>
          <a href="#precos" className="navlink hover:text-[#0a0a0a] hidden sm:inline">Preços</a>
          <a href="https://slippay.gitbook.io/slippay-docs" target="_blank" rel="noreferrer" className="navlink hover:text-[#0a0a0a] hidden sm:inline">Docs</a>
          <ConnectWallet className="hidden sm:inline-flex items-center rounded-full px-5 py-2.5 border border-[#0a0a0a]/25 hover:border-[#0a0a0a] text-[10px] uppercase tracking-[0.22em] disabled:opacity-50" />
          <Link to="/pay" className="hidden sm:inline-flex items-center rounded-full px-5 py-2.5 bg-[#b5e853] text-[#0a0a0a] hover:opacity-90">Testar grátis</Link>
          {/* hamburger — mobile only */}
          <button onClick={() => setMenuOpen((v) => !v)} aria-label="Menu" className="sm:hidden flex flex-col gap-[5px] p-1">
            <span className={`block w-6 h-[2px] bg-[#0a0a0a] transition-transform ${menuOpen ? "translate-y-[7px] rotate-45" : ""}`} />
            <span className={`block w-6 h-[2px] bg-[#0a0a0a] transition-opacity ${menuOpen ? "opacity-0" : ""}`} />
            <span className={`block w-6 h-[2px] bg-[#0a0a0a] transition-transform ${menuOpen ? "-translate-y-[7px] -rotate-45" : ""}`} />
          </button>
        </nav>
        {/* mobile menu panel */}
        {menuOpen && (
          <div className="sm:hidden absolute top-full left-0 right-0 z-50 bg-[#f1eee7] border-y border-[#0a0a0a]/10 px-6 py-4 flex flex-col gap-1 text-[12px] uppercase tracking-[0.18em]">
            <Link to="/manifesto" onClick={() => setMenuOpen(false)} className="py-3 border-b border-[#0a0a0a]/8">Manifesto</Link>
            <Link to="/seguranca" onClick={() => setMenuOpen(false)} className="py-3 border-b border-[#0a0a0a]/8">Segurança</Link>
            <a href="#precos" onClick={() => setMenuOpen(false)} className="py-3 border-b border-[#0a0a0a]/8">Preços</a>
            <a href="https://slippay.gitbook.io/slippay-docs" target="_blank" rel="noreferrer" onClick={() => setMenuOpen(false)} className="py-3 border-b border-[#0a0a0a]/8">Docs</a>
            <ConnectWallet className="mt-3 inline-flex items-center justify-center rounded-full px-5 py-3 border border-[#0a0a0a]/25 text-[12px] uppercase tracking-[0.18em]" />
            <Link to="/pay" onClick={() => setMenuOpen(false)} className="mt-2 inline-flex items-center justify-center rounded-full px-5 py-3 bg-[#b5e853] text-[#0a0a0a]">Testar grátis</Link>
          </div>
        )}
      </header>

      {/* HERO */}
      <section className="relative">
        <div className="max-w-[1240px] mx-auto px-6 md:px-12 pt-8 md:pt-24 pb-20 md:pb-36">
          <div className="grid lg:grid-cols-[1.1fr_minmax(360px,420px)] gap-10 lg:gap-20 items-center">
            <div className="hero-in">
              <Eyebrow>dólar de verdade, no automático</Eyebrow>
              <h1 className="text-[44px] leading-[0.95] md:text-[80px] md:leading-[0.92] font-semibold tracking-[-0.045em] max-w-[15ch]">
                <span className="mask-clip"><span className="mask-up">Seu dinheiro, no automático.</span></span>
              </h1>
              <div className="lg:hidden mt-9">
                <LivePaymentCard />
              </div>
              <p className="mt-9 text-xl text-[#0a0a0a]/70 leading-relaxed max-w-[46ch]">
                A SlipPay coloca no seu bolso o que antes era só dos bancos e dos grandes: dinheiro em dólar
                que trabalha sozinho. Ela recebe os seus pagamentos e paga as suas contas, na hora, sem
                maquininha e sem estorno.
                <span className="text-[#0a0a0a] font-medium"> O dinheiro continua sendo seu, e ela só faz o que você autorizou.</span>
              </p>
              <div className="mt-11 flex flex-wrap items-center gap-7">
                <Link to="/pay" className="lift inline-flex items-center rounded-full px-9 py-4 text-[11px] uppercase tracking-[0.2em] bg-[#b5e853] text-[#0a0a0a]">Testar grátis</Link>
                <a href="#precos" className="text-[12px] uppercase tracking-[0.18em] text-[#0a0a0a]/55 hover:text-[#0a0a0a] border-b border-[#0a0a0a]/20 pb-1">Quanto custa?</a>
              </div>
              <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.16em] text-[#0a0a0a]/40">grátis pra testar · sem cartão</p>
              <p className="mt-7 text-[15px] text-[#0a0a0a]/50 leading-relaxed max-w-[44ch]">
                Pra SaaS, agências, e-commerce e empresas que pagam ou recebem em dólar.
              </p>
            </div>
            <div className="hero-in hidden lg:block">
              <LivePaymentCard />
            </div>
          </div>
        </div>
      </section>

      {/* TRUST STRIP — credibilidade honesta (parceiros de tech, não depoimento falso) */}
      <section className="border-t border-[#0a0a0a]/10">
        <div className="max-w-[1240px] mx-auto px-6 md:px-12 py-7 flex flex-wrap items-center gap-x-8 gap-y-3 font-mono text-[11px] uppercase tracking-[0.18em] text-[#0a0a0a]/45">
          <span>construído sobre</span>
          <span className="text-[#0a0a0a]/75">Stellar</span>
          <span className="opacity-30">·</span>
          <span className="text-[#0a0a0a]/75">Circle · USDC + CCTP</span>
          <span className="opacity-30">·</span>
          <span>cada pagamento verificável on-chain</span>
        </div>
      </section>

      {/* O QUE SE REPETE — uma linha */}
      <section className="border-t border-[#0a0a0a]/10">
        <div data-reveal className="max-w-[1240px] mx-auto px-6 md:px-12 py-20 md:py-28">
          <Eyebrow>o que o agente cuida</Eyebrow>
          <p className="text-3xl md:text-5xl font-semibold tracking-[-0.03em] leading-[1.08] max-w-[22ch]">
            O agente cuida dos pagamentos que seguem regras previsíveis.
          </p>
          <p className="mt-7 text-xl text-[#0a0a0a]/55 leading-relaxed max-w-[46ch]">Assinaturas, APIs, fornecedores, prestadores e outras cobranças recorrentes.</p>
        </div>
      </section>

      {/* MAIS BARATO QUE A STRIPE */}
      <section className="border-t border-[#0a0a0a]/10">
        <div data-reveal className="max-w-[1240px] mx-auto px-6 md:px-12 py-24 md:py-32">
          <Eyebrow>mais barato e mais seguro que a stripe</Eyebrow>
          <h2 className="text-4xl md:text-6xl font-semibold tracking-[-0.04em] leading-[0.95] max-w-[13ch]">Economize ~3% em cada transação.</h2>
          <p className="mt-8 text-xl text-[#0a0a0a]/60 leading-relaxed max-w-[52ch]">
            Cartão e Stripe levam perto de 3% de cada venda. No Brasil, mais ainda. Na Stellar, mover
            dinheiro custa frações de centavo. A SlipPay repassa essa economia pra você:
            <span className="text-[#0a0a0a] font-medium"> a mesma venda, com uma fração da taxa, e sem chargeback.</span>
          </p>
          <div className="mt-12 grid sm:grid-cols-2 gap-px bg-[#0a0a0a]/12 border border-[#0a0a0a]/12 max-w-[680px]">
            <div className="bg-white p-7 md:p-8">
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#0a0a0a]/45">cartão / stripe</div>
              <div className="mt-4 text-4xl font-semibold tabular-nums tracking-[-0.03em]">~2,9%+</div>
              <div className="mt-2 text-[14px] text-[#0a0a0a]/55 leading-snug">por transação, e ainda sujeito a chargeback</div>
            </div>
            <div className="bg-[#0a0a0a] text-[#f1eee7] p-7 md:p-8">
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#b5e853]">slippay · na stellar</div>
              <div className="mt-4 text-4xl font-semibold tracking-[-0.03em]">uma fração</div>
              <div className="mt-2 text-[14px] text-[#f1eee7]/60 leading-snug">taxa de rede quase zero · final em segundos · sem chargeback</div>
            </div>
          </div>
          <p className="mt-12 text-xl text-[#0a0a0a]/60 leading-relaxed max-w-[52ch]">
            E mais seguro. A Stripe é centralizada: segura o seu dinheiro e pode congelar a sua conta a
            qualquer momento. <span className="text-[#0a0a0a] font-medium">A SlipPay é non-custodial: o dinheiro nunca sai da sua carteira, e ninguém consegue travar.</span>
          </p>
        </div>
      </section>

      {/* COMO USAR HOJE — pro CNPJ com conta no banco */}
      <section className="border-t border-[#0a0a0a]/10 bg-[#0a0a0a] text-[#f1eee7]">
        <div data-reveal className="max-w-[1240px] mx-auto px-6 md:px-12 py-24 md:py-32">
          <Eyebrow dark>tem conta no nubank, bb ou bradesco?</Eyebrow>
          <h2 className="text-4xl md:text-6xl font-semibold tracking-[-0.045em] leading-[0.95] max-w-[14ch]">Veja como começar, com o que você já tem.</h2>
          <div className="mt-16 grid md:grid-cols-3 gap-12 md:gap-10">
            {[
              ["01", "Crie sua conta", "Com o seu rosto, em um minuto. Sem senha, sem frase pra decorar, sem cartão. De graça."],
              ["02", "Seu Pix vira dólar", "Você faz um Pix da sua conta (Nubank, BB, Bradesco) numa corretora confiável, compra dólar digital e manda pra sua carteira. A gente te guia no passo a passo, leva uns minutos."],
              ["03", "O agente assume", "Você define quanto pode gastar e pra quem. Daí o agente paga as suas contas em dólar, sozinho, sempre dentro das suas regras."],
            ].map(([n, h, b]) => (
              <div key={n}>
                <div className="font-mono text-[12px] text-[#b5e853] mb-4">{n}</div>
                <div className="text-2xl font-semibold tracking-[-0.02em]">{h}</div>
                <p className="mt-3 text-[15px] text-[#f1eee7]/60 leading-relaxed">{b}</p>
              </div>
            ))}
          </div>
          <p className="mt-14 text-lg text-[#f1eee7]/55 leading-relaxed max-w-[54ch]">
            O Pix direto pra dólar, sem passar por corretora, está chegando. E se você quiser, a gente
            coloca o seu primeiro dólar junto com você, na mão. <a href="/signup" className="text-[#b5e853] hover:underline underline-offset-4">Fale com a gente.</a>
          </p>
        </div>
      </section>

      {/* MULTI-CHAIN — aceita USDC de qualquer chain via CCTP */}
      <section className="border-t border-[#0a0a0a]/10">
        <div data-reveal className="max-w-[1240px] mx-auto px-6 md:px-12 py-20 md:py-28">
          <Eyebrow>traga seu dólar de qualquer lugar</Eyebrow>
          <h2 className="text-3xl md:text-5xl font-semibold tracking-[-0.03em] leading-[1.02] max-w-[16ch]">Aceita USDC de qualquer blockchain.</h2>
          <p className="mt-7 text-xl text-[#0a0a0a]/60 leading-relaxed max-w-[52ch]">
            Seu dólar chega na carteira vindo de Ethereum, Base, Solana e mais de 15 redes, pela tecnologia da Circle (CCTP).
            Dólar nativo, queimado e mintado pela própria Circle: <span className="text-[#0a0a0a] font-medium">sem bridge de risco, sem token embrulhado.</span>
          </p>
          <div className="mt-10 flex flex-wrap gap-x-7 gap-y-3 font-mono text-[12px] uppercase tracking-[0.16em] text-[#0a0a0a]/55">
            {["Ethereum", "Base", "Solana", "Arbitrum", "Optimism", "Polygon", "Avalanche", "Unichain", "Linea", "+ mais"].map((c) => (
              <span key={c} className="flex items-center gap-2"><span className="text-[#65a30d]">◆</span>{c}</span>
            ))}
          </div>
        </div>
      </section>

      {/* CONTROLE — a frase que mata a objeção */}
      <section className="border-t border-[#0a0a0a]/10 bg-[#0a0a0a] text-[#f1eee7]">
        <div data-reveal className="max-w-[1240px] mx-auto px-6 md:px-12 py-28 md:py-40">
          <Eyebrow dark>controle total</Eyebrow>
          <h2 className="text-5xl md:text-7xl font-semibold tracking-[-0.045em] leading-[0.95] max-w-[12ch]">
            O agente não decide. <span className="text-[#b5e853]">Ele executa.</span>
          </h2>
          <p className="mt-9 text-xl text-[#f1eee7]/65 leading-relaxed max-w-[46ch]">
            <span className="text-[#f1eee7] font-medium">Seu dinheiro nunca sai do seu controle.</span> Você
            define as regras, e antes de cada pagamento o agente verifica quem vai receber, quanto pode
            gastar, se está dentro da política e se o limite ainda existe.
          </p>
          <div className="mt-12 flex flex-wrap gap-x-10 gap-y-4 font-mono text-[12px] uppercase tracking-[0.18em] text-[#f1eee7]/55">
            {["quem recebe", "quanto", "política", "limite"].map((c) => (
              <span key={c} className="flex items-center gap-2.5"><span className="text-[#b5e853]">✓</span>{c}</span>
            ))}
          </div>
          <p className="mt-14 text-2xl md:text-3xl font-medium tracking-[-0.02em] text-[#f1eee7]/90 max-w-[26ch]">
            O agente pode se enganar. A regra que protege o seu dinheiro, não. Fora dela, ele para e te chama.
          </p>
        </div>
      </section>

      {/* EXEMPLO — concreto, R$ */}
      <section className="border-t border-[#0a0a0a]/10">
        <div data-reveal className="max-w-[1240px] mx-auto px-6 md:px-12 py-24 md:py-32 grid md:grid-cols-[1fr_1fr] gap-16 lg:gap-24 items-center">
          <div>
            <Eyebrow>um exemplo</Eyebrow>
            <h2 className="text-4xl md:text-6xl font-semibold tracking-[-0.04em] leading-[0.95] max-w-[12ch]">R$40 mil por mês, no automático.</h2>
            <p className="mt-8 text-xl text-[#0a0a0a]/65 leading-relaxed max-w-[40ch]">
              O agente executa os pagamentos recorrentes dentro das regras aprovadas, e só pede ajuda
              quando algo foge do padrão.
            </p>
          </div>
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#0a0a0a]/40 pb-6">uma empresa · todo mês</div>
            {[
              ["APIs", "R$20.000"],
              ["Fornecedores", "R$13.000"],
              ["Assinaturas", "R$7.000"],
            ].map(([l, v]) => (
              <div key={l} className="flex items-baseline justify-between py-4 border-t border-[#0a0a0a]/10">
                <span className="text-lg text-[#0a0a0a]/70">{l}</span>
                <span className="text-xl font-semibold tabular-nums">{v}</span>
              </div>
            ))}
            <div className="flex items-baseline justify-between pt-6 mt-2 border-t-2 border-[#0a0a0a]">
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#65a30d]">pago pelo agente</span>
              <span className="text-3xl font-semibold tabular-nums">R$40 mil</span>
            </div>
          </div>
        </div>
      </section>

      {/* PROVA */}
      <section className="border-t border-[#0a0a0a]/10">
        <div data-reveal className="max-w-[1240px] mx-auto px-6 md:px-12 py-24 md:py-32 grid md:grid-cols-[1fr_1fr] gap-16 items-center">
          <div>
            <Eyebrow>já está funcionando</Eyebrow>
            <h2 className="text-4xl md:text-6xl font-semibold tracking-[-0.04em] leading-[0.95] max-w-[12ch]">Não é promessa.</h2>
            <p className="mt-8 text-xl text-[#0a0a0a]/65 leading-relaxed max-w-[42ch]">
              Dinheiro real já está se movendo com a SlipPay. Você não precisa confiar na nossa palavra:
              acompanha os pagamentos, confere os limites e verifica cada transação você mesmo. Não é
              simulação. Não é protótipo.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-7">
              <a href={AUDIT_URL} target="_blank" rel="noreferrer" className="lift inline-flex items-center gap-2.5 rounded-full px-7 py-3.5 text-[11px] uppercase tracking-[0.18em] bg-[#0a0a0a] text-[#f1eee7]">Verificar on-chain<span className="w-1.5 h-1.5 rounded-full bg-[#b5e853]" /></a>
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#0a0a0a]/35">movido a Stellar + USDC</span>
            </div>
          </div>
          <MandateDemo />
        </div>
      </section>

      {/* VISÃO — a alma do manifesto, dark */}
      <section className="border-t border-[#0a0a0a]/10 bg-[#0a0a0a] text-[#f1eee7]">
        <div data-reveal className="max-w-[1240px] mx-auto px-6 md:px-12 py-24 md:py-40">
          <div className="font-mono text-[10px] uppercase tracking-[0.3em] text-[#b5e853] mb-6">a nossa visão</div>
          <h2 className="text-4xl md:text-7xl font-semibold tracking-[-0.045em] leading-[0.96] max-w-[18ch]">
            Sua moeda pode falhar. <span className="text-[#b5e853]">O seu dinheiro não precisa falhar com ela.</span>
          </h2>
          <p className="mt-12 text-xl md:text-2xl text-[#f1eee7]/70 leading-relaxed max-w-[54ch]">
            Dinheiro forte, em dólar, que sempre foi privilégio de banco e de quem já tinha acesso, agora
            cabe no bolso de qualquer empresa. Sem virar engenheiro, sem decorar jargão. A IA faz o trabalho
            pesado, e a regra que protege o seu dinheiro nunca depende dela.
          </p>
          <p className="mt-8 text-2xl md:text-3xl font-medium tracking-[-0.02em] max-w-[22ch]">
            O poder que era dos grandes, agora é seu.
          </p>
          <a href="/manifesto" className="mt-10 inline-flex items-center gap-2 text-[12px] uppercase tracking-[0.18em] text-[#b5e853] border-b border-[#b5e853]/40 hover:border-[#b5e853] pb-1">Leia o manifesto</a>
        </div>
      </section>

      {/* PREÇOS — comece grátis */}
      <section id="precos" className="border-t border-[#0a0a0a]/10">
        <div className="max-w-[1240px] mx-auto px-6 md:px-12 py-24 md:py-32">
          <Eyebrow>preços</Eyebrow>
          <h2 className="text-4xl md:text-6xl font-semibold tracking-[-0.04em] leading-[0.95] max-w-[14ch]">Comece grátis. Pague quando valer a pena.</h2>
          <p className="mt-8 text-xl text-[#0a0a0a]/60 leading-relaxed max-w-[50ch]">14 dias grátis, sem cartão. Depois, um plano sob medida pro tamanho da sua operação. A gente acerta o preço quando o agente já estiver te poupando trabalho.</p>

          <div className="mt-16 grid md:grid-cols-3 gap-8">
            {TIERS.map((t) => (
              <div key={t.name} className={`py-8 ${t.featured ? "border-t-2 border-[#65a30d]" : "border-t border-[#0a0a0a]/15"}`}>
                <div className="flex items-baseline justify-between">
                  <span className="text-lg font-semibold tracking-[-0.01em]">{t.name}</span>
                  {t.featured && <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#65a30d]">mais escolhido</span>}
                </div>
                <div className="mt-3 text-[15px] text-[#0a0a0a]/55">{t.who}</div>
              </div>
            ))}
          </div>

          <div className="mt-12 flex flex-wrap items-center gap-x-7 gap-y-4">
            <Link to="/pay" className="lift inline-flex items-center rounded-full px-9 py-4 text-[11px] uppercase tracking-[0.2em] bg-[#b5e853] text-[#0a0a0a]">Testar grátis</Link>
            <a href="/signup" className="text-[12px] uppercase tracking-[0.18em] text-[#0a0a0a]/55 hover:text-[#0a0a0a] border-b border-[#0a0a0a]/20 pb-1">Fale com a gente</a>
          </div>
          <p className="mt-10 text-[14px] text-[#0a0a0a]/45 max-w-[60ch] leading-relaxed">
            O dinheiro é sempre seu, nunca fica conosco, e cada pagamento dá pra conferir.
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-[#0a0a0a]/10">
        <div data-reveal className="max-w-[1240px] mx-auto px-6 md:px-12 py-24 md:py-32">
          <Eyebrow>perguntas frequentes</Eyebrow>
          <h2 className="text-4xl md:text-6xl font-semibold tracking-[-0.04em] leading-[0.95] max-w-[14ch]">Ainda com dúvida?</h2>
          <div className="mt-14 max-w-[820px]">
            {FAQ.map(([q, a], i) => {
              const open = openFaq === i;
              return (
                <div key={q} className="border-t border-[#0a0a0a]/12 last:border-b">
                  <button
                    onClick={() => setOpenFaq(open ? null : i)}
                    className="w-full flex items-center justify-between gap-6 py-6 text-left group"
                    aria-expanded={open}
                  >
                    <span className="text-lg md:text-2xl font-semibold tracking-[-0.02em] group-hover:text-[#65a30d] transition-colors">{q}</span>
                    <span className={`shrink-0 text-2xl leading-none text-[#65a30d] transition-transform duration-300 ${open ? "rotate-45" : ""}`}>+</span>
                  </button>
                  <div className="grid transition-all duration-300 ease-out" style={{ gridTemplateRows: open ? "1fr" : "0fr" }}>
                    <div className="overflow-hidden">
                      <p className="pb-7 text-lg text-[#0a0a0a]/65 leading-relaxed max-w-[60ch]">{a}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA FINAL */}
      <section className="border-t border-[#0a0a0a]/10 bg-[#0a0a0a] text-[#f1eee7]">
        <div className="max-w-[1240px] mx-auto px-6 md:px-12 py-32 md:py-44 text-center">
          <h2 className="text-5xl md:text-7xl font-semibold tracking-[-0.045em] leading-[0.95] max-w-[18ch] mx-auto">Configure as regras uma vez.</h2>
          <p className="mt-8 text-xl text-[#f1eee7]/60 leading-relaxed max-w-[42ch] mx-auto">Pare de aprovar os mesmos pagamentos para sempre. Teste grátis, sem cartão. O poder que era só dos grandes, agora na sua mão.</p>
          <div className="mt-12 flex justify-center">
            <Link to="/pay" className="lift inline-flex items-center rounded-full px-10 py-4 text-[11px] uppercase tracking-[0.2em] bg-[#b5e853] text-[#0a0a0a]">Testar grátis</Link>
          </div>
          <div className="mt-16 flex flex-wrap justify-center gap-7 text-[10px] uppercase tracking-[0.22em] text-[#f1eee7]/45">
            <a href="https://slippay.gitbook.io/slippay-docs" target="_blank" rel="noreferrer" className="hover:text-[#b5e853]">Docs ↗</a>
            <a href={AUDIT_URL} target="_blank" rel="noreferrer" className="hover:text-[#b5e853]">On-chain ↗</a>
            <a href="#precos" className="hover:text-[#b5e853]">Preços</a>
          </div>
          <div className="mt-8 font-mono text-[10px] uppercase tracking-[0.22em] text-[#f1eee7]/30">slippay · a forma segura de deixar software mover dinheiro</div>
        </div>
      </section>
    </div>
  );
}
