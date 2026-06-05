// /manifesto — Quem somos + manifesto visionário. Tema: a tecnologia de ponta
// de mover dinheiro (liquidação instantânea, dólar programável, prova on-chain,
// agentes autônomos) que sempre foi privilégio de governos e grande capital,
// agora na mão de qualquer empresa, com uma experiência que não exige entender
// nada disso. Voz humana, sem travessão. Paleta da landing.

import { Link } from "react-router-dom";
import { Logo } from "../components/Logo.tsx";

function Eyebrow({ children, dark = false }: { children: React.ReactNode; dark?: boolean }) {
  return <div className={`font-mono text-[10px] uppercase tracking-[0.3em] ${dark ? "text-[#b5e853]" : "text-[#65a30d]"} mb-6`}>{children}</div>;
}

export default function Manifesto() {
  return (
    <div className="min-h-screen bg-[#f1eee7] text-[#0a0a0a] overflow-x-hidden">
      <header className="px-6 md:px-12 py-7 flex items-center justify-between border-b border-[#0a0a0a]/10">
        <Link to="/"><Logo /></Link>
        <nav className="flex items-center gap-8 text-[10px] uppercase tracking-[0.22em] text-[#0a0a0a]/55">
          <Link to="/" className="hover:text-[#0a0a0a]">Home</Link>
          <Link to="/pay" className="inline-flex items-center rounded-full px-5 py-2.5 bg-[#b5e853] text-[#0a0a0a] hover:opacity-90">Testar grátis</Link>
        </nav>
      </header>

      {/* QUEM SOMOS */}
      <section className="border-b border-[#0a0a0a]/10">
        <div className="max-w-[1240px] mx-auto px-6 md:px-12 pt-14 md:pt-28 pb-20 md:pb-32">
          <Eyebrow>quem somos nós</Eyebrow>
          <h1 className="text-[40px] leading-[0.97] md:text-[80px] md:leading-[0.92] font-semibold tracking-[-0.045em] max-w-[18ch]">
            A gente não aceitou que dinheiro de verdade fosse privilégio.
          </h1>
          <p className="mt-10 text-xl md:text-2xl text-[#0a0a0a]/65 leading-relaxed max-w-[54ch]">
            Não somos um banco. Não somos mais uma fintech. Somos um time pequeno e teimoso, no Brasil,
            construindo a infraestrutura de dinheiro que a gente sempre quis ter e nunca pôde comprar.
            A melhor tecnologia financeira do mundo existe há anos. Ela só não era pra você.
          </p>
        </div>
      </section>

      {/* O GANCHO — a IA que erra, a prova que impede */}
      <section className="border-b border-[#0a0a0a]/10">
        <div className="max-w-[1240px] mx-auto px-6 md:px-12 py-20 md:py-32">
          <Eyebrow>somos o que você queria, mas não sabia</Eyebrow>
          <h2 className="text-3xl md:text-[56px] md:leading-[1.05] font-semibold tracking-[-0.035em] max-w-[20ch]">
            Você conversa com uma IA todo dia. Sente o poder. E sabe que ela erra.
          </h2>
          <p className="mt-10 text-xl text-[#0a0a0a]/65 leading-relaxed max-w-[54ch]">
            A inteligência artificial já mudou o seu jeito de trabalhar. No fundo você sente que ela pode
            mudar a sua vida. Mas você também sabe a verdade: de vez em quando, ela erra. E erro com o seu
            dinheiro não tem desculpa.
          </p>
        </div>
      </section>

      {/* O GANCHO — a virada, dark */}
      <section className="border-b border-[#0a0a0a]/10 bg-[#0a0a0a] text-[#f1eee7]">
        <div className="max-w-[1240px] mx-auto px-6 md:px-12 py-24 md:py-40">
          <h2 className="text-4xl md:text-7xl font-semibold tracking-[-0.045em] leading-[0.96] max-w-[16ch]">
            E se o erro fosse <span className="text-[#b5e853]">impedido antes de acontecer?</span>
          </h2>
          <p className="mt-12 text-xl md:text-2xl text-[#f1eee7]/70 leading-relaxed max-w-[52ch]">
            Não com mais uma promessa de que dessa vez vai dar certo. Com prova matemática, gravada numa
            tecnologia chamada blockchain. A IA faz o trabalho pesado. A blockchain garante que o erro dela
            nunca vira o seu prejuízo. O agente pode se enganar. A regra que protege o seu dinheiro não.
          </p>
        </div>
      </section>

      {/* A VISÃO — dólar digital, soberania individual */}
      <section className="border-b border-[#0a0a0a]/10">
        <div className="max-w-[1240px] mx-auto px-6 md:px-12 py-20 md:py-32">
          <Eyebrow>a nossa visão</Eyebrow>
          <h2 className="text-3xl md:text-[56px] md:leading-[1.05] font-semibold tracking-[-0.035em] max-w-[20ch]">
            Sua moeda pode falhar. O seu dinheiro não precisa falhar com ela.
          </h2>
          <p className="mt-10 text-xl text-[#0a0a0a]/65 leading-relaxed max-w-[56ch]">
            A história da América Latina está cheia de moedas que viraram pó da noite pro dia. Quem tinha
            dólar atravessou. Quem não tinha viu o trabalho de uma vida evaporar. A proteção sempre foi
            privilégio de quem já tinha acesso.
          </p>
          <p className="mt-7 text-xl text-[#0a0a0a]/65 leading-relaxed max-w-[56ch]">
            A gente existe pra virar esse jogo. Dólar de verdade, digital, sem fronteira e sem burocracia,
            no bolso de qualquer pessoa. Não pra especular. Pra você nunca mais depender da sorte do seu
            país pra proteger o que é seu.
          </p>
        </div>
      </section>

      {/* A VISÃO — sem barreira de jargão */}
      <section className="border-b border-[#0a0a0a]/10">
        <div className="max-w-[1240px] mx-auto px-6 md:px-12 py-20 md:py-32">
          <Eyebrow>sem barreira</Eyebrow>
          <h2 className="text-3xl md:text-[56px] md:leading-[1.05] font-semibold tracking-[-0.035em] max-w-[20ch]">
            Você não precisa ser dev pra usar o que há de mais avançado.
          </h2>
          <p className="mt-10 text-xl text-[#0a0a0a]/65 leading-relaxed max-w-[56ch]">
            A tecnologia mais poderosa do mundo sempre veio embrulhada em palavras que afastam justo quem
            mais precisa dela. Carteira, seed phrase, gas, on-chain. A gente apagou tudo isso da sua frente.
          </p>
          <p className="mt-7 text-xl text-[#0a0a0a]/65 leading-relaxed max-w-[56ch]">
            Você não vira engenheiro pra proteger o seu dinheiro. Você só usa, do mesmo jeito que usa
            qualquer aplicativo. <span className="text-[#0a0a0a] font-medium">Esse poder agora é das pessoas comuns.</span>
          </p>
        </div>
      </section>

      {/* MANIFESTO — 1 */}
      <section className="border-b border-[#0a0a0a]/10">
        <div className="max-w-[1240px] mx-auto px-6 md:px-12 py-20 md:py-32">
          <Eyebrow>o manifesto</Eyebrow>
          <p className="text-3xl md:text-[56px] md:leading-[1.05] font-semibold tracking-[-0.035em] max-w-[20ch]">
            Por décadas, mover dinheiro de verdade foi um clube fechado.
          </p>
          <p className="mt-10 text-xl text-[#0a0a0a]/65 leading-relaxed max-w-[56ch]">
            Liquidação que acontece em segundos. Dólar que obedece regras escritas em código. Prova
            matemática de cada centavo que se move. Tudo isso já existia. Só que trancado dentro de bancos
            centrais, fundos soberanos e mesas de Wall Street. Quem trabalha, vende e empreende ficava do
            lado de fora, pagando caro e esperando dias.
          </p>
        </div>
      </section>

      {/* MANIFESTO — 2 · dark */}
      <section className="border-b border-[#0a0a0a]/10 bg-[#0a0a0a] text-[#f1eee7]">
        <div className="max-w-[1240px] mx-auto px-6 md:px-12 py-24 md:py-40">
          <h2 className="text-4xl md:text-7xl font-semibold tracking-[-0.045em] leading-[0.96] max-w-[16ch]">
            A gente pegou a chave. <span className="text-[#b5e853]">E entregou pra você.</span>
          </h2>
          <p className="mt-12 text-xl md:text-2xl text-[#f1eee7]/70 leading-relaxed max-w-[52ch]">
            A mesma tecnologia que move bilhões entre governos move os dois mil reais do seu fornecedor.
            Na mesma velocidade. Com a mesma segurança. Sem maquininha, sem custódia, sem pedir licença pra
            ninguém. O que era poder de Estado virou ferramenta de quem acorda cedo.
          </p>
        </div>
      </section>

      {/* MANIFESTO — 3 · a parte que importa (UX) */}
      <section className="border-b border-[#0a0a0a]/10">
        <div className="max-w-[1240px] mx-auto px-6 md:px-12 py-20 md:py-32">
          <Eyebrow>e aqui está a parte que importa</Eyebrow>
          <p className="text-3xl md:text-[56px] md:leading-[1.05] font-semibold tracking-[-0.035em] max-w-[18ch]">
            Você não precisa entender nada disso.
          </p>
          <p className="mt-10 text-xl text-[#0a0a0a]/65 leading-relaxed max-w-[54ch]">
            Você não vê a blockchain. Não decora frase de doze palavras. Não fala com gerente de banco.
            Você toca, e acontece. A engenharia mais pesada do mundo escondida atrás da coisa mais simples
            de usar. Foi assim que o computador virou telefone na sua mão. É assim que o dinheiro vira
            software no seu bolso.
          </p>
        </div>
      </section>

      {/* MANIFESTO — 4 · o fecho */}
      <section className="bg-[#0a0a0a] text-[#f1eee7]">
        <div className="max-w-[1240px] mx-auto px-6 md:px-12 py-28 md:py-44 text-center">
          <p className="text-4xl md:text-7xl font-semibold tracking-[-0.045em] leading-[1.0] max-w-[20ch] mx-auto">
            A revolução não é a tecnologia. <span className="text-[#b5e853]">É quem finalmente pode usá-la.</span>
          </p>
          <p className="mt-10 text-xl text-[#f1eee7]/60 max-w-[34ch] mx-auto">Poder de governo, na mão de quem faz a economia girar.</p>
          <div className="mt-14 flex justify-center">
            <Link to="/pay" className="lift inline-flex items-center rounded-full px-10 py-4 text-[11px] uppercase tracking-[0.2em] bg-[#b5e853] text-[#0a0a0a]">Começar agora</Link>
          </div>
          <div className="mt-20 font-mono text-[10px] uppercase tracking-[0.22em] text-[#f1eee7]/30">slippay · a forma segura de deixar software mover dinheiro</div>
        </div>
      </section>
    </div>
  );
}
