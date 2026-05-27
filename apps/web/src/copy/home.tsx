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
  mobileFooter: "Vivo na mainnet Stellar · contrato CBJMQ6ZY…",
  hero: {
    statusLive: "Live · v0.2",
    eyebrow: "O commerce stack do Brasil em stablecoin",
    h1: <>Você se protege do real com uma mão.<br/><em className="not-italic">E recebe nele com a outra.{dot}</em></>,
    sub: <>98% de quem comprou cripto no Brasil no início de 2026 comprou stablecoin — US$ 6,8 bi de US$ 6,9 bi. O brasileiro já se dolarizou. Só o seu caixa ainda não.</>,
    cta: "Comece a receber em dólar",
  },
  tese: {
    label: "┃ A tese",
    b1Label: "A contradição",
    b1: <>Você compra dólar pra se proteger. Mas vende em real, recebe em real, paga fornecedor em real, paga funcionário em real. O dólar fica parado numa exchange. O caixa fica exposto. <em className="font-light">A proteção mora num lugar, o risco mora em outro.</em></>,
    b2Label: "O que muda",
    b2: <>O Slippay coloca o dólar <em className="font-light">no recebimento</em>. Você cobra, o cliente paga, o valor entra em dólar e fica em dólar até você decidir o contrário. Sem corretora, sem PJ no exterior, sem planilha. Roda na Stellar, custa frações de centavo por transação, e o dinheiro é seu desde o primeiro segundo.</>,
    b3Label: "A escolha que sobra",
    b3: <>A pergunta não é se você vai se dolarizar — <em className="font-light">6,8 bilhões dizem que você já está</em>. A pergunta é onde o dólar vai morar quando o cliente pagar: numa exchange que você acessa quando lembra, ou no caixa, no exato momento em que o dinheiro entra.</>,
    cta: "Comece a receber em dólar",
  },
  modules: {
    label: "┃ A solução",
    kicker: "001b · Não é checkout. É commerce stack",
    h2: <>Três módulos.<br/>Uma única <em className="font-light">wallet</em>.</>,
    intro: "Mesma stack Soroban. Cada lojista que aceita SlipPay ganha checkout hoje — e o trilho de yield e cash-out global na sequência.",
    m1: { tag: "01 · Checkout", statusLabel: "Live · mainnet", title: "USDC no carrinho", body: "Comprador paga em stablecoin com qualquer wallet Stellar (Freighter, Lobstr). Lojista recebe USDC direto na carteira. Liquidação atômica < 6s, fee 0,98%. PYUSD em breve." },
    m2: { tag: "02 · Yield", statusLabel: "Parceria em definição", title: "Tesouros pro float do lojista", body: "Saldo parado em USDC vira alocação em Tesouros tokenizados (CETES, US Treasuries) via Etherfuse — custódia regulada, não-custodial. Integração em definição." },
    m3: { tag: "03 · Cross-border", statusLabel: "Rede Stellar · SDF", title: "Cash-out em 180+ países", body: "Comprador internacional saca em dinheiro em agência física via MoneyGram na rede Stellar. Saque físico, não liquidação stablecoin cross-border. Sem banco, sem cartão." },
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
    label: "┃ Prova", kicker: "002b · Verificável on-chain",
    h2: <>Não é promessa. Não é protótipo.<br/><em className="font-light">Vivo na mainnet da Stellar.</em></>,
    body: "Primitiva de assinatura v0.2 implantada na mainnet da Stellar em 16/05/2026. USDC real movido on-chain pelo fluxo de demo x402. As duas transações abaixo são auditáveis publicamente no stellar.expert. A auditoria, feita pela Bluewave AI Security, fechou 8 críticas e 14 altas.",
    contractLabel: "Contrato · MAINNET v0.2", contractMeta: "Soroban SDK 26 · F5 fechado pré-deploy",
    payLabel: "Pagamento x402 · MAINNET", payMeta: "0,05 USDC · comprador → vendedor · 6s de finalidade",
    liveTag: "Vivo na mainnet Stellar", auditTag: "Auditado por Bluewave AI Security",
  },
  how: {
    label: "┃ Mecânica", kicker: "003 · Como funciona",
    h2: <>Quatro partes.<br/>Uma transação <em className="font-light">atômica</em>.</>,
    s1Title: "Crie a cobrança", s1Body: "POST /v1/orders com o valor em dólar. USDC denominado 1:1 contra o USD; sem ida e volta de FX embutida na cobrança.",
    s2Title: "O cliente paga", s2Body: "Hoje, o cliente paga em USDC direto da carteira Stellar. Em breve, paga em Pix (BRL) via parceiro de câmbio licenciado, que entrega o USDC no seu endereço.",
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
    label: "┃ Competição", kicker: "006 · O quadrante",
    h2: <>Ninguém ocupa o<br/><em className="font-light">nosso quadrante</em>.</>,
    rRegional: "Foco regional BR", rPix: "Pix in / BRL out", rSub: "Assinatura Soroban",
    rYield: "Yield (Tesouros tokenizados)", rCashout: "Cash-out global", rCustody: "Não-custodial", rTake: "Take rate",
    sNative: "Nativo", sFx: "Parceiro de câmbio", sFxNote: "em definição", sSub: "Live na mainnet",
    sYieldNote: "roadmap", sCustody: "Sim, by design",
    yes: "Sim", na: "n/d", stripeTake: "2,9% + US$0,30", coinbaseTake: "1,0%", slipTake: "0,98%",
    legendLive: "live", legendRoadmap: "roadmap",
    kickerP: <>A Stripe pagou ~US$ 1,1 bi pela Bridge pra entrar nesse trilho. O quadrante <em className="font-light">BR + Stellar + checkout + recorrência on-chain</em> — o que já está <em className="font-light">live</em> — segue empiricamente vazio.</>,
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
  mobileFooter: "Live on Stellar mainnet · contract CBJMQ6ZY…",
  hero: {
    statusLive: "Live · v0.2",
    eyebrow: "Brazil's commerce stack, in stablecoin",
    h1: <>You hedge against the real with one hand.<br/><em className="not-italic">And get paid in it with the other.{dot}</em></>,
    sub: <>98% of everyone who bought crypto in Brazil in early 2026 bought stablecoin — $6.8bn of $6.9bn. Brazilians already dollarized. Your cash flow hasn't.</>,
    cta: "Start getting paid in dollars",
  },
  tese: {
    label: "┃ The thesis",
    b1Label: "The contradiction",
    b1: <>You buy dollars to protect yourself. But you sell in reais, get paid in reais, pay suppliers in reais, pay staff in reais. The dollars sit idle on an exchange. The cash stays exposed. <em className="font-light">The hedge lives in one place, the risk in another.</em></>,
    b2Label: "What changes",
    b2: <>SlipPay puts the dollar <em className="font-light">at the point of payment</em>. You charge, the customer pays, the money lands in dollars and stays in dollars until you decide otherwise. No broker, no offshore entity, no spreadsheet. It runs on Stellar, costs fractions of a cent per transaction, and the money is yours from the first second.</>,
    b3Label: "The choice that's left",
    b3: <>The question isn't whether you'll dollarize — <em className="font-light">$6.8bn says you already have</em>. The question is where the dollar will live when the customer pays: on an exchange you check when you remember, or in your cash flow, the exact moment the money lands.</>,
    cta: "Start getting paid in dollars",
  },
  modules: {
    label: "┃ The solution",
    kicker: "001b · Not a checkout. A commerce stack",
    h2: <>Three modules.<br/>One single <em className="font-light">wallet</em>.</>,
    intro: "Same Soroban stack. Every merchant who accepts SlipPay gets checkout today — and the yield and global cash-out rails next.",
    m1: { tag: "01 · Checkout", statusLabel: "Live · mainnet", title: "USDC at checkout", body: "Buyer pays in stablecoin with any Stellar wallet (Freighter, Lobstr). Merchant receives USDC straight to their wallet. Atomic settlement < 6s, 0.98% fee. PYUSD soon." },
    m2: { tag: "02 · Yield", statusLabel: "Partnership in progress", title: "Treasuries for the merchant's float", body: "Idle USDC turns into an allocation in tokenized treasuries (CETES, US Treasuries) via Etherfuse — regulated custody, non-custodial. Integration in progress." },
    m3: { tag: "03 · Cross-border", statusLabel: "Stellar network · SDF", title: "Cash-out in 180+ countries", body: "International buyers withdraw physical cash at MoneyGram agencies over the Stellar network. Physical cash-out, not cross-border stablecoin settlement. No bank, no card." },
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
    body: "Subscription primitive v0.2 deployed to Stellar mainnet on 2026-05-16. Real USDC moved on-chain through the x402 demo flow. The two transactions below are publicly auditable on stellar.expert. The audit, by Bluewave AI Security, closed 8 critical and 14 high findings.",
    contractLabel: "Contract · MAINNET v0.2", contractMeta: "Soroban SDK 26 · F5 closed pre-deploy",
    payLabel: "x402 payment · MAINNET", payMeta: "0.05 USDC · buyer → seller · 6s finality",
    liveTag: "Live on Stellar mainnet", auditTag: "Audited by Bluewave AI Security",
  },
  how: {
    label: "┃ Mechanics", kicker: "003 · How it works",
    h2: <>Four parts.<br/>One <em className="font-light">atomic</em> transaction.</>,
    s1Title: "Create the charge", s1Body: "POST /v1/orders with the dollar amount. USDC denominated 1:1 against USD; no FX round-trip baked into the charge.",
    s2Title: "The customer pays", s2Body: "Today, the customer pays in USDC straight from their Stellar wallet. Soon, they pay via Pix (BRL) through a licensed FX partner that delivers USDC to your address.",
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
    label: "┃ Competition", kicker: "006 · The quadrant",
    h2: <>Nobody occupies<br/><em className="font-light">our quadrant</em>.</>,
    rRegional: "Brazil regional focus", rPix: "Pix in / BRL out", rSub: "Soroban subscription",
    rYield: "Yield (tokenized treasuries)", rCashout: "Global cash-out", rCustody: "Non-custodial", rTake: "Take rate",
    sNative: "Native", sFx: "FX partner", sFxNote: "in progress", sSub: "Live on mainnet",
    sYieldNote: "roadmap", sCustody: "Yes, by design",
    yes: "Yes", na: "n/a", stripeTake: "2.9% + $0.30", coinbaseTake: "1.0%", slipTake: "0.98%",
    legendLive: "live", legendRoadmap: "roadmap",
    kickerP: <>Stripe paid ~$1.1bn for Bridge to enter this rail. The quadrant of <em className="font-light">BR + Stellar + checkout + on-chain recurring</em> — what's already <em className="font-light">live</em> — remains empirically empty.</>,
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
