import { Outlet, NavLink, Navigate, useNavigate } from "react-router-dom";
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

  if (loading) return <div className="p-8 text-zinc-400">loading...</div>;
  if (!session) return <Navigate to="/login" replace />;

  if (needsCreate) {
    return (
      <main className="max-w-md mx-auto p-8">
        <h1 className="text-2xl font-semibold mb-6">welcome to slippay</h1>
        <p className="text-zinc-400 mb-4 text-sm">create your merchant account to get started.</p>
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
            // surface api key once via sessionStorage so settings can show it on next nav
            sessionStorage.setItem("slippay.fresh_api_key", j.api_key);
            setMerchant(j.merchant);
            setNeedsCreate(false);
            nav("/dashboard/settings");
          }
        }} className="space-y-3">
          <input value={displayName} onChange={e => setDisplayName(e.target.value)}
            placeholder="business name" required minLength={1} maxLength={120}
            className="w-full bg-zinc-900 rounded px-3 py-2" />
          <button disabled={creating}
            className="w-full bg-emerald-500 disabled:opacity-50 text-black py-2 rounded font-semibold">
            {creating ? "..." : "create merchant"}
          </button>
        </form>
      </main>
    );
  }

  return (
    <div className="min-h-screen flex">
      <aside className="w-56 bg-zinc-900 p-6 flex flex-col">
        <div className="font-semibold text-lg">slippay</div>
        {merchant && (
          <div className="text-xs text-zinc-500 mt-1 mb-6">
            {merchant.display_name}
            <div className="text-zinc-600 mt-1">{merchant.network}</div>
          </div>
        )}
        <nav className="flex flex-col gap-1 mt-2">
          <NavLink to="/dashboard/orders"
            className={({ isActive }) => `px-3 py-2 rounded text-sm ${isActive ? "bg-zinc-800 text-zinc-100" : "text-zinc-400 hover:bg-zinc-800/50"}`}>
            orders
          </NavLink>
          <NavLink to="/dashboard/settings"
            className={({ isActive }) => `px-3 py-2 rounded text-sm ${isActive ? "bg-zinc-800 text-zinc-100" : "text-zinc-400 hover:bg-zinc-800/50"}`}>
            settings
          </NavLink>
        </nav>
        <button onClick={async () => { await supabase.auth.signOut(); nav("/login"); }}
          className="mt-auto text-xs text-zinc-500 hover:text-zinc-300 text-left">
          sign out
        </button>
      </aside>
      <main className="flex-1 p-8 overflow-auto">
        <Outlet context={merchant} />
      </main>
    </div>
  );
}
