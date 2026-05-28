import type { ReactNode } from "react";
import type { Lang } from "../lib/lang.ts";

// Landing copy, PT + EN. Markup-bearing strings (headlines/paragraphs with
// <em>/<br/>) are JSX nodes so emphasis survives translation. Plain strings
// (labels, component props) stay strings. Both langs share the same shape.

const dot = <span className="inline-block align-baseline ml-1.5 w-2 md:w-2.5 h-2 md:h-2.5 bg-[#b5e853]" />;

export interface HomeStrings {
  nav: { how: string; docs: string; login: string; signup: string; home: string };
  mobileFooter: string;
  hero: {
    statusLive: string; eyebrow: string; h1: ReactNode; sub: ReactNode; cta: string;
  };
  tese: {
    label: string;
    b1Label: string; b1: ReactNode;
    b2Label: string; b2: ReactNode;
    b3Label: string; b3: ReactNode;
    cta: string;
  };
  modules: {
    label: string; kicker: string; h2: ReactNode; intro: string;
    m1: { tag: string; statusLabel: string; title: string; body: string };
    m2: { tag: string; statusLabel: string; title: string; body: string };
    m3: { tag: string; statusLabel: string; title: string; body: string };
  };
  numbers: {
    label: string; kicker: string;
    s1Label: string; s1Body: string;
    s2N: string; s2Label: string; s2Body: string;
    s3Label: string; s3Body: string;
  };
  proof: {
    label: string; kicker: string; h2: ReactNode; body: string;
    contractLabel: string; contractMeta: string; payLabel: string; payMeta: string;
    liveTag: string; auditTag: string;
  };
  demoLoop: {
    label: string;
    h2: ReactNode;
    sub: string;
    s_provisioning: string;
    s_deploy: string; s_init: string; s_install: string;
    s_active: string; s_vault: string; s_event: string; s_cancel: string;
    s_enforcement_label: string;
    s_btn_under: string; s_btn_over: string;
    s_result_under: string; s_result_over: string;
    s_replay: string;
  };
  how: {
    label: string; kicker: string; h2: ReactNode;
    s1Title: string; s1Body: string; s2Title: string; s2Body: string;
    s3Title: string; s3Body: string; s4Title: string; s4Body: string;
  };
  reg: {
    label: string; kicker: string; h2: ReactNode; body: ReactNode;
    cNetwork: string; cAssets: string; cAssetsV: string;
    cOnramp: string; cCustody: string; cCustodyV: string;
  };
  comp: {
    label: string; kicker: string; h2: ReactNode;
    rRegional: string; rPix: string; rSub: string; rYield: string; rCashout: string; rCustody: string; rTake: string;
    sNative: string; sFx: string; sFxNote: string; sSub: string; sYieldNote: string; sCustody: string;
    yes: string; na: string; stripeTake: string; coinbaseTake: string; slipTake: string;
    legendLive: string; legendRoadmap: string; kickerP: ReactNode;
  };
  cta: { kicker: string; h2: ReactNode; body: string; button: string };
  footer: {
    product: string; resources: string; legal: string;
    fSignup: string; fLogin: string; fHow: string;
    fApi: string; fGuides: string; fAudits: string; fX402: string; fSsl: string;
    fTerms: string; fPrivacy: string;
  };
}

