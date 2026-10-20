// /agents/new — create an AI agent's dollar sub-wallet on Arc (Circle Arc M1).
// Connect wallet → deploy AgentVault (owner = you) → ERC-8004 identity → fund → limits + agent key
// (generated here, in memory) → MCP config shown once → ask Slippay to pin the vault on the relayer.
//
// Resumable from chain: only public pointers (vault address, network, agentId, agent address) go to
// localStorage; every reload re-reads the vault, identity and session from Arc before showing a
// step. Nothing is ever sent on page load — every transaction is an explicit click — so a rejected
// signature or a reload can't deploy a second vault. The agent key / SLH secret never leave this tab:
// no fetch, no storage, no console.

import { Link, useLocation } from "react-router-dom";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { getAddress, isAddress, type Address } from "viem";
import {
  ArcFlowError, DEFAULT_MAX_ABS_PER_TX, agentRegistrationURI, arcReader, buildSessionArgs, connectWallet, deployVault,
  deriveStep, ensureArcChain, explainError, explorerAddress, explorerTx, findAgentId, formatUsdc, fundVault,
  generateAgentKeys, hasPendingTx, identityOwnedBy, installSession, loadFlow, mcpConfig, parseNetwork, parseUsdc,
  readVaultState, registerIdentity, resolveDeploy, revokeSession, saveFlow, validateLimits, walletChainOk,
  type AgentKeys, type ArcNetwork, type Eip1193Provider, type LimitError, type LimitField, type LimitsForm,
  type SavedFlow, type SessionView, type Step,
} from "../lib/arcVault.ts";

const display = { fontFamily: "'Inter', ui-sans-serif, system-ui, sans-serif" } as const;
const GRAY = "#6f6862";
type Lang = "pt" | "en";
const STEPS: Step[] = ["connect", "vault", "identity", "fund", "limits", "config", "activate"];
const PERIODS = [3600, 86_400, 604_800, 2_592_000] as const;
const CONTACT = "manuel@bluewaveai.online";

