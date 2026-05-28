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
  mobileFooter: "Live na mainnet Stellar · subscription CBJMQ6ZY… · smart wallet CDDPGRFO… (testnet)",
  hero: {
    statusLive: "Live · v0.2",
    eyebrow: "Issue 001 · pra quem vende no Brasil",
    h1: <>O commerce stack do Brasil<br/><em className="not-italic">em stablecoin.{dot}</em></>,
    sub: <>Stablecoin no recebimento. Limite de gasto no bytecode do cliente — não num banco de dados que alguém pode mudar. 0,98% de fee, liquidação em segundos, sem chargeback. <em className="font-light">O que a Stripe estruturalmente não pode replicar.</em></>,
    cta: "Comece a receber em dólar",
  },
  tese: {
    label: "┃ A tese",
    b1Label: "A contradição",
    b1: <>Você compra dólar pra se proteger. Mas vende em real, recebe em real, paga fornecedor em real, paga funcionário em real. O dólar fica parado numa exchange. O caixa fica exposto. <em className="font-light">A proteção mora num lugar, o risco mora em outro.</em></>,
    b2Label: "O que muda",
    b2: <>O Slippay coloca o dólar <em className="font-light">no recebimento</em>. Você cobra, o cliente paga, o valor entra em dólar e fica em dólar até você decidir o contrário. Sem corretora, sem PJ no exterior, sem planilha. Roda na Stellar, custa frações de centavo por transação, e o dinheiro é seu desde o primeiro segundo.</>,
    b3Label: "O moat que sobra",
    b3: <>A pergunta não é se você vai se dolarizar — <em className="font-light">6,8 bilhões dizem que você já está</em>. A pergunta é onde a regra que protege o pagamento vai morar: <em className="font-light">numa base de dados que a plataforma pode mudar</em>, ou no smart wallet do cliente, onde nem a Slippay, nem o merchant, nem o validador conseguem override.</>,
    cta: "Comece a receber em dólar",
  },
  modules: {
    label: "┃ A solução",
    kicker: "001b · Não é checkout. É commerce stack",
    h2: <>Três módulos.<br/>Uma única <em className="font-light">wallet</em>.</>,
    intro: "Mesma stack Soroban. Cada lojista que aceita SlipPay ganha checkout + assinatura recorrente com policy on-chain hoje — yield e cash-out global na sequência.",
    m1: { tag: "01 · Checkout + Assinatura", statusLabel: "Live · mainnet + testnet", title: "USDC com policy do cliente", body: "Comprador paga em USDC (Stellar) e, em assinatura, autoriza por biometria uma policy on-chain: teto por ciclo, intervalo mínimo, expiração, revogação a qualquer momento. O cofre é do cliente — ninguém pode override. Liquidação < 6s, fee 0,98%." },
    m2: { tag: "02 · Yield", statusLabel: "Parceria em definição", title: "Tesouros pro float do lojista", body: "Saldo parado em USDC vira alocação em Tesouros tokenizados (CETES, US Treasuries) via parceiro de câmbio licenciado BR — custódia regulada, não-custodial. Integração em definição." },
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
    body: "Primitiva de assinatura v0.2 implantada na mainnet em 16/05/2026 (CBJMQ6ZY…). Smart wallet com policy on-chain — Stripe-impossible — em testnet desde 28/05/2026 (CDDPGRFO…), 16/16 unit tests + dois passes de auditoria. USDC real movido on-chain pelo fluxo x402 mainnet; cobrança rejeitada por bytecode quando excede o teto em testnet. As transações são públicas no stellar.expert. Auditoria do contrato de assinatura pela Bluewave AI Security: 8 críticas e 14 altas fechadas.",
    contractLabel: "Contrato · MAINNET v0.2", contractMeta: "Soroban SDK 26 · F5 fechado pré-deploy",
    payLabel: "Pagamento x402 · MAINNET", payMeta: "0,05 USDC · comprador → vendedor · 6s de finalidade",
    liveTag: "Live na mainnet Stellar · smart wallet em testnet hardening",
    auditTag: "Auditado por Bluewave AI Security",
  },
  how: {
    label: "┃ Mecânica", kicker: "003 · Como funciona",
    h2: <>Quatro partes.<br/>Uma transação <em className="font-light">atômica</em>.</>,
    s1Title: "Crie a cobrança", s1Body: "POST /v1/orders com o valor em dólar. USDC denominado 1:1 contra o USD; sem ida e volta de FX embutida na cobrança.",
    s2Title: "O cliente paga (e autoriza policy on-chain)", s2Body: "Pagamento avulso: USDC direto da Stellar wallet, ou Pix (BRL) via parceiro de câmbio licenciado. Assinatura: 1 toque biométrico (passkey · secp256r1 nativo no Stellar Protocol 21) instala a policy no smart wallet do cliente. O merchant puxa nos ciclos subsequentes sem novo toque, dentro do teto on-chain.",
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
    label: "┃ Competição", kicker: "006 · O moat estrutural",
    h2: <>Stripe não pode replicar<br/>sem <em className="font-light">deixar de ser Stripe</em>.</>,
    rRegional: "Foco regional BR", rPix: "Pix in / BRL out", rSub: "Assinatura Soroban",
    rYield: "Yield (Tesouros tokenizados)", rCashout: "Cash-out global", rCustody: "Não-custodial", rTake: "Take rate",
    sNative: "Nativo", sFx: "Parceiro de câmbio", sFxNote: "em definição", sSub: "Live na mainnet",
    sYieldNote: "roadmap", sCustody: "Sim, by design",
    yes: "Sim", na: "n/d", stripeTake: "2,9% + US$0,30", coinbaseTake: "1,0%", slipTake: "0,98%",
    legendLive: "live", legendRoadmap: "roadmap",
    kickerP: <>Stripe paga ~2,9% + US$0,30 porque tem que honrar 120 dias de chargeback law. Settlement em 2-7 dias porque a janela de estorno é mandatada. Limite de gasto no banco de dados deles porque a base é mutável. Custódia obrigatória porque money transmitter laws. <em className="font-light">Cada um desses é constitutivo do que faz a Stripe valer US$ 70bi.</em> O quadrante <em className="font-light">BR + Stellar + policy on-chain + recorrência</em> — vivo hoje — segue empiricamente vazio.</>,
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
  mobileFooter: "Live on Stellar mainnet · subscription CBJMQ6ZY… · smart wallet CDDPGRFO… (testnet)",
  hero: {
    statusLive: "Live · v0.2",
    eyebrow: "Issue 001 · for who sells in Brazil",
    h1: <>Brazil's commerce stack<br/><em className="not-italic">in stablecoin.{dot}</em></>,
    sub: <>Stablecoin at the point of payment. Spending limit in the customer's smart-wallet bytecode — not in a database the platform can mutate. 0.98% fee, settlement in seconds, no chargeback. <em className="font-light">What Stripe structurally cannot replicate.</em></>,
    cta: "Start getting paid in dollars",
  },
  tese: {
    label: "┃ The thesis",
    b1Label: "The contradiction",
    b1: <>You buy dollars to protect yourself. But you sell in reais, get paid in reais, pay suppliers in reais, pay staff in reais. The dollars sit idle on an exchange. The cash stays exposed. <em className="font-light">The hedge lives in one place, the risk in another.</em></>,
    b2Label: "What changes",
    b2: <>SlipPay puts the dollar <em className="font-light">at the point of payment</em>. You charge, the customer pays, the money lands in dollars and stays in dollars until you decide otherwise. No broker, no offshore entity, no spreadsheet. It runs on Stellar, costs fractions of a cent per transaction, and the money is yours from the first second.</>,
    b3Label: "The moat that's left",
    b3: <>The question isn't whether you'll dollarize — <em className="font-light">$6.8bn says you already have</em>. The question is where the rule that protects the payment will live: <em className="font-light">in a database the platform can mutate</em>, or in the customer's smart wallet, where neither Slippay, nor the merchant, nor a validator can override.</>,
    cta: "Start getting paid in dollars",
  },
  modules: {
    label: "┃ The solution",
    kicker: "001b · Not a checkout. A commerce stack",
    h2: <>Three modules.<br/>One single <em className="font-light">wallet</em>.</>,
    intro: "Same Soroban stack. Every merchant who accepts SlipPay gets checkout + recurring subscription with on-chain policy today — yield and global cash-out rails next.",
    m1: { tag: "01 · Checkout + Subscription", statusLabel: "Live · mainnet + testnet", title: "USDC with customer-owned policy", body: "Buyer pays in USDC (Stellar) and, for subscriptions, authorizes an on-chain policy by biometric tap: per-cycle cap, minimum interval, expiry, revoke anytime. The vault is the customer's — nobody can override. Settlement < 6s, 0.98% fee." },
    m2: { tag: "02 · Yield", statusLabel: "Partnership in progress", title: "Treasuries for the merchant's float", body: "Idle USDC turns into an allocation in tokenized treasuries (CETES, US Treasuries) via licensed BR FX partner — regulated custody, non-custodial. Integration in progress." },
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
    body: "Subscription primitive v0.2 deployed to Stellar mainnet on 2026-05-16 (CBJMQ6ZY…). Smart wallet with on-chain policy — Stripe-impossible — on testnet since 2026-05-28 (CDDPGRFO…), 16/16 unit tests + two audit passes. Real USDC moved on-chain via mainnet x402 flow; over-cap charges rejected by bytecode on testnet. Transactions are public on stellar.expert. Subscription contract audit by Bluewave AI Security closed 8 critical and 14 high findings.",
    contractLabel: "Contract · MAINNET v0.2", contractMeta: "Soroban SDK 26 · F5 closed pre-deploy",
    payLabel: "x402 payment · MAINNET", payMeta: "0.05 USDC · buyer → seller · 6s finality",
    liveTag: "Live on Stellar mainnet · smart wallet in testnet hardening",
    auditTag: "Audited by Bluewave AI Security",
  },
  how: {
    label: "┃ Mechanics", kicker: "003 · How it works",
    h2: <>Four parts.<br/>One <em className="font-light">atomic</em> transaction.</>,
    s1Title: "Create the charge", s1Body: "POST /v1/orders with the dollar amount. USDC denominated 1:1 against USD; no FX round-trip baked into the charge.",
    s2Title: "The customer pays (and authorizes on-chain policy)", s2Body: "One-off: USDC straight from Stellar wallet, or Pix (BRL) via a licensed FX partner. Subscription: one biometric tap (passkey · secp256r1 native on Stellar Protocol 21) installs the policy in the customer's smart wallet. The merchant pulls subsequent cycles without a new tap, within the on-chain cap.",
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
    label: "┃ Competition", kicker: "006 · The structural moat",
    h2: <>Stripe can't replicate<br/>without <em className="font-light">ceasing to be Stripe</em>.</>,
    rRegional: "Brazil regional focus", rPix: "Pix in / BRL out", rSub: "Soroban subscription",
    rYield: "Yield (tokenized treasuries)", rCashout: "Global cash-out", rCustody: "Non-custodial", rTake: "Take rate",
    sNative: "Native", sFx: "FX partner", sFxNote: "in progress", sSub: "Live on mainnet",
    sYieldNote: "roadmap", sCustody: "Yes, by design",
    yes: "Yes", na: "n/a", stripeTake: "2.9% + $0.30", coinbaseTake: "1.0%", slipTake: "0.98%",
    legendLive: "live", legendRoadmap: "roadmap",
    kickerP: <>Stripe charges ~2.9% + $0.30 because it must honor 120 days of chargeback law. Settlement in 2-7 days because the dispute window is mandated. Spending limit in their database because the database is mutable. Custody required because money-transmitter laws. <em className="font-light">Each one of these is constitutive of what makes Stripe worth $70bn.</em> The quadrant of <em className="font-light">BR + Stellar + on-chain policy + recurring</em> — live today — stays empirically empty.</>,
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
