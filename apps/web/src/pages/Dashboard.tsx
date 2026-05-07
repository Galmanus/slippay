import { Outlet, NavLink, Navigate, useNavigate, Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth, supabase } from "../lib/auth.tsx";
import { authFetch } from "../lib/apiAuth.ts";

interface MerchantSummary {
  id: string;
  display_name: string;
  email: string;
  api_key_prefix: string;
  network: string;
  active: boolean;
}

export default function Dashboard() {
  const { session, loading } = useAuth();
  const [merchant, setMerchant] = useState<MerchantSummary | null>(null);
  const [needsCreate, setNeedsCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const nav = useNavigate();

  useEffect(() => {
    if (!session) return;
    authFetch("/v1/merchants/me").then(async r => {
      if (r.status === 404) { setNeedsCreate(true); return; }
      const j = await r.json();
      setMerchant(j.merchant);
    });
  }, [session]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f1eee7] flex items-center justify-center">
        <div className="text-xs uppercase tracking-[0.18em] text-[#0a0a0a]/55">Loading...</div>
      </div>
    );
  }
  if (!session) return <Navigate to="/login" replace />;

  if (needsCreate) {
    return (
      <div className="min-h-screen bg-[#f1eee7] text-[#0a0a0a] flex flex-col">
        <header className="max-w-[1400px] w-full mx-auto px-8 md:px-12 py-8">
          <Link to="/" className="text-sm tracking-tight font-medium">slippay</Link>
        </header>
        <main className="flex-1 flex items-center">
          <div className="max-w-[1400px] w-full mx-auto px-8 md:px-12 grid md:grid-cols-12 gap-16 py-16">
            <div className="md:col-span-3 text-xs uppercase tracking-[0.18em] text-[#0a0a0a]/55">
              <span className="inline-block w-3 h-3 bg-[#b5e853] mr-2 align-middle" />
              001. Onboard
            </div>
            <div className="md:col-span-6">
              <h1 className="text-6xl md:text-8xl font-medium tracking-[-0.04em] leading-[0.9]">
                One name to begin.
              </h1>
              <p className="mt-8 text-xl text-[#0a0a0a]/70 max-w-[44ch]">
                We'll create your merchant record and surface your API key once.
                You can rotate it whenever from settings.
              </p>
              <form onSubmit={async (e) => {
                e.preventDefault(); setCreating(true);
                const r = await authFetch("/v1/merchants", {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ display_name: displayName }),
                });
                setCreating(false);
                if (r.ok) {
                  const j = await r.json();
                  sessionStorage.setItem("slippay.fresh_api_key", j.api_key);
                  setMerchant(j.merchant);
                  setNeedsCreate(false);
                  nav("/dashboard/settings");
                }
              }} className="mt-16 max-w-md space-y-8">
                <label className="block">
                  <span className="text-[10px] uppercase tracking-[0.18em] text-[#0a0a0a]/55 block mb-2">Business name</span>
                  <input value={displayName} onChange={e => setDisplayName(e.target.value)}
                    autoFocus required minLength={1} maxLength={120}
                    className="w-full bg-transparent border-b border-[#0a0a0a]/30 py-3 text-lg tracking-tight focus:outline-none focus:border-[#0a0a0a] transition-colors" />
                </label>
                <button disabled={creating}
                  className="w-full bg-[#0a0a0a] text-[#f1eee7] py-5 text-sm uppercase tracking-[0.18em] hover:bg-[#1a1a1a] disabled:opacity-50">
                  {creating ? "..." : "Create merchant"}
                </button>
              </form>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-[#f1eee7] text-[#0a0a0a]">
      <aside className="w-64 bg-[#0a0a0a] text-[#f1eee7] p-8 flex flex-col">
        <Link to="/" className="text-sm tracking-tight font-medium">slippay</Link>
        {merchant && (
          <div className="mt-6 mb-12">
            <div className="text-[10px] uppercase tracking-[0.18em] text-[#f1eee7]/55">Merchant</div>
            <div className="text-base mt-1 truncate">{merchant.display_name}</div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-[#f1eee7]/55 mt-3">Network</div>
            <div className="flex items-center gap-2 mt-1">
              <span className={`inline-block w-1.5 h-1.5 ${merchant.network === "mainnet" ? "bg-[#b5e853]" : "bg-amber-400"}`} />
              <span className="text-sm">{merchant.network}</span>
            </div>
          </div>
        )}
        <nav className="flex flex-col gap-1 mt-2">
          <NavLink to="/dashboard/orders"
            className={({ isActive }) => `px-3 py-2 text-sm uppercase tracking-[0.18em] text-[10px] ${isActive ? "bg-[#f1eee7]/10 text-[#f1eee7]" : "text-[#f1eee7]/55 hover:text-[#f1eee7]"}`}>
            Orders
          </NavLink>
          <NavLink to="/dashboard/settings"
            className={({ isActive }) => `px-3 py-2 text-sm uppercase tracking-[0.18em] text-[10px] ${isActive ? "bg-[#f1eee7]/10 text-[#f1eee7]" : "text-[#f1eee7]/55 hover:text-[#f1eee7]"}`}>
            Settings
          </NavLink>
        </nav>
        <button onClick={async () => { await supabase.auth.signOut(); nav("/login"); }}
          className="mt-auto text-[10px] uppercase tracking-[0.18em] text-[#f1eee7]/55 hover:text-[#f1eee7] text-left">
          Sign out
        </button>
      </aside>
      <main className="flex-1 p-8 md:p-16 overflow-auto">
        <Outlet context={merchant} />
      </main>
    </div>
  );
}