const COPY = {
  pt: {
    back: "Agentes",
    eyebrow: "nova carteira de agente",
    h1: "Crie a carteira do seu agente.",
    sub: "Sete passos, uns cinco minutos. Você assina tudo na sua própria carteira. A Slippay nunca toca no dinheiro nem na chave do agente.",
    net: {
      testnet: "Rede de teste da Arc. O dinheiro aqui não é de verdade.",
      faucet: "USDC de teste grátis em faucet.circle.com (escolha Arc Testnet).",
      mainnet: "Rede principal da Arc. Aqui o dinheiro é de verdade, e o contrato do cofre ainda não tem auditoria externa: comece com valores pequenos.",
      toMainnet: "Usar a rede principal", toTestnet: "Usar a rede de teste",
    },
    status: { done: "feito", now: "agora", later: "" },
    seeTx: "ver na rede ↗",
    working: "Confirme na sua carteira…",
    waiting: "Sua carteira tem uma transação esperando a rede confirmar. A página confere sozinha.",
    connect: {
      title: "Conecte sua carteira",
      body: "Use uma carteira de navegador, como MetaMask ou Rabby. Ela vai ser a dona da sub-carteira: só ela pode mudar limites, cancelar o agente ou tirar o dinheiro.",
      noWallet: "Não encontramos uma carteira neste navegador. Instale a MetaMask (metamask.io) ou a Rabby e recarregue a página.",
      btn: "Conectar carteira", switchBtn: "Mudar para a rede Arc", wrongChain: "Sua carteira está em outra rede.",
      done: (a: string) => `Carteira ${a}`,
      noGas: "Sua carteira não tem USDC na Arc para pagar as taxas de rede (frações de centavo).",
    },
    vault: {
      title: "Crie a sub-carteira",
      body: "Um cofre em dólar (USDC) só seu, na rede Arc. O agente gasta daqui, nunca da sua carteira principal.",
      ceiling: "Teto absoluto por pagamento (USDC)",
      ceilingHelp: "Nenhum pagamento do agente passa disso, nunca, nem se você mudar os limites depois. Não dá para mudar.",
      btn: "Criar sub-carteira",
      retry: "A tentativa anterior não foi concluída. Nada foi criado.",
      haveOne: "Já criei uma sub-carteira antes", adoptLabel: "Endereço da sub-carteira", adoptBtn: "Usar esta",
      done: (a: string, c: string) => `Sub-carteira ${a} · teto ${c} USDC por pagamento`,
    },
    identity: {
      title: "Dê uma identidade ao agente",
      body: "Registramos um cartão de identidade do agente na Arc (padrão ERC-8004), no nome da sua carteira. Todo pagamento fica ligado a ele.",
      name: "Nome do agente", namePh: "Ex.: Agente de compras", nameHelp: "Fica público na rede. Não use dados pessoais.",
      btn: "Registrar identidade", done: (id: string) => `Identidade nº ${id}`,
    },
    fund: {
      title: "Coloque dólares na sub-carteira",
      body: "Mande USDC da sua carteira para a sub-carteira. O agente só consegue gastar o que estiver lá, e você pode tirar quando quiser.",
      amount: "Quanto enviar (USDC)", btn: (a: string) => `Enviar ${a} USDC`, later: "Fazer depois",
      inVault: "Na sub-carteira", inWallet: "Na sua carteira", more: "adicionar saldo",
      done: (b: string) => `Saldo ${b} USDC`,
    },
    limits: {
      title: "Defina os limites",
      body: "É aqui que mora a segurança: a própria rede recusa qualquer pagamento fora destas regras, mesmo que o agente seja enganado.",
      perTx: "Máximo por pagamento (USDC)", window: "Máximo por período (USDC)", period: "Período",
      periods: { 3600: "por hora", 86400: "por dia", 604800: "por semana", 2592000: "por 30 dias" } as Record<number, string>,
      recipients: "Quem pode receber", recipientsHelp: "Um endereço por linha (0x…). Fora desta lista, nada sai.",
      expires: "Válido até", never: "Sem data de fim",
      pq: "Dupla checagem pós-quântica acima de (USDC)",
      pqHelp: "Opcional. Acima deste valor, o pagamento também precisa de uma assinatura pós-quântica. Vazio = desligado.",
      btn: "Criar a chave do agente e gravar os limites",
      keyNote: "A chave do agente é criada agora, neste navegador, e não é enviada para a Slippay.",
      done: (per: string, win: string, period: string) => `Até ${per} USDC por pagamento · ${win} USDC ${period}`,
      until: (d: string) => ` · até ${d}`, pqOn: (v: string) => ` · pós-quântico acima de ${v}`,
    },
    fieldErr: {
      required: "Preencha este campo.", invalid_amount: "Valor inválido. Use números, ex.: 25 ou 12,50.", zero: "Precisa ser maior que zero.",
      above_ceiling: "Passa do teto absoluto da sub-carteira.", window_below_per_tx: "Precisa ser pelo menos o máximo por pagamento.",
      window_above_100x: "No máximo 100 vezes o máximo por pagamento.", window_too_short: "Período curto demais.",
      no_recipients: "Coloque pelo menos um endereço.", bad_address: "Tem um endereço inválido na lista.",
      self_recipient: "A lista não pode ter a sua carteira, a sub-carteira nem o endereço zero.",
      too_many_recipients: "No máximo 50 endereços.", expiry_past: "A data precisa ser no futuro.", invalid_date: "Data inválida.",
      pq_never_applies: "Precisa ser menor que o máximo por pagamento, senão nunca vale.",
    } satisfies Record<LimitError, string>,
    config: {
      title: "Conecte o agente",
      saveNow: "Guarde isto agora.",
      body: "Esta é a configuração do servidor MCP da Slippay, com a chave do seu agente. Ela foi criada neste navegador e não foi enviada para a Slippay nem para ninguém. Ela aparece uma vez só: se você sair sem guardar, vai precisar criar outra.",
      where: "Cole na configuração MCP do seu agente (Claude Desktop, Claude Code, Cursor, n8n…). Quem tiver este texto consegue gastar dentro dos limites: trate como uma senha.",
      copy: "Copiar", copied: "Copiado", download: "Baixar arquivo",
      confirm: "Guardei em um lugar seguro", next: "Continuar",
      lostTitle: "A chave do agente não está mais nesta página.",
      lostBody: "Ela aparece uma vez só e não fica guardada no navegador. Se você já guardou, continue. Se não, cancele esta chave na rede e crie outra (os limites e o saldo continuam).",
      saved: "Já guardei, continuar", revoke: "Cancelar esta chave e criar outra",
      done: "Agente conectado",
    },
    activate: {
      title: "Peça a ativação",
      body: "A Slippay paga a taxa de rede de cada pagamento do seu agente. Para isso, precisamos liberar a sua sub-carteira do nosso lado. Mande para a gente só o endereço abaixo.",
      never: "Nunca mande a chave do agente. Ninguém da Slippay vai pedir.",
      email: "Enviar por e-mail", copy: "Copiar endereço", copied: "Copiado",
      subject: (n: string) => `Ativar sub-carteira de agente na Arc (${n})`,
    },
    err: {
      rejected: "Você cancelou na carteira. Nada foi enviado. Pode tentar de novo.",
      wrong_chain: "Sua carteira está em outra rede. Troque para a Arc e tente de novo.",
      insufficient_funds: "Saldo insuficiente na sua carteira (valor + taxa de rede).",
      account_changed: "A conta da carteira mudou no meio do caminho. Confira a conta e tente de novo.",
      not_a_vault: "Esse endereço não é uma sub-carteira Slippay nesta rede.",
      not_owner: "Essa sub-carteira pertence a outra carteira.",
      tx_failed: "A transação falhou na rede. Nada mudou.",
      timeout: "A rede está demorando para confirmar. Espere uns segundos: a página confere sozinha.",
      no_wallet: "Nenhuma carteira encontrada neste navegador.", no_account: "A carteira não liberou nenhuma conta.",
      invalid_amount: "Valor inválido.", read: "Não conseguimos ler a rede agora. Tente de novo em instantes.",
      unknown: "Algo deu errado. Tente de novo.",
      reverted: (r: string) => `A rede recusou: ${r}.`,
    } as Record<string, string | ((r: string) => string)>,
    reasons: {
      NotOwner: "esta carteira não é a dona da sub-carteira", ExceedsAbsoluteCeiling: "o máximo por pagamento passa do teto absoluto",
      InvalidConfig: "algum limite está fora das regras", EmptyAllowlist: "a lista de quem pode receber está vazia",
      RecipientNotAllowed: "a lista tem um endereço não permitido", UnknownAgent: "a identidade do agente não foi encontrada",
      SessionExists: "esta chave de agente já foi usada", NoSession: "não há chave de agente instalada",
    } as Record<string, string>,
  },
  en: {
    back: "Agents",
    eyebrow: "new agent wallet",
    h1: "Create your agent's wallet.",
    sub: "Seven steps, about five minutes. You sign everything in your own wallet. Slippay never touches the money or the agent's key.",
    net: {
      testnet: "Arc test network. The money here isn't real.",
      faucet: "Free test USDC at faucet.circle.com (pick Arc Testnet).",
      mainnet: "Arc main network. This is real money, and the vault contract has no third-party audit yet: start with small amounts.",
      toMainnet: "Use the main network", toTestnet: "Use the test network",
    },
    status: { done: "done", now: "now", later: "" },
    seeTx: "see on the network ↗",
    working: "Confirm in your wallet…",
    waiting: "Your wallet has a transaction waiting for the network. The page checks on its own.",
    connect: {
      title: "Connect your wallet",
      body: "Use a browser wallet such as MetaMask or Rabby. It becomes the owner of the sub-wallet: only it can change limits, cancel the agent or take the money out.",
      noWallet: "We couldn't find a wallet in this browser. Install MetaMask (metamask.io) or Rabby and reload the page.",
      btn: "Connect wallet", switchBtn: "Switch to the Arc network", wrongChain: "Your wallet is on another network.",
      done: (a: string) => `Wallet ${a}`,
      noGas: "Your wallet has no USDC on Arc to pay network fees (fractions of a cent).",
    },
    vault: {
      title: "Create the sub-wallet",
      body: "A dollar (USDC) vault that only you own, on the Arc network. The agent spends from here, never from your main wallet.",
      ceiling: "Absolute ceiling per payment (USDC)",
      ceilingHelp: "No agent payment can ever go above this, even if you change the limits later. It can't be changed.",
      btn: "Create sub-wallet",
      retry: "The previous attempt didn't go through. Nothing was created.",
      haveOne: "I already created a sub-wallet", adoptLabel: "Sub-wallet address", adoptBtn: "Use this one",
      done: (a: string, c: string) => `Sub-wallet ${a} · ceiling ${c} USDC per payment`,
    },
    identity: {
      title: "Give the agent an identity",
      body: "We register an identity card for the agent on Arc (ERC-8004 standard), owned by your wallet. Every payment is tied to it.",
      name: "Agent name", namePh: "E.g. Purchasing agent", nameHelp: "It's public on the network. Don't use personal data.",
      btn: "Register identity", done: (id: string) => `Identity #${id}`,
    },
    fund: {
      title: "Put dollars in the sub-wallet",
      body: "Send USDC from your wallet to the sub-wallet. The agent can only spend what's in there, and you can take it out any time.",
      amount: "How much to send (USDC)", btn: (a: string) => `Send ${a} USDC`, later: "Do it later",
      inVault: "In the sub-wallet", inWallet: "In your wallet", more: "add funds",
      done: (b: string) => `Balance ${b} USDC`,
    },
    limits: {
      title: "Set the limits",
      body: "This is where the safety lives: the network itself refuses any payment outside these rules, even if the agent gets tricked.",
      perTx: "Maximum per payment (USDC)", window: "Maximum per period (USDC)", period: "Period",
      periods: { 3600: "per hour", 86400: "per day", 604800: "per week", 2592000: "per 30 days" } as Record<number, string>,
      recipients: "Who can receive", recipientsHelp: "One address per line (0x…). Outside this list, nothing goes out.",
      expires: "Valid until", never: "No end date",
      pq: "Post-quantum double check above (USDC)",
      pqHelp: "Optional. Above this amount a payment also needs a post-quantum signature. Empty = off.",
      btn: "Create the agent key and save the limits",
      keyNote: "The agent key is created now, in this browser, and is not sent to Slippay.",
      done: (per: string, win: string, period: string) => `Up to ${per} USDC per payment · ${win} USDC ${period}`,
      until: (d: string) => ` · until ${d}`, pqOn: (v: string) => ` · post-quantum above ${v}`,
    },
    fieldErr: {
      required: "Fill in this field.", invalid_amount: "Invalid amount. Use numbers, e.g. 25 or 12.50.", zero: "Must be more than zero.",
      above_ceiling: "Above the sub-wallet's absolute ceiling.", window_below_per_tx: "Must be at least the maximum per payment.",
      window_above_100x: "At most 100 times the maximum per payment.", window_too_short: "Period too short.",
      no_recipients: "Add at least one address.", bad_address: "There's an invalid address in the list.",
      self_recipient: "The list can't include your wallet, the sub-wallet or the zero address.",
      too_many_recipients: "At most 50 addresses.", expiry_past: "The date must be in the future.", invalid_date: "Invalid date.",
      pq_never_applies: "Must be less than the maximum per payment, or it never applies.",
    } satisfies Record<LimitError, string>,
    config: {
      title: "Connect the agent",
      saveNow: "Save this now.",
      body: "This is the Slippay MCP server config with your agent's key. It was created in this browser and was not sent to Slippay or anyone else. It shows only once: if you leave without saving it, you'll need to create another.",
      where: "Paste it into your agent's MCP config (Claude Desktop, Claude Code, Cursor, n8n…). Whoever has this text can spend inside the limits: treat it like a password.",
      copy: "Copy", copied: "Copied", download: "Download file",
      confirm: "I saved it somewhere safe", next: "Continue",
      lostTitle: "The agent key is no longer on this page.",
      lostBody: "It shows only once and isn't kept in the browser. If you saved it, continue. If not, cancel this key on the network and create another (limits and balance stay).",
      saved: "I saved it, continue", revoke: "Cancel this key and create another",
      done: "Agent connected",
    },
    activate: {
      title: "Request activation",
      body: "Slippay pays the network fee for each of your agent's payments. For that, we need to enable your sub-wallet on our side. Send us only the address below.",
      never: "Never send the agent key. Nobody at Slippay will ask for it.",
      email: "Send by email", copy: "Copy address", copied: "Copied",
      subject: (n: string) => `Activate agent sub-wallet on Arc (${n})`,
    },
    err: {
      rejected: "You cancelled in your wallet. Nothing was sent. You can try again.",
      wrong_chain: "Your wallet is on another network. Switch to Arc and try again.",
      insufficient_funds: "Not enough balance in your wallet (amount + network fee).",
      account_changed: "The wallet account changed midway. Check the account and try again.",
      not_a_vault: "That address isn't a Slippay sub-wallet on this network.",
      not_owner: "That sub-wallet belongs to another wallet.",
      tx_failed: "The transaction failed on the network. Nothing changed.",
      timeout: "The network is slow to confirm. Wait a few seconds: the page checks on its own.",
      no_wallet: "No wallet found in this browser.", no_account: "The wallet didn't share an account.",
      invalid_amount: "Invalid amount.", read: "We couldn't read the network right now. Try again in a moment.",
      unknown: "Something went wrong. Try again.",
      reverted: (r: string) => `The network refused: ${r}.`,
    } as Record<string, string | ((r: string) => string)>,
    reasons: {
      NotOwner: "this wallet doesn't own the sub-wallet", ExceedsAbsoluteCeiling: "the per-payment maximum is above the absolute ceiling",
      InvalidConfig: "a limit is outside the rules", EmptyAllowlist: "the recipient list is empty",
      RecipientNotAllowed: "the list has an address that isn't allowed", UnknownAgent: "the agent identity wasn't found",
      SessionExists: "this agent key was already used", NoSession: "no agent key is installed",
    } as Record<string, string>,
  },
} as const;

