// /seguranca — the moat page. Serious-engineering tone (less manifesto). Same
// palette as the landing: bone bg, ink text, lime accents (#A16207 on bone,
// #FDDA24 on the dark drama section). Core thesis: decision is separated from
// execution — the AI can be fooled; the contract won't execute outside the rules.
// No exposure of our own open findings; no Bluewave branding.

import { Link } from "react-router-dom";
import { Logo } from "../components/Logo.tsx";
import { AuditDemo } from "../components/AuditDemo.tsx";

const AUDIT_CONTRACT = "CBJMQ6ZYQJ2OMM46FGXPEIKKZDRHHERBXUVE54ZN64FDPKN5DJKSEVQN";
const AUDIT_URL = `https://stellar.expert/explorer/public/contract/${AUDIT_CONTRACT}`;
const TX_URL = "https://stellar.expert/explorer/public/tx/5da9741f554294a196376088ebd8f753f466a03cf657e67248533d78e0e3edf6";

function Eyebrow({ children, dark = false }: { children: React.ReactNode; dark?: boolean }) {
  return <div className={`font-mono text-[10px] uppercase tracking-[0.3em] ${dark ? "text-[#FDDA24]" : "text-[#A16207]"} mb-6`}>{children}</div>;
}

const PROPERTIES = [
  ["Non-custodial", "Os fundos permanecem em uma carteira controlada por você. A SlipPay não tem acesso unilateral ao seu dinheiro."],
  ["Regras executadas em contrato", "Limites, permissões e condições de pagamento são definidos em smart contracts. As regras não dependem de política interna ou decisão manual."],
  ["Verificável on-chain", "Cada pagamento é uma transação pública e auditável. Qualquer pessoa pode verificar o que foi executado, sem depender de relatórios internos."],
  ["Controle de escopo (fail-safe)", "Se algo estiver fora das regras definidas, a transação não executa. Não existe “meio pagamento” ou estado intermediário não previsto."],
  ["Sem custódia intermediária", "Não há retenção de fundos em plataformas centralizadas. O dinheiro não passa por contas operadas pela SlipPay."],
];

const LAYERS = [
  ["01", "Execução no contrato", "As regras críticas vivem no smart contract, não no agente."],
  ["02", "Agente como interface, não autoridade", "A IA propõe e orquestra, mas não tem permissão para alterar regras financeiras."],
  ["03", "Limites explícitos", "Teto de gasto, listas de destinatários e condições de pagamento são impostas em código."],
  ["04", "Transparência total", "Todas as execuções podem ser verificadas diretamente na blockchain."],
];