const pt: HomeStrings = {
  nav: { how: "Como funciona", docs: "Docs", login: "Entrar", signup: "Criar conta", home: "Início" },
  mobileFooter: "Vivo na rede Stellar · contratos públicos no stellar.expert",
  hero: {
    statusLive: "Live · v0.2",
    eyebrow: "Issue 001 · pra quem vende no Brasil",
    h1: <>O commerce stack do Brasil<br/><em className="not-italic">em stablecoin.{dot}</em></>,
    sub: <>Você cobra. O cliente toca uma vez no celular. O dinheiro entra em dólar, em segundos. <em className="font-light">E a regra de quanto e quando podem te cobrar fica no celular do cliente — nem você consegue mudar.</em> É o que a Stripe não consegue fazer.</>,
    cta: "Comece a receber em dólar",
  },
  tese: {
    label: "┃ A tese",
    b1Label: "A contradição",
    b1: <>Você compra dólar pra se proteger. Mas vende em real, recebe em real, paga fornecedor em real, paga funcionário em real. O dólar fica parado numa exchange. O caixa fica exposto. <em className="font-light">A proteção mora num lugar, o risco mora em outro.</em></>,
    b2Label: "O que muda",
    b2: <>O Slippay coloca o dólar <em className="font-light">no recebimento</em>. Você cobra, o cliente paga, o valor entra em dólar e fica em dólar até você decidir o contrário. Sem corretora, sem PJ no exterior, sem planilha. Roda na Stellar, custa frações de centavo por transação, e o dinheiro é seu desde o primeiro segundo.</>,
    b3Label: "A coisa que ninguém mais consegue fazer",
    b3: <>A pergunta não é se você vai se dolarizar — <em className="font-light">6,8 bilhões dizem que você já está</em>. A nova pergunta é: <em className="font-light">quem decide quanto te cobram?</em> No Stripe, é o computador deles — e eles podem mudar. No Slippay, é o celular do cliente — e ninguém burla. Nem nós. Nem o banco. Nem o ladrão.</>,
    cta: "Comece a receber em dólar",
  },
  modules: {
    label: "┃ A solução",
    kicker: "001b · Não é checkout. É commerce stack",
    h2: <>Três módulos.<br/>Uma única <em className="font-light">wallet</em>.</>,
    intro: "Mesma base de tecnologia. Quem aceita Slippay ganha checkout + assinatura recorrente protegida hoje — investimento em dólar e saque internacional no mesmo trilho depois.",
    m1: { tag: "01 · Checkout + Assinatura", statusLabel: "Vivo agora", title: "Um toque. Um cofre só dele.", body: "Pagamento avulso é em dólar digital, na hora. Pra assinatura, o cliente toca uma vez (digital do celular) e a regra fica gravada: quanto a empresa pode cobrar, de quanto em quanto tempo, até quando. Acima do teto: bloqueado. Quer cancelar: 1 toque, sem ligar pra ninguém. Taxa 0,98%." },
    m2: { tag: "02 · Rendimento", statusLabel: "Parceria sendo fechada", title: "Dinheiro parado rende em dólar", body: "O dólar que entrou no seu caixa pode ficar parado ou render. A gente aplica em títulos do tesouro americano via parceiro de câmbio brasileiro autorizado pelo BC. Você puxa de volta quando quiser." },
    m3: { tag: "03 · Saque pelo mundo", statusLabel: "Rede Stellar", title: "Vira dinheiro vivo em 180 países", body: "Cliente lá fora? Ele tira dinheiro em espécie numa agência MoneyGram, em mais de 180 países, usando o trilho da rede Stellar. Sem banco, sem cartão internacional." },
  },
  numbers: {
    label: "┃ Números", kicker: "002 · A economia",
    s1Label: "das compras cripto no BR são stablecoin",
    s1Body: "No 1º trimestre de 2026, US$ 6,8 bi de US$ 6,9 bi em compras de cripto no Brasil foram stablecoin (MEXC · Chainalysis). Dolarização não é tese — é o fluxo dominante.",
    s2N: "$6-8bi", s2Label: "volume cripto/mês no Brasil",
    s2Body: "~90% em stablecoin, +100% ano a ano. Brasil é o 5º maior mercado de adoção do mundo (era 10º). O motivo declarado: hedge contra o real.",
    s3Label: "finalidade na Stellar",
    s3Body: "Settlement determinístico on-chain. Sem T+1, sem janela de lote, sem chargeback. Taxa de rede 0,00001 XLM (~US$0,000001), auditável por qualquer um.",
  },
  proof: {
    label: "┃ Prova", kicker: "002b · Qualquer um pode conferir",
    h2: <>Não é promessa. Não é protótipo.<br/><em className="font-light">Está rodando agora, ao vivo.</em></>,
    body: "O contrato que move o dinheiro está na rede Stellar desde 16 de maio de 2026. O cofre do cliente — onde mora a regra — está em testes desde 28 de maio. 16 testes técnicos passando, duas rodadas de auditoria interna, e auditoria externa pela Bluewave AI Security (8 problemas críticos e 14 altos, todos resolvidos). As transações abaixo são públicas no stellar.expert: qualquer pessoa, em qualquer lugar do mundo, pode abrir e verificar.",
    contractLabel: "Contrato em produção", contractMeta: "Stellar mainnet · auditado",
    payLabel: "Pagamento real", payMeta: "USDC saiu do comprador, entrou no vendedor, em 6 segundos",
    liveTag: "Vivo na rede Stellar",
    auditTag: "Auditado por Bluewave AI Security",
  },
  demoLoop: {
    label: "┃ É assim que funciona",
    h2: <>É assim que funciona.<br/><em className="font-light">Apenas um toque.</em></>,
    sub: "O cliente abre o link da assinatura no celular. Toca uma vez. Em uns 25 segundos o cofre dele nasce, com a regra gravada dentro. Não precisa instalar carteira, não precisa anotar senha de 12 palavras. Daí em diante, a empresa cobra dentro do que ele autorizou. Tentaram cobrar a mais? O próprio cofre bloqueia. Pra cancelar: 1 toque, sem ligar pra ninguém.",
    s_provisioning: "Criando o cofre do cliente",
    s_deploy: "Cofre nasce na rede Stellar",
    s_init: "Digital do celular dele entra no cofre",
    s_install: "Regra é gravada · valor, frequência, validade",
    s_active: "Assinatura ativa",
    s_vault: "Cofre do cliente · ver na rede",
    s_event: "Momento em que a regra foi gravada · ver na rede",
    s_cancel: "Cancelar assinatura",
    s_enforcement_label: "Vamos testar uma cobrança",
    s_btn_under: "Empresa cobra dentro da regra",
    s_btn_over: "Empresa tenta cobrar a mais",
    s_result_under: "transferiu · em 6 segundos · sem janela de estorno",
    s_result_over: "bloqueada · acima do que o cliente autorizou",
    s_replay: "ver de novo",
  },
  how: {
    label: "┃ Mecânica", kicker: "003 · Como funciona",
    h2: <>Quatro partes.<br/>Uma transação <em className="font-light">atômica</em>.</>,
    s1Title: "Crie a cobrança", s1Body: "POST /v1/orders com o valor em dólar. USDC denominado 1:1 contra o USD; sem ida e volta de FX embutida na cobrança.",
    s2Title: "O cliente toca uma vez e pronto", s2Body: "Avulso: ele paga em dólar digital direto, ou em Pix (a parte do Pix vem por parceiro de câmbio autorizado pelo BC). Assinatura: 1 toque no celular (Face ID ou digital) escreve a regra no cofre dele. Nos próximos meses, a cobrança roda sozinha — desde que esteja dentro do que ele autorizou. Acima disso: bloqueia.",
    s3Title: "O listener confirma on-chain", s3Body: "O stream da Horizon observa o seu endereço, casa o pagamento pelo memo, valida valor e emissor do ativo, e marca status=pago em 6s de finalidade determinística.",
    s4Title: "O webhook dispara, assinado com HMAC", s4Body: "Seu endpoint recebe order.paid (ou subscription.charged). Retry exponencial: 1m, 5m, 30m, 2h, 12h, 24h, dead. O USDC fica na sua carteira até você decidir converter.",
  },
  reg: {
    label: "┃ Posição", kicker: "004 · Regulatório",
    h2: <>Feito para a janela<br/>que <em className="font-light">acabou de abrir</em>.</>,
    body: <>O Slippay é provedor de tecnologia de pagamento — não detém custódia, não opera câmbio e não é instituição financeira. A conversão BRL→USDC será executada por instituição autorizada pelo BCB (câmbio + PSAV), parceiro de câmbio em definição. A liquidação do checkout é <em className="font-light">doméstica</em>: não há eFX cross-border em stablecoin, e a Res. BCB 561/2026 não se aplica a ela por design. O cash-out internacional é <em className="font-light">saque físico</em> em agência via MoneyGram na rede Stellar — não liquidação stablecoin cross-border. Risco residual de reinterpretação regulatória existe e é monitorado ativamente.</>,
    cNetwork: "Rede", cAssets: "Ativos", cAssetsV: "USDC · PYUSD em breve",
    cOnramp: "Entrada", cCustody: "Custódia", cCustodyV: "Sua · não-custodial",
  },
  comp: {
    label: "┃ Competição", kicker: "006 · Por que a Stripe não consegue copiar",
    h2: <>A Stripe não pode fazer isso<br/>sem <em className="font-light">deixar de ser Stripe</em>.</>,
    rRegional: "Foco regional BR", rPix: "Pix in / BRL out", rSub: "Assinatura Soroban",
    rYield: "Yield (Tesouros tokenizados)", rCashout: "Cash-out global", rCustody: "Não-custodial", rTake: "Take rate",
    sNative: "Nativo", sFx: "Parceiro de câmbio", sFxNote: "em definição", sSub: "Live na mainnet",
    sYieldNote: "roadmap", sCustody: "Sim, by design",
    yes: "Sim", na: "n/d", stripeTake: "2,9% + US$0,30", coinbaseTake: "1,0%", slipTake: "0,98%",
    legendLive: "live", legendRoadmap: "roadmap",
    kickerP: <>Stripe cobra ~2,9% + US$0,30 <em className="font-light">porque a lei obriga ela a aceitar contestação por 120 dias</em>. O dinheiro fica preso 2 a 7 dias <em className="font-light">porque a janela de estorno é mandatada</em>. O limite que ela mostra no painel mora num banco de dados deles. E ela <em className="font-light">precisa segurar o dinheiro</em> — é exigência da licença que ela tem. Cada uma dessas regras é o que faz a Stripe valer US$ 70 bilhões. Tirar uma quebra o modelo. <em className="font-light">Slippay nasceu sem nenhuma delas.</em></>,
  },
  cta: {
    kicker: "005 · Comece",
    h2: <>Pronto quando<br/><em className="font-light">seu caixa estiver</em>.</>,
    body: "Cadastre-se. Informe seu endereço Stellar de recebimento. Copie sua API key. Comece a receber em USDC on-chain hoje (PYUSD em breve); a entrada via Pix entra com o parceiro de câmbio.",
    button: "Criar conta",
  },
  footer: {
    product: "┃ Produto", resources: "┃ Recursos", legal: "┃ Legal",
    fSignup: "Criar conta", fLogin: "Entrar", fHow: "Como funciona",
    fApi: "API reference", fGuides: "Guias", fAudits: "Auditorias de segurança", fX402: "x402 protocol", fSsl: "SSL spec ↗",
    fTerms: "Termos", fPrivacy: "Privacidade",
  },
};