const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;
const storage = () => { try { return window.localStorage; } catch { return null; } };
const injected = (): Eip1193Provider | undefined => (window as unknown as { ethereum?: Eip1193Provider }).ethereum;
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const nativeToUsdc = (wei: bigint) => formatUsdc(wei / 1_000_000_000_000n);

type ChainView = {
  chainOk: boolean;
  nativeBalance: bigint | null;
  pendingTx: boolean;
  vault: Address | null;
  deployPending: boolean;
  deployFailed: boolean;
  maxAbsolutePerTx: bigint | null;
  balance: bigint;
  agentId: bigint | null;
  session: SessionView | null;
};
const EMPTY_VIEW: ChainView = {
  chainOk: false, nativeBalance: null, pendingTx: false, vault: null, deployPending: false, deployFailed: false,
  maxAbsolutePerTx: null, balance: 0n, agentId: null, session: null,
};
/** Agent secrets live only here, in memory, tagged with where they belong. */
type HeldKeys = AgentKeys & { vault: Address; network: ArcNetwork; owner: Address };

function Stamp({ n, label }: { n: string; label: string }) {
  return (
    <div className="flex items-center gap-3 font-mono text-[11px] uppercase tracking-[0.3em]" style={{ color: GRAY }}>
      <span className="text-[#0a0a0a]/70">{n}</span><span className="h-px w-10 bg-current opacity-40" /><span>{label}</span>
    </div>
  );
}

