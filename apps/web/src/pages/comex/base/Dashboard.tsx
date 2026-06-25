import { useEffect, useState } from "react";
import { useComexBaseWallet } from "../../../lib/comexBase.tsx";
import { publicClient, usdcAddress, fromBaseUnits } from "../../../lib/chain/base/usdc.ts";
import BaseBalance from "./Balance.tsx";
import BaseSend from "./Send.tsx";
import BaseExchange from "./Exchange.tsx";

type Tab = "Saldo" | "Enviar" | "Câmbio" | "Render";
const TABS: Tab[] = ["Saldo", "Enviar", "Câmbio", "Render"];

const ERC20_BALANCE_OF_ABI = [
  { name: "balanceOf", type: "function", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ name: "", type: "uint256" }] },
] as const;

export default function ComexBaseDashboard() {
  const { email, address, logout } = useComexBaseWallet();
  const [activeTab, setActiveTab] = useState<Tab>("Saldo");
  const [stripBalance, setStripBalance] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Always-on balance in the strip — refreshes on tab change so it reflects a
  // buy/receive/send without leaving the page.
  useEffect(() => {
    if (!address) return;
    let on = true;
    publicClient.readContract({ address: usdcAddress(), abi: ERC20_BALANCE_OF_ABI, functionName: "balanceOf", args: [address] })
      .then((raw) => { if (on) setStripBalance(fromBaseUnits(raw as bigint)); })
      .catch(() => { /* leave last */ });
    return () => { on = false; };
  }, [address, activeTab]);

  const copyAddr = () => {
    if (!address) return;
    navigator.clipboard?.writeText(address).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => {});
  };

  return (
    <div className="min-h-screen bg-[#f1eee7] text-[#0a0a0a] flex flex-col">
      {/* Account strip */}
      <div className="border-b border-[#0a0a0a]/10">
        <div className="max-w-[1400px] mx-auto px-8 md:px-12 py-4 flex items-center gap-3 sm:gap-6">
          <div className="hidden sm:block text-[10px] uppercase tracking-[0.18em] text-[#0a0a0a]/55 shrink-0">
            Conta da empresa
          </div>
          {email && (
            <div className="text-[10px] text-[#0a0a0a]/70 truncate max-w-[34vw] sm:max-w-none">{email}</div>
          )}
          {address && (
            <button
              onClick={copyAddr}
              title="Copiar endereço"
              className="font-mono text-[10px] text-[#0a0a0a]/45 hover:text-[#0a0a0a]/80 shrink-0 transition-colors"
            >
              <span className="text-[#0a0a0a]/35">carteira </span>{address.slice(0, 6)}…{address.slice(-4)}{copied ? " ✓" : ""}
            </button>
          )}
          {stripBalance !== null && (
            <div className="ml-auto text-[11px] tabular-nums text-[#0a0a0a] shrink-0">
              $ {Number(stripBalance).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              <span className="text-[#0a0a0a]/40"> USDC</span>
            </div>
          )}
          <button
            onClick={logout}
            className={[
              "shrink-0 text-[10px] uppercase tracking-[0.18em] text-[#0a0a0a]/45 hover:text-[#0a0a0a] border border-[#0a0a0a]/20 hover:border-[#0a0a0a]/50 px-3 py-2 transition-colors",
              stripBalance !== null ? "" : "ml-auto",
            ].join(" ")}
          >
            Sair
          </button>
        </div>
      </div>

      {/* Tab nav */}
      <nav className="border-b border-[#0a0a0a]/10">
        <div className="max-w-[1400px] mx-auto px-8 md:px-12 flex gap-0 overflow-x-auto flex-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={[
                "shrink-0 py-5 px-5 text-[10px] uppercase tracking-[0.18em] border-b-2 transition-colors",
                activeTab === tab
                  ? "border-[#FDDA24] text-[#0a0a0a]"
                  : "border-transparent text-[#0a0a0a]/45 hover:text-[#0a0a0a]/70",
              ].join(" ")}
            >
              {tab}
            </button>
          ))}
        </div>
      </nav>

      {/* Panel */}
      <main className="flex-1 flex items-start">
        <div className="max-w-[1400px] w-full mx-auto px-8 md:px-12 py-16 grid md:grid-cols-12 gap-8 md:gap-16">
          <div className="md:col-span-3 text-xs uppercase tracking-[0.18em] text-[#0a0a0a]/55">
            <span className="inline-block w-3 h-3 bg-[#FDDA24] mr-2 align-middle" />
            {activeTab === "Saldo" && "001. Saldo"}
            {activeTab === "Enviar" && "002. Enviar"}
            {activeTab === "Câmbio" && "003. Câmbio"}
            {activeTab === "Render" && "004. Render"}
          </div>

          {activeTab === "Saldo" && <BaseBalance onNavigate={setActiveTab} />}
          {activeTab === "Enviar" && <BaseSend />}
          {activeTab === "Câmbio" && <BaseExchange />}
          {activeTab === "Render" && (
            <div className="md:col-span-9 max-w-xl">
              <div className="text-xs uppercase tracking-[0.18em] text-[#0a0a0a]/55 mb-8 block">
                Rendimento
              </div>
              <p className="text-sm text-[#0a0a0a]/55">
                Rendimento — fase 2
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