const en: HomeStrings = {
  nav: { how: "How it works", docs: "Docs", login: "Log in", signup: "Sign up", home: "Home" },
  mobileFooter: "Live on the Stellar network · public contracts on stellar.expert",
  hero: {
    statusLive: "Live · v0.2",
    eyebrow: "Issue 001 · for who sells in Brazil",
    h1: <>Brazil's commerce stack<br/><em className="not-italic">in stablecoin.{dot}</em></>,
    sub: <>You charge. Your customer taps once on their phone. The dollar lands in your cash flow in seconds. <em className="font-light">And the rule for how much and how often they can be charged lives on their phone — you can't change it either.</em> That's what Stripe can't do.</>,
    cta: "Start getting paid in dollars",
  },
  tese: {
    label: "┃ The thesis",
    b1Label: "The contradiction",
    b1: <>You buy dollars to protect yourself. But you sell in reais, get paid in reais, pay suppliers in reais, pay staff in reais. The dollars sit idle on an exchange. The cash stays exposed. <em className="font-light">The hedge lives in one place, the risk in another.</em></>,
    b2Label: "What changes",
    b2: <>SlipPay puts the dollar <em className="font-light">at the point of payment</em>. You charge, the customer pays, the money lands in dollars and stays in dollars until you decide otherwise. No broker, no offshore entity, no spreadsheet. It runs on Stellar, costs fractions of a cent per transaction, and the money is yours from the first second.</>,
    b3Label: "The thing nobody else can do",
    b3: <>The question isn't whether you'll dollarize — <em className="font-light">$6.8bn says you already have</em>. The new question is: <em className="font-light">who decides how much you get charged?</em> With Stripe, it's their computer — and they can change it. With Slippay, it's the customer's phone — and nobody can override. Not us. Not the bank. Not a thief.</>,
    cta: "Start getting paid in dollars",
  },
  modules: {
    label: "┃ The solution",
    kicker: "001b · Not a checkout. A commerce stack",
    h2: <>Three modules.<br/>One single <em className="font-light">wallet</em>.</>,
    intro: "Same underlying tech. Whoever accepts Slippay gets checkout + protected recurring subscription today — yield and global cash-out on the same rails after.",
    m1: { tag: "01 · Checkout + Subscription", statusLabel: "Live now", title: "One tap. A vault only they control.", body: "One-time payments land in digital dollars, right away. For subscriptions, the customer taps once (Face ID or fingerprint) and the rule is written: how much can be charged, how often, until when. Over the cap: blocked. Want to cancel: one tap, no support call. 0.98% fee." },
    m2: { tag: "02 · Yield", statusLabel: "Partnership being closed", title: "Idle cash earns in dollars", body: "Dollars sitting in your cash flow can stay parked or earn. We allocate to US Treasury bills via a BR-authorized FX partner (BCB-licensed). You can pull it back whenever." },
    m3: { tag: "03 · Cash-out worldwide", statusLabel: "Stellar network", title: "Becomes physical cash in 180+ countries", body: "Customer abroad? They walk into a MoneyGram agency in 180+ countries and pick up physical cash, using the Stellar network rail. No bank, no international card." },
  },
  numbers: {
    label: "┃ Numbers", kicker: "002 · The economy",
    s1Label: "of crypto purchases in Brazil are stablecoin",
    s1Body: "In Q1 2026, $6.8bn of $6.9bn in crypto purchases in Brazil were stablecoin (MEXC · Chainalysis). Dollarization isn't a thesis — it's the dominant flow.",
    s2N: "$6-8bn", s2Label: "crypto volume/month in Brazil",
    s2Body: "~90% in stablecoin, +100% year over year. Brazil is the world's 5th-largest adoption market (was 10th). The stated reason: a hedge against the real.",
    s3Label: "finality on Stellar",
    s3Body: "Deterministic on-chain settlement. No T+1, no batch window, no chargebacks. Network fee 0.00001 XLM (~$0.000001), auditable by anyone.",
  },
  proof: {
    label: "┃ Proof", kicker: "002b · Verifiable on-chain",
    h2: <>Not a promise. Not a prototype.<br/><em className="font-light">Live on Stellar mainnet.</em></>,
    body: "The contract that moves the money has been live on the Stellar network since May 16, 2026. The customer's vault — where the rule lives — has been in testing since May 28. 16 technical tests passing, two internal audit passes, plus an external audit by Bluewave AI Security (8 critical and 14 high findings, all closed). The transactions below are public on stellar.expert: anyone, anywhere in the world, can open them and verify.",
    contractLabel: "Contract in production", contractMeta: "Stellar mainnet · audited",
    payLabel: "Real payment", payMeta: "USDC left the buyer, landed in the seller, in 6 seconds",
    liveTag: "Live on the Stellar network",
    auditTag: "Audited by Bluewave AI Security",
  },
  demoLoop: {
    label: "┃ This is how it works",
    h2: <>This is how it works.<br/><em className="font-light">Just one tap.</em></>,
    sub: "The customer opens the subscription link on their phone. Taps once. In about 25 seconds, their vault is born with the rule written inside. No wallet to install, no 12-word seed phrase to write down. From then on, the company charges within what they authorized. Tried to charge more? The vault itself blocks it. To cancel: one tap, no support call.",
    s_provisioning: "Creating the customer's vault",
    s_deploy: "Vault is born on the Stellar network",
    s_init: "Their phone's biometric enters the vault",
    s_install: "Rule is written · amount, frequency, validity",
    s_active: "Subscription active",
    s_vault: "Customer's vault · view on the network",
    s_event: "Moment the rule was written · view on the network",
    s_cancel: "Cancel subscription",
    s_enforcement_label: "Let's test a charge",
    s_btn_under: "Company charges within the rule",
    s_btn_over: "Company tries to overcharge",
    s_result_under: "transferred · in 6 seconds · no chargeback window",
    s_result_over: "blocked · above what the customer authorized",
    s_replay: "replay",
  },
  how: {
    label: "┃ Mechanics", kicker: "003 · How it works",
    h2: <>Four parts.<br/>One <em className="font-light">atomic</em> transaction.</>,
    s1Title: "Create the charge", s1Body: "POST /v1/orders with the dollar amount. USDC denominated 1:1 against USD; no FX round-trip baked into the charge.",
    s2Title: "The customer taps once · done", s2Body: "One-off: they pay in digital dollars directly, or in Pix (the Pix side flows through a BR-authorized FX partner). Subscription: one tap on the phone (Face ID or fingerprint) writes the rule inside their vault. The next charges run on schedule — within what they authorized. Above that: blocked.",
    s3Title: "The listener confirms on-chain", s3Body: "The Horizon stream watches your address, matches the payment by memo, validates the asset amount and issuer, and marks status=paid in 6s of deterministic finality.",
    s4Title: "The webhook fires, HMAC-signed", s4Body: "Your endpoint receives order.paid (or subscription.charged). Exponential retry: 1m, 5m, 30m, 2h, 12h, 24h, dead. The USDC stays in your wallet until you decide to convert.",
  },
  reg: {
    label: "┃ Position", kicker: "004 · Regulatory",
    h2: <>Built for the window<br/>that <em className="font-light">just opened</em>.</>,
    body: <>SlipPay is a payment-technology provider — it holds no custody, operates no FX, and is not a financial institution. The BRL→USDC conversion is executed by a BCB-authorized institution (FX + PSAV), FX partner in progress. The checkout settlement is <em className="font-light">domestic</em>: no cross-border stablecoin eFX, and BCB Res. 561/2026 does not apply to it by design. International cash-out is <em className="font-light">physical withdrawal</em> at a MoneyGram agency over the Stellar network — not cross-border stablecoin settlement. Residual regulatory-reinterpretation risk exists and is actively monitored.</>,
    cNetwork: "Network", cAssets: "Assets", cAssetsV: "USDC · PYUSD soon",
    cOnramp: "On-ramp", cCustody: "Custody", cCustodyV: "Yours · non-custodial",
  },
  comp: {
    label: "┃ Competition", kicker: "006 · Why Stripe can't copy this",
    h2: <>Stripe can't do this<br/>without <em className="font-light">ceasing to be Stripe</em>.</>,
    rRegional: "Brazil regional focus", rPix: "Pix in / BRL out", rSub: "Soroban subscription",
    rYield: "Yield (tokenized treasuries)", rCashout: "Global cash-out", rCustody: "Non-custodial", rTake: "Take rate",
    sNative: "Native", sFx: "FX partner", sFxNote: "in progress", sSub: "Live on mainnet",
    sYieldNote: "roadmap", sCustody: "Yes, by design",
    yes: "Yes", na: "n/a", stripeTake: "2.9% + $0.30", coinbaseTake: "1.0%", slipTake: "0.98%",
    legendLive: "live", legendRoadmap: "roadmap",
    kickerP: <>Stripe charges ~2.9% + $0.30 <em className="font-light">because the law forces them to accept disputes for 120 days</em>. Money sits frozen for 2 to 7 days <em className="font-light">because the dispute window is mandated</em>. The cap shown in the dashboard lives in their database. And they <em className="font-light">have to hold the money</em> — it's a license requirement. Each of these rules is what makes Stripe worth $70bn. Drop one and the model breaks. <em className="font-light">Slippay was born without any of them.</em></>,
  },
  cta: {
    kicker: "005 · Get started",
    h2: <>Ready when<br/><em className="font-light">your cash flow is</em>.</>,
    body: "Sign up. Enter your Stellar receiving address. Copy your API key. Start receiving USDC on-chain today (PYUSD soon); the Pix on-ramp lands with the FX partner.",
    button: "Sign up",
  },
  footer: {
    product: "┃ Product", resources: "┃ Resources", legal: "┃ Legal",
    fSignup: "Sign up", fLogin: "Log in", fHow: "How it works",
    fApi: "API reference", fGuides: "Guides", fAudits: "Security audits", fX402: "x402 protocol", fSsl: "SSL spec ↗",
    fTerms: "Terms", fPrivacy: "Privacy",
  },
};

export const homeCopy: Record<Lang, HomeStrings> = { pt, en };