function Field({ label, help, error, children }: { label: string; help?: string; error?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#0a0a0a]/55">{label}</span>
      <div className="mt-2">{children}</div>
      {error ? <span className="mt-1.5 block text-[13px] text-[#a5281b]">{error}</span>
        : help ? <span className="mt-1.5 block text-[13px] text-[#0a0a0a]/50 leading-snug">{help}</span> : null}
    </label>
  );
}

export default function AgentsNew() {
  const { search } = useLocation();
  const network = parseNetwork(search);
  const [lang, setLang] = useState<Lang>(() => {
    try { const s = localStorage.getItem("slippay.lang"); if (s === "pt" || s === "en") return s; } catch { /* */ }
    return "pt";
  });
  useEffect(() => { try { localStorage.setItem("slippay.lang", lang); } catch { /* */ } }, [lang]);
  const t = COPY[lang];

  const provider = useMemo(injected, []);
  const reader = useMemo(() => arcReader(network), [network]);
  const [owner, setOwner] = useState<Address | null>(null);
  const [flow, setFlow] = useState<SavedFlow | null>(null);
  const [view, setView] = useState<ChainView>(EMPTY_VIEW);
  const [resolving, setResolving] = useState(false);
  const [busy, setBusy] = useState<Step | null>(null);
  const [err, setErr] = useState<{ step: Step; code: string; reason?: string } | null>(null);
  const [lastTx, setLastTx] = useState<{ step: Step; hash: string } | null>(null);
  const [held, setHeld] = useState<HeldKeys | null>(null);
  const seq = useRef(0);

  // form state
  const [ceiling, setCeiling] = useState(formatUsdc(DEFAULT_MAX_ABS_PER_TX));
  const [adoptOpen, setAdoptOpen] = useState(false);
  const [adoptAddr, setAdoptAddr] = useState("");
  const [agentName, setAgentName] = useState("");
  const [fundAmount, setFundAmount] = useState(network === "testnet" ? "2" : "");
  const [fundOpen, setFundOpen] = useState(false);
  const [form, setForm] = useState<LimitsForm>(() => ({
    perTx: "", window: "", windowSeconds: 86_400, recipients: "",
    expiresOn: ymd(new Date(Date.now() + 90 * 86_400_000)), pqAbove: "",
  }));
  const [noExpiry, setNoExpiry] = useState(false);
  const [formErrors, setFormErrors] = useState<Partial<Record<LimitField, LimitError>>>({});
  const [savedConfirm, setSavedConfirm] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const persist = useCallback((f: SavedFlow) => { saveFlow(storage(), f); setFlow(f); }, []);
  const patchFlow = useCallback((patch: Partial<SavedFlow>) => {
    if (!owner) return;
    const mem = flow && flow.network === network && flow.owner === owner ? flow : null;
    const base = loadFlow(storage(), network, owner) ?? mem ?? { network, owner };
    persist({ ...base, ...patch, network, owner });
  }, [owner, network, flow, persist]);

  /** Re-derive everything from Arc. Storage only says where to look; the chain says what is true. */
  const resolve = useCallback(async () => {
    if (!owner) { setView(EMPTY_VIEW); return; }
    const my = ++seq.current;
    setResolving(true);
    try {
      let f: SavedFlow = loadFlow(storage(), network, owner) ?? flow ?? { network, owner };
      if (f.network !== network || f.owner !== owner) f = { network, owner };
      const [chainOk, nativeBalance, pendingTx] = await Promise.all([
        provider ? walletChainOk(provider, network).catch(() => false) : Promise.resolve(false),
        reader.getBalance({ address: owner }),
        hasPendingTx({ network, owner, reader }),
      ]);
      const v: ChainView = { ...EMPTY_VIEW, chainOk, nativeBalance, pendingTx };

      if (f.vault || f.vaultNonce !== undefined) {
        const d = await resolveDeploy({ network, owner, vault: f.vault, vaultNonce: f.vaultNonce, reader });
        if (d.status === "deployed") { v.vault = d.vault; if (f.vault !== d.vault) f = { ...f, vault: d.vault }; }
        else if (d.status === "pending") v.deployPending = true;
        else {
          // Not deployed (rejected / dropped / not visible yet). Keep watching the nonce until it's
          // stale so a late-landing deploy is still adopted; drop vault-bound state.
          v.deployFailed = !d.stale;
          f = { network, owner, vaultNonce: d.stale ? undefined : f.vaultNonce, agentId: f.agentId, identityFromBlock: f.identityFromBlock };
        }
      }

      if (v.vault) {
        if (f.agentId && (await identityOwnedBy({ network, agentId: BigInt(f.agentId), owner, reader }))) v.agentId = BigInt(f.agentId);
        else if (f.agentId) f = { ...f, agentId: undefined };
        if (v.agentId === null && f.identityFromBlock) {
          const id = await findAgentId({ network, owner, fromBlock: BigInt(f.identityFromBlock), reader });
          if (id !== null) { v.agentId = id; f = { ...f, agentId: id.toString() }; }
        }
        const st = await readVaultState({ network, vault: v.vault, owner, agentSigner: f.agentSigner, reader });
        if (st.exists) {
          v.maxAbsolutePerTx = st.maxAbsolutePerTx;
          v.balance = st.balance;
          const s = st.session;
          if (s?.exists && !s.revoked) {
            v.session = s;
            if (v.agentId === null) { v.agentId = s.agentId; f = { ...f, agentId: s.agentId.toString() }; }
          } else if (f.agentSigner && (s?.revoked || !pendingTx)) {
            // install never landed (or was revoked): that agent key is dead, start the limits step over
            f = { ...f, agentSigner: undefined, configSaved: undefined };
          }
        }
      }
      if (my !== seq.current) return;
      persist(f);
      setView(v);
      setErr((e) => (e?.code === "read" ? null : e));
    } catch {
      if (my === seq.current) setErr({ step: "connect", code: "read" });
    } finally {
      if (my === seq.current) setResolving(false);
    }
  }, [owner, network, provider, reader, flow, persist]);

  const resolveRef = useRef(resolve);
  resolveRef.current = resolve;

  // silent reconnect + wallet events
  useEffect(() => {
    if (!provider) return;
    provider.request({ method: "eth_accounts" })
      .then((a) => { const x = (a as string[])?.[0]; if (x && isAddress(x)) setOwner(getAddress(x)); })
      .catch(() => { /* not connected yet */ });
    const onAccounts = (...args: unknown[]) => {
      const a = (args[0] as string[] | undefined)?.[0];
      setOwner(a && isAddress(a) ? getAddress(a) : null);
    };
    const onChain = () => { seq.current++; setView((v) => ({ ...v, chainOk: false })); void resolveRef.current(); };
    provider.on?.("accountsChanged", onAccounts);
    provider.on?.("chainChanged", onChain);
    return () => {
      provider.removeListener?.("accountsChanged", onAccounts);
      provider.removeListener?.("chainChanged", onChain);
    };
  }, [provider]);

  useEffect(() => { setFlow(null); setLastTx(null); setErr(null); void resolveRef.current(); }, [owner, network]);

  // poll while something of ours is in the mempool
  useEffect(() => {
    if (!view.pendingTx && !view.deployPending) return;
    const id = setInterval(() => { void resolveRef.current(); }, 4000);
    return () => clearInterval(id);
  }, [view.pendingTx, view.deployPending]);

  const keysHere = held && view.vault && held.vault === view.vault && held.network === network && held.owner === owner
    && flow?.agentSigner === held.agentAddress ? held : null;

  // leaving with an unsaved agent key loses it: ask first
  useEffect(() => {
    if (!keysHere || !view.session) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [keysHere, view.session]);

  const step = deriveStep({
    connected: !!owner,
    chainOk: view.chainOk,
    vault: !!view.vault,
    identity: view.agentId !== null,
    funded: view.balance > 0n || !!flow?.fundSkipped || !!view.session,
    session: !!view.session,
    configSaved: !!flow?.configSaved,
  });

  async function act(s: Step, fn: () => Promise<void>) {
    setErr(null);
    setBusy(s);
    try { await fn(); } catch (e) { setErr({ step: s, ...explainError(e) }); } finally { setBusy(null); await resolve(); }
  }
  const onHash = (s: Step) => (hash: string) => setLastTx({ step: s, hash });

  const doConnect = () => act("connect", async () => {
    const a = await connectWallet(provider);
    setOwner(a);
    await ensureArcChain(provider!, network);
  });
  const doSwitch = () => act("connect", async () => { await ensureArcChain(provider!, network); });

  const doDeploy = () => act("vault", async () => {
    const max = parseUsdc(ceiling);
    if (!max || max <= 0n) throw new ArcFlowError("invalid_amount");
    // last look before spending gas: never a second vault if one already exists or is in flight
    const d = await resolveDeploy({ network, owner: owner!, vault: flow?.vault, vaultNonce: flow?.vaultNonce, reader });
    if (d.status !== "none") return;
    await deployVault({
      provider: provider!, network, owner: owner!, reader, maxAbsolutePerTx: max,
      onSubmitting: ({ predictedVault, nonce }) => patchFlow({ vault: predictedVault, vaultNonce: nonce }),
      onHash: onHash("vault"),
    }).then(({ vault }) => patchFlow({ vault }));
  });

  const doAdopt = () => act("vault", async () => {
    if (!isAddress(adoptAddr.trim())) throw new ArcFlowError("not_a_vault");
    const vault = getAddress(adoptAddr.trim());
    const st = await readVaultState({ network, vault, owner: owner!, reader });
    if (!st.exists || !st.isAgentVault) throw new ArcFlowError("not_a_vault");
    if (!st.ownerMatches) throw new ArcFlowError("not_owner");
    patchFlow({ vault, vaultNonce: undefined });
    setAdoptOpen(false);
  });

  const doIdentity = () => act("identity", async () => {
    const { agentId } = await registerIdentity({
      provider: provider!, network, owner: owner!, reader,
      agentURI: agentRegistrationURI({ name: agentName, vault: view.vault!, network }),
      onSubmitting: (fromBlock) => patchFlow({ identityFromBlock: fromBlock.toString() }),
      onHash: onHash("identity"),
    });
    patchFlow({ agentId: agentId.toString() });
  });

  const doFund = () => act("fund", async () => {
    const amount = parseUsdc(fundAmount);
    if (!amount) throw new ArcFlowError("invalid_amount");
    await fundVault({ provider: provider!, network, owner: owner!, reader, vault: view.vault!, amount, onHash: onHash("fund") });
    setFundOpen(false);
  });

  const doInstall = async () => {
    if (!owner || !view.vault || view.agentId === null || view.maxAbsolutePerTx === null) return;
    const v = validateLimits({ ...form, expiresOn: noExpiry ? "" : form.expiresOn }, {
      owner, vault: view.vault, maxAbsolutePerTx: view.maxAbsolutePerTx, nowSec: Math.floor(Date.now() / 1000),
    });
    setFormErrors(v.ok ? {} : v.errors);
    if (!v.ok) return;
    const vault = view.vault;
    const agentId = view.agentId;
    await act("limits", async () => {
      await new Promise((r) => setTimeout(r, 30)); // let "working" paint before SLH keygen (~0.5 s)
      const keys = generateAgentKeys({ pq: v.value.pqThreshold !== null });
      setHeld({ ...keys, vault, network, owner });
      setSavedConfirm(false);
      patchFlow({ agentSigner: keys.agentAddress, configSaved: false });
      const args = buildSessionArgs({ ...v.value, agentSigner: keys.agentAddress, agentId, slhVk: keys.slhVk });
      await installSession({ provider: provider!, network, owner, reader, vault, args, onHash: onHash("limits") });
    });
  };

  const doConfigDone = () => { setHeld(null); setSavedConfirm(false); patchFlow({ configSaved: true }); };
  const doRevoke = () => act("config", async () => {
    await revokeSession({ provider: provider!, network, owner: owner!, reader, vault: view.vault!, agentSigner: flow!.agentSigner!, onHash: onHash("config") });
    setHeld(null);
    patchFlow({ agentSigner: undefined, configSaved: undefined });
  });

  const copy = async (key: string, text: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(null), 1600); } catch { /* clipboard blocked */ }
  };
  const download = (text: string) => {
    const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "slippay-agent-mcp.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // ----------------------------------------------------------------------- render helpers
  const btn = "lift inline-flex items-center justify-center rounded-full px-8 py-4 text-[11px] uppercase tracking-[0.22em] bg-[#002FA7] text-white font-semibold disabled:opacity-40 disabled:cursor-not-allowed disabled:transform-none";
  const linkBtn = "text-[12px] uppercase tracking-[0.18em] border-b-2 border-[#002FA7] pb-1 hover:opacity-70 disabled:opacity-40";
  const input = "w-full rounded-xl border border-[#0a0a0a]/15 bg-white px-4 py-3 text-[15px] focus:outline-none focus:border-[#002FA7]";
  const locked = busy !== null || resolving || view.pendingTx || view.deployPending;

  const errorFor = (s: Step) => {
    if (!err || err.step !== s) return null;
    const m = t.err[err.code] ?? t.err.unknown;
    const text = typeof m === "function" ? m(t.reasons[err.reason ?? ""] ?? err.reason ?? "") : m;
    return <div role="alert" className="mt-5 rounded-xl border border-[#a5281b]/25 bg-[#a5281b]/[0.04] px-4 py-3 text-[14px] text-[#a5281b]">{text}</div>;
  };
  const txFor = (s: Step) => lastTx?.step === s
    ? <a href={explorerTx(network, lastTx.hash)} target="_blank" rel="noreferrer" className="font-mono text-[11px] text-[#002FA7] hover:opacity-70">{t.seeTx}</a>
    : null;
  const working = (s: Step) => busy === s ? <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#0a0a0a]/50">{t.working}</span> : null;

  const periodLabel = (secs: bigint) => t.limits.periods[Number(secs)] ?? `/ ${Number(secs) / 3600} h`;
  const summary: Partial<Record<Step, ReactNode>> = {
    connect: owner ? t.connect.done(short(owner)) : null,
    vault: view.vault ? (
      <a href={explorerAddress(network, view.vault)} target="_blank" rel="noreferrer" className="hover:opacity-70">
        {t.vault.done(short(view.vault), formatUsdc(view.maxAbsolutePerTx ?? 0n))} ↗
      </a>
    ) : null,
    identity: view.agentId !== null ? t.identity.done(view.agentId.toString()) : null,
    fund: view.vault ? (
      <span>
        {t.fund.done(formatUsdc(view.balance))}
        {step !== "fund" && !fundOpen && (
          <button onClick={() => setFundOpen(true)} className="ml-3 text-[#002FA7] hover:opacity-70">{t.fund.more}</button>
        )}
      </span>
    ) : null,
    limits: view.session ? (
      t.limits.done(formatUsdc(view.session.perTxCap), formatUsdc(view.session.windowCap), periodLabel(view.session.windowSeconds))
      + (view.session.expiresAt ? t.limits.until(new Date(Number(view.session.expiresAt) * 1000).toLocaleDateString(lang === "pt" ? "pt-BR" : "en-US")) : "")
      + (view.session.pqThreshold < (1n << 128n) - 1n ? t.limits.pqOn(formatUsdc(view.session.pqThreshold)) : "")
    ) : null,
    config: flow?.configSaved ? t.config.done : null,
  };

  const fundForm = (
    <>
      <div className="mt-6 grid grid-cols-2 gap-4 max-w-[420px] text-[14px]">
        <div><div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#0a0a0a]/50">{t.fund.inVault}</div><div className="mt-1 text-xl font-semibold">{formatUsdc(view.balance)} USDC</div></div>
        <div><div className="font-mono text-[10px] uppercase tracking-[0.2em] text-[#0a0a0a]/50">{t.fund.inWallet}</div><div className="mt-1 text-xl font-semibold">{view.nativeBalance === null ? "…" : nativeToUsdc(view.nativeBalance)} USDC</div></div>
      </div>
      <div className="mt-6 max-w-[260px]">
        <Field label={t.fund.amount}>
          <input className={input} inputMode="decimal" value={fundAmount} onChange={(e) => setFundAmount(e.target.value)} />
        </Field>
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
        <button className={btn} disabled={locked || !parseUsdc(fundAmount)} onClick={doFund}>{t.fund.btn(fundAmount.trim() || "0")}</button>
        {step === "fund"
          ? <button className={linkBtn} disabled={locked} onClick={() => patchFlow({ fundSkipped: true })}>{t.fund.later}</button>
          : <button className={linkBtn} disabled={locked} onClick={() => setFundOpen(false)}>×</button>}
        {working("fund")}{txFor("fund")}
      </div>
      {errorFor("fund")}
    </>
  );

  const bodies: Record<Step, ReactNode> = {
    connect: !provider ? <p className="mt-4 text-[15px] text-[#0a0a0a]/70">{t.connect.noWallet}</p> : (
      <>
        <p className="mt-3 text-[15px] leading-relaxed text-[#0a0a0a]/65 max-w-[56ch]">{t.connect.body}</p>
        {owner && !view.chainOk && <p className="mt-4 text-[14px] text-[#a5281b]">{t.connect.wrongChain}</p>}
        <div className="mt-6 flex flex-wrap items-center gap-6">
          {!owner
            ? <button className={btn} disabled={busy !== null} onClick={doConnect}>{t.connect.btn}</button>
            : <button className={btn} disabled={busy !== null} onClick={doSwitch}>{t.connect.switchBtn}</button>}
          {working("connect")}
        </div>
        {errorFor("connect")}
      </>
    ),
    vault: (
      <>
        <p className="mt-3 text-[15px] leading-relaxed text-[#0a0a0a]/65 max-w-[56ch]">{t.vault.body}</p>
        {view.deployFailed && <p className="mt-4 text-[14px] text-[#0a0a0a]/70">{t.vault.retry}</p>}
        {view.nativeBalance === 0n && <p className="mt-4 text-[14px] text-[#a5281b]">{t.connect.noGas}{network === "testnet" ? ` ${t.net.faucet}` : ""}</p>}
        <div className="mt-6 max-w-[320px]">
          <Field label={t.vault.ceiling} help={t.vault.ceilingHelp}>
            <input className={input} inputMode="decimal" value={ceiling} onChange={(e) => setCeiling(e.target.value)} />
          </Field>
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
          <button className={btn} disabled={locked || !parseUsdc(ceiling)} onClick={doDeploy}>{t.vault.btn}</button>
          <button className={linkBtn} disabled={locked} onClick={() => setAdoptOpen((o) => !o)}>{t.vault.haveOne}</button>
          {working("vault")}{txFor("vault")}
        </div>
        {adoptOpen && (
          <div className="mt-6 flex flex-col md:flex-row md:items-end gap-4 max-w-[640px]">
            <div className="flex-1"><Field label={t.vault.adoptLabel}>
              <input className={`${input} font-mono text-[13px]`} placeholder="0x…" spellCheck={false} value={adoptAddr} onChange={(e) => setAdoptAddr(e.target.value)} />
            </Field></div>
            <button className={btn} disabled={locked || !isAddress(adoptAddr.trim())} onClick={doAdopt}>{t.vault.adoptBtn}</button>
          </div>
        )}
        {errorFor("vault")}
      </>
    ),
    identity: (
      <>
        <p className="mt-3 text-[15px] leading-relaxed text-[#0a0a0a]/65 max-w-[56ch]">{t.identity.body}</p>
        <div className="mt-6 max-w-[420px]">
          <Field label={t.identity.name} help={t.identity.nameHelp}>
            <input className={input} maxLength={64} placeholder={t.identity.namePh} value={agentName} onChange={(e) => setAgentName(e.target.value)} />
          </Field>
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-6">
          <button className={btn} disabled={locked} onClick={doIdentity}>{t.identity.btn}</button>
          {working("identity")}{txFor("identity")}
        </div>
        {errorFor("identity")}
      </>
    ),
    fund: (<><p className="mt-3 text-[15px] leading-relaxed text-[#0a0a0a]/65 max-w-[56ch]">{t.fund.body}</p>{fundForm}</>),
    limits: (
      <>
        <p className="mt-3 text-[15px] leading-relaxed text-[#0a0a0a]/65 max-w-[56ch]">{t.limits.body}</p>
        <div className="mt-7 grid md:grid-cols-3 gap-5">
          <Field label={t.limits.perTx} error={formErrors.perTx && t.fieldErr[formErrors.perTx]}>
            <input className={input} inputMode="decimal" placeholder="50" value={form.perTx} onChange={(e) => setForm({ ...form, perTx: e.target.value })} />
          </Field>
          <Field label={t.limits.window} error={formErrors.window && t.fieldErr[formErrors.window]}>
            <input className={input} inputMode="decimal" placeholder="200" value={form.window} onChange={(e) => setForm({ ...form, window: e.target.value })} />
          </Field>
          <Field label={t.limits.period} error={formErrors.windowSeconds && t.fieldErr[formErrors.windowSeconds]}>
            <select className={input} value={form.windowSeconds} onChange={(e) => setForm({ ...form, windowSeconds: Number(e.target.value) })}>
              {PERIODS.map((p) => <option key={p} value={p}>{t.limits.periods[p]}</option>)}
            </select>
          </Field>
        </div>
        <div className="mt-5">
          <Field label={t.limits.recipients} help={t.limits.recipientsHelp} error={formErrors.recipients && t.fieldErr[formErrors.recipients]}>
            <textarea className={`${input} font-mono text-[13px] min-h-[96px]`} spellCheck={false} placeholder="0x…" value={form.recipients} onChange={(e) => setForm({ ...form, recipients: e.target.value })} />
          </Field>
        </div>
        <div className="mt-5 grid md:grid-cols-2 gap-5">
          <Field label={t.limits.expires} error={formErrors.expiresOn && t.fieldErr[formErrors.expiresOn]}>
            <div className="flex items-center gap-4">
              <input type="date" className={`${input} max-w-[200px]`} disabled={noExpiry} value={form.expiresOn} onChange={(e) => setForm({ ...form, expiresOn: e.target.value })} />
              <span className="inline-flex items-center gap-2 text-[14px] text-[#0a0a0a]/70">
                <input type="checkbox" checked={noExpiry} onChange={(e) => setNoExpiry(e.target.checked)} />{t.limits.never}
              </span>
            </div>
          </Field>
          <Field label={t.limits.pq} help={t.limits.pqHelp} error={formErrors.pqAbove && t.fieldErr[formErrors.pqAbove]}>
            <input className={input} inputMode="decimal" placeholder="—" value={form.pqAbove} onChange={(e) => setForm({ ...form, pqAbove: e.target.value })} />
          </Field>
        </div>
        <p className="mt-6 text-[13px] text-[#0a0a0a]/55">{t.limits.keyNote}</p>
        <div className="mt-4 flex flex-wrap items-center gap-6">
          <button className={btn} disabled={locked} onClick={doInstall}>{t.limits.btn}</button>
          {working("limits")}{txFor("limits")}
        </div>
        {errorFor("limits")}
      </>
    ),
    config: keysHere && view.vault ? (() => {
      const text = mcpConfig({ vault: view.vault, agentKey: keysHere.agentKey, slhSecret: keysHere.slhSecret, network });
      return (
        <>
          <p className="mt-4 text-2xl md:text-3xl font-black uppercase tracking-[-0.03em] text-[#002FA7]">{t.config.saveNow}</p>
          <p className="mt-3 text-[15px] leading-relaxed text-[#0a0a0a]/70 max-w-[60ch]">{t.config.body}</p>
          <p className="mt-2 text-[14px] leading-relaxed text-[#0a0a0a]/55 max-w-[60ch]">{t.config.where}</p>
          <pre className="mt-6 max-h-[340px] overflow-auto rounded-2xl bg-[#0a0a0a] text-[#f1eee7] p-5 font-mono text-[12px] leading-relaxed select-all whitespace-pre-wrap break-all">{text}</pre>
          <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-3">
            <button className={linkBtn} onClick={() => copy("cfg", text)}>{copied === "cfg" ? t.config.copied : t.config.copy}</button>
            <button className={linkBtn} onClick={() => download(text)}>{t.config.download}</button>
          </div>
          <label className="mt-7 flex items-center gap-3 text-[15px]">
            <input type="checkbox" checked={savedConfirm} onChange={(e) => setSavedConfirm(e.target.checked)} />{t.config.confirm}
          </label>
          <div className="mt-5"><button className={btn} disabled={!savedConfirm} onClick={doConfigDone}>{t.config.next}</button></div>
        </>
      );
    })() : (
      <>
        <p className="mt-4 text-lg font-semibold">{t.config.lostTitle}</p>
        <p className="mt-2 text-[15px] leading-relaxed text-[#0a0a0a]/65 max-w-[60ch]">{t.config.lostBody}</p>
        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
          <button className={btn} disabled={locked} onClick={() => patchFlow({ configSaved: true })}>{t.config.saved}</button>
          <button className={linkBtn} disabled={locked || !flow?.agentSigner} onClick={doRevoke}>{t.config.revoke}</button>
          {working("config")}{txFor("config")}
        </div>
        {errorFor("config")}
      </>
    ),
    activate: view.vault ? (
      <>
        <p className="mt-3 text-[15px] leading-relaxed text-[#0a0a0a]/65 max-w-[56ch]">{t.activate.body}</p>
        <div className="mt-6 rounded-2xl border border-[#002FA7]/25 bg-[#002FA7]/[0.04] px-5 py-4 font-mono text-[13px] md:text-[15px] break-all text-[#002FA7]">{view.vault}</div>
        <p className="mt-3 text-[13px] text-[#0a0a0a]/55">{t.activate.never}</p>
        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
          <a className={btn} href={`mailto:${CONTACT}?subject=${encodeURIComponent(t.activate.subject(network))}&body=${encodeURIComponent(`network: ${network}\nvault: ${view.vault}\n`)}`}>{t.activate.email}</a>
          <button className={linkBtn} onClick={() => copy("vault", view.vault!)}>{copied === "vault" ? t.activate.copied : t.activate.copy}</button>
        </div>
      </>
    ) : null,
  };

  const currentIndex = STEPS.indexOf(step);

  return (
    <div className="min-h-screen bg-white text-[#0a0a0a] overflow-x-hidden" style={display}>
      <style>{`::selection{background:#002FA7;color:#ffffff}`}</style>

      <header className="sticky top-0 z-40 px-6 md:px-12 py-4 flex items-center justify-between backdrop-blur-md bg-white/85 border-b border-[#0a0a0a]/8">
        <Link to="/" className="text-2xl md:text-3xl lowercase" style={{ ...display, fontWeight: 800, letterSpacing: "-0.04em" }}>slippay<span className="text-[#002FA7]">.</span></Link>
        <nav className="flex items-center gap-5 text-[10px] uppercase tracking-[0.2em] text-[#0a0a0a]/55">
          <Link to="/agents" className="hover:opacity-70">{t.back}</Link>
          <button onClick={() => setLang(lang === "pt" ? "en" : "pt")} className="font-mono hover:opacity-70" aria-label="toggle language">{lang === "pt" ? "EN" : "PT"}</button>
        </nav>
      </header>

      <section className="max-w-[900px] mx-auto px-6 md:px-12 pt-16 md:pt-24 pb-10">
        <span className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.24em] text-[#0a0a0a]/55">
          <span className="w-1.5 h-1.5 rounded-full animate-pulse bg-[#002FA7]" />{t.eyebrow} · arc {network}
        </span>
        <h1 className="mt-6 font-black uppercase tracking-[-0.04em] leading-[0.9] text-[clamp(2.4rem,7vw,4.75rem)] max-w-[14ch]" style={display}>{t.h1}</h1>
        <p className="mt-6 text-lg text-[#0a0a0a]/70 max-w-[54ch] leading-relaxed">{t.sub}</p>
        <div className={`mt-8 rounded-2xl px-5 py-4 text-[14px] leading-relaxed ${network === "mainnet" ? "bg-[#0a0a0a] text-[#f1eee7]" : "bg-[#002FA7]/[0.05] text-[#0a0a0a]/75"}`}>
          {network === "mainnet" ? t.net.mainnet : <>{t.net.testnet} {t.net.faucet}</>}{" "}
          <Link to={network === "mainnet" ? "/agents/new" : "/agents/new?network=mainnet"} className="underline underline-offset-4 hover:opacity-70">
            {network === "mainnet" ? t.net.toTestnet : t.net.toMainnet}
          </Link>
        </div>
        {(view.pendingTx || view.deployPending) && busy === null && (
          <div className="mt-4 rounded-2xl border border-[#002FA7]/25 px-5 py-4 text-[14px] text-[#002FA7]">{t.waiting}</div>
        )}
        {err?.code === "read" && errorFor("connect")}
      </section>

      <section className="max-w-[900px] mx-auto px-6 md:px-12 pb-28">
        <ol className="border-t border-[#0a0a0a]/12">
          {STEPS.map((s, i) => {
            const state = i < currentIndex ? "done" : i === currentIndex ? "now" : "later";
            const title = t[s].title;
            return (
              <li key={s} className="border-b border-[#0a0a0a]/12 py-7 md:py-9" aria-current={state === "now" ? "step" : undefined}>
                <div className="flex items-start justify-between gap-6">
                  <div className={state === "later" ? "opacity-35" : ""}>
                    <Stamp n={String(i + 1).padStart(2, "0")} label={t.status[state]} />
                    <h2 className="mt-3 text-2xl md:text-3xl font-bold tracking-[-0.02em]" style={display}>{title}</h2>
                    {state === "done" && summary[s] && <div className="mt-2 text-[14px] text-[#0a0a0a]/60">{summary[s]}</div>}
                  </div>
                  {state === "done" && <span className="mt-1 text-[#002FA7] text-xl" aria-hidden>✓</span>}
                </div>
                {state === "now" && bodies[s]}
                {s === "fund" && state === "done" && fundOpen && fundForm}
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