export default function Security() {
  return (
    <div className="min-h-screen bg-[#f1eee7] text-[#0a0a0a] overflow-x-hidden">
      <header className="px-6 md:px-12 py-7 flex items-center justify-between border-b border-[#0a0a0a]/10">
        <Link to="/"><Logo /></Link>
        <nav className="flex items-center gap-8 text-[10px] uppercase tracking-[0.22em] text-[#0a0a0a]/55">
          <Link to="/" className="hover:text-[#0a0a0a]">Home</Link>
          <Link to="/pay" className="inline-flex items-center rounded-full px-5 py-2.5 bg-[#FDDA24] text-[#0a0a0a] hover:opacity-90">Testar grátis</Link>
        </nav>
      </header>

      {/* HERO */}
      <section className="border-b border-[#0a0a0a]/10">
        <div className="max-w-[1240px] mx-auto px-6 md:px-12 pt-14 md:pt-28 pb-20 md:pb-32">
          <Eyebrow>segurança</Eyebrow>
          <h1 className="text-[40px] leading-[0.97] md:text-[80px] md:leading-[0.92] font-semibold tracking-[-0.045em] max-w-[16ch]">
            O dinheiro é seu. <span className="text-[#A16207]">O sistema não encosta nele.</span>
          </h1>
          <p className="mt-10 text-xl md:text-2xl text-[#0a0a0a]/65 leading-relaxed max-w-[54ch]">
            A SlipPay foi desenhada para reduzir confiança ao mínimo possível. O dinheiro nunca fica sob
            nossa custódia. Ele permanece na sua carteira, e só pode ser movimentado dentro de regras
            executadas em contrato inteligente.
          </p>
          <p className="mt-9 text-2xl md:text-3xl font-medium tracking-[-0.02em] max-w-[20ch]">
            A IA pode falhar. <span className="text-[#A16207]">O contrato não.</span>
          </p>
        </div>
      </section>

      {/* PROPRIEDADES */}
      <section className="border-b border-[#0a0a0a]/10">
        <div className="max-w-[1240px] mx-auto px-6 md:px-12 py-20 md:py-28">
          <div className="grid sm:grid-cols-2 gap-x-14 gap-y-9 max-w-[92ch]">
            {PROPERTIES.map(([t, b]) => (
              <div key={t} className="flex gap-4 border-t border-[#0a0a0a]/12 pt-6">
                <span className="text-[#A16207] text-lg shrink-0 leading-none mt-1">✓</span>
                <div>
                  <div className="text-[19px] font-semibold tracking-[-0.01em]">{t}</div>
                  <p className="mt-2 text-[15px] text-[#0a0a0a]/60 leading-relaxed">{b}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* RED TEAM CONTÍNUO */}
      <section className="border-b border-[#0a0a0a]/10">
        <div className="max-w-[1240px] mx-auto px-6 md:px-12 py-20 md:py-32 grid lg:grid-cols-[1fr_1.05fr] gap-14 lg:gap-20 items-center">
          <div>
            <Eyebrow>ataque ao sistema · red team contínuo</Eyebrow>
            <h2 className="text-4xl md:text-6xl font-semibold tracking-[-0.04em] leading-[0.95] max-w-[15ch]">Testada assumindo que será atacada.</h2>
            <p className="mt-8 text-xl text-[#0a0a0a]/65 leading-relaxed max-w-[46ch]">
              Antes de produção, o sistema é submetido a cenários adversariais inspirados em ataques reais
              de sistemas financeiros e agentes de IA.
            </p>
            <ul className="mt-8 space-y-2.5 text-[15px] text-[#0a0a0a]/70 max-w-[46ch]">
              {[
                "Tentativa de cobrança duplicada",
                "Uso de autorização inválida ou expirada",
                "Reaproveitamento de permissões entre contextos",
                "Execução fora dos limites definidos",
                "Tentativas de bypass de validação de política",
              ].map((x) => (
                <li key={x} className="flex gap-3"><span className="text-[#0a0a0a]/30">·</span><span>{x}</span></li>
              ))}
            </ul>
            <p className="mt-8 text-lg font-medium">Cada cenário precisa falhar por design.</p>
          </div>
          <div className="rounded-2xl">
            <AuditDemo />
          </div>
        </div>
      </section>

      {/* SEGURANÇA EM CAMADAS */}
      <section className="border-b border-[#0a0a0a]/10">
        <div className="max-w-[1240px] mx-auto px-6 md:px-12 py-20 md:py-32">
          <Eyebrow>segurança em camadas</Eyebrow>
          <h2 className="text-4xl md:text-6xl font-semibold tracking-[-0.04em] leading-[0.95] max-w-[18ch]">Não depende de um único componente.</h2>
          <div className="mt-16 grid md:grid-cols-2 lg:grid-cols-4 gap-px bg-[#0a0a0a]/12 border border-[#0a0a0a]/12">
            {LAYERS.map(([n, t, b]) => (
              <div key={n} className="bg-white p-8 md:p-9">
                <div className="font-mono text-[12px] text-[#A16207]">{n}</div>
                <div className="mt-4 text-xl font-semibold tracking-[-0.01em] leading-tight">{t}</div>
                <p className="mt-3 text-[14px] text-[#0a0a0a]/60 leading-relaxed">{b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* MODELO DE AMEAÇA */}
      <section className="border-b border-[#0a0a0a]/10">
        <div className="max-w-[1240px] mx-auto px-6 md:px-12 py-20 md:py-32">
          <Eyebrow>modelo de ameaça</Eyebrow>
          <h2 className="text-4xl md:text-6xl font-semibold tracking-[-0.04em] leading-[0.95] max-w-[20ch]">Assumimos que qualquer camada acima pode ser comprometida.</h2>
          <div className="mt-12 grid sm:grid-cols-2 gap-x-12 gap-y-4 max-w-[70ch] text-lg text-[#0a0a0a]/65">
            {[
              "Prompts podem ser injetados",
              "Memória pode ser corrompida",
              "Ferramentas podem ser exploradas",
              "Agentes podem ser manipulados",
            ].map((x) => (
              <div key={x} className="flex gap-3 border-t border-[#0a0a0a]/12 pt-4"><span className="text-[#A16207]">·</span><span>{x}</span></div>
            ))}
          </div>
          <p className="mt-10 text-xl text-[#0a0a0a]/80 max-w-[48ch] leading-relaxed">
            Mesmo assim, <span className="font-medium">o contrato continua sendo o ponto final de verificação.</span>
          </p>
        </div>
      </section>

      {/* PRINCÍPIO CENTRAL — seção dark, o clímax */}
      <section className="border-b border-[#0a0a0a]/10 bg-[#0a0a0a] text-[#f1eee7]">
        <div className="max-w-[1240px] mx-auto px-6 md:px-12 py-24 md:py-40">
          <Eyebrow dark>o princípio central</Eyebrow>
          <h2 className="text-4xl md:text-7xl font-semibold tracking-[-0.045em] leading-[0.95] max-w-[18ch]">
            Se o agente falhar, <span className="text-[#FDDA24]">o dinheiro não falha com ele.</span>
          </h2>
          <p className="mt-12 text-xl md:text-2xl text-[#f1eee7]/70 leading-relaxed max-w-[44ch]">
            A arquitetura separa <span className="text-[#f1eee7] font-medium">decisão</span> de <span className="text-[#f1eee7] font-medium">execução</span>.
          </p>
          <div className="mt-10 grid sm:grid-cols-2 gap-px bg-[#f1eee7]/12 border border-[#f1eee7]/12 max-w-[760px]">
            <div className="bg-[#0a0a0a] p-8">
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#f1eee7]/45">decisão · a IA</div>
              <p className="mt-3 text-xl text-[#f1eee7]/85">Pode ser enganada.</p>
            </div>
            <div className="bg-[#0a0a0a] p-8">
              <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#FDDA24]">execução · o contrato</div>
              <p className="mt-3 text-xl text-[#f1eee7]">Não executa fora das regras.</p>
            </div>
          </div>
        </div>
      </section>

      {/* TRANSPARÊNCIA */}
      <section className="border-b border-[#0a0a0a]/10">
        <div className="max-w-[1240px] mx-auto px-6 md:px-12 py-20 md:py-32">
          <Eyebrow>transparência</Eyebrow>
          <h2 className="text-4xl md:text-6xl font-semibold tracking-[-0.04em] leading-[0.95] max-w-[20ch]">Você não precisa confiar na SlipPay para verificar.</h2>
          <div className="mt-12 grid sm:grid-cols-2 gap-x-12 gap-y-4 max-w-[70ch] text-lg text-[#0a0a0a]/65">
            {[
              "Contratos são públicos",
              "Transações são verificáveis",
              "Regras são auditáveis",
              "Execuções são reproduzíveis on-chain",
            ].map((x) => (
              <div key={x} className="flex gap-3 border-t border-[#0a0a0a]/12 pt-4"><span className="text-[#A16207]">✓</span><span>{x}</span></div>
            ))}
          </div>
          <div className="mt-12 flex flex-wrap gap-4">
            <a href={TX_URL} target="_blank" rel="noreferrer" className="lift inline-flex items-center gap-2.5 rounded-full px-7 py-3.5 text-[11px] uppercase tracking-[0.18em] bg-[#FDDA24] text-[#0a0a0a]">Ver um pagamento real ↗</a>
            <a href={AUDIT_URL} target="_blank" rel="noreferrer" className="lift inline-flex items-center gap-2.5 rounded-full px-7 py-3.5 text-[11px] uppercase tracking-[0.18em] border border-[#0a0a0a]/25 hover:border-[#0a0a0a]">Ver o contrato ↗</a>
          </div>
        </div>
      </section>

      {/* CTA — dark */}
      <section className="bg-[#0a0a0a] text-[#f1eee7]">
        <div className="max-w-[1240px] mx-auto px-6 md:px-12 py-24 md:py-36 text-center">
          <h2 className="text-4xl md:text-7xl font-semibold tracking-[-0.045em] leading-[0.95] max-w-[16ch] mx-auto">Segurança não é um recurso.</h2>
          <p className="mt-7 text-xl text-[#f1eee7]/60 max-w-[40ch] mx-auto">É o que torna o sistema possível.</p>
          <div className="mt-12 flex justify-center">
            <Link to="/" className="lift inline-flex items-center rounded-full px-10 py-4 text-[11px] uppercase tracking-[0.2em] bg-[#FDDA24] text-[#0a0a0a]">Voltar pra SlipPay</Link>
          </div>
          <div className="mt-20 font-mono text-[10px] uppercase tracking-[0.22em] text-[#f1eee7]/30">slippay · a forma segura de deixar software mover dinheiro</div>
        </div>
      </section>
    </div>
  );
}
