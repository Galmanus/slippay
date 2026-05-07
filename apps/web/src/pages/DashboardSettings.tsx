import { useEffect, useState } from "react";
import { useOutletContext } from "react-router-dom";
import { authFetch } from "../lib/apiAuth.ts";

interface MerchantFull {
  id: string;
  display_name: string;
  email: string;
  stellar_address: string | null;
  network: string;
  api_key_prefix: string;
  webhook_url: string | null;
  platform_fee_bp: number;
}

export default function DashboardSettings() {
  const ctx = useOutletContext<MerchantFull | null>();
  const [merchant, setMerchant] = useState<MerchantFull | null>(ctx);
  const [stellarAddress, setStellarAddress] = useState(ctx?.stellar_address ?? "");
  const [webhookUrl, setWebhookUrl] = useState(ctx?.webhook_url ?? "");
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    // reveal key from sessionStorage if just created
    const k = sessionStorage.getItem("slippay.fresh_api_key");
    if (k) { setRevealedKey(k); sessionStorage.removeItem("slippay.fresh_api_key"); }
  }, []);

  useEffect(() => {
    if (!ctx) {
      authFetch("/v1/merchants/me").then(async r => {
        if (r.ok) {
          const j = await r.json();
          setMerchant(j.merchant);
          setStellarAddress(j.merchant.stellar_address ?? "");
          setWebhookUrl(j.merchant.webhook_url ?? "");
        }
      });
    }
  }, [ctx]);

  if (!merchant) return <div className="text-zinc-400">loading...</div>;

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-semibold mb-6">settings</h1>

      {revealedKey && (
        <div className="mb-6 p-4 rounded bg-emerald-900/20 border border-emerald-700">
          <div className="text-emerald-300 font-semibold text-sm">your API key — copy it now, won't be shown again</div>
          <code className="block mt-2 break-all text-xs text-emerald-100">{revealedKey}</code>
          <button onClick={() => navigator.clipboard.writeText(revealedKey)}
            className="mt-2 text-xs text-emerald-300 hover:underline">copy</button>
        </div>
      )}

      <form onSubmit={async (e) => {
        e.preventDefault(); setErr(null); setSaved(false);
        const body: Record<string, string> = {};
        if (stellarAddress !== (merchant.stellar_address ?? "")) body.stellar_address = stellarAddress;
        if (webhookUrl !== (merchant.webhook_url ?? "")) body.webhook_url = webhookUrl;
        if (Object.keys(body).length === 0) { setSaved(true); return; }
        const r = await authFetch("/v1/merchants/me", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
        if (r.ok) {
          const j = await r.json();
          setMerchant(j.merchant);
          setSaved(true);
        } else {
          const j = await r.json();
          setErr(j.detail || j.error || "save failed");
        }
      }} className="space-y-4">

        <div>
          <label className="text-xs text-zinc-500 block mb-1">display name</label>
          <input value={merchant.display_name} disabled
            className="w-full bg-zinc-900 rounded px-3 py-2 opacity-60" />
        </div>

        <div>
          <label className="text-xs text-zinc-500 block mb-1">email</label>
          <input value={merchant.email} disabled
            className="w-full bg-zinc-900 rounded px-3 py-2 opacity-60" />
        </div>

        <div>
          <label className="text-xs text-zinc-500 block mb-1">network</label>
          <input value={merchant.network} disabled
            className="w-full bg-zinc-900 rounded px-3 py-2 opacity-60" />
        </div>

        <div>
          <label className="text-xs text-zinc-500 block mb-1">stellar receive address</label>
          <input value={stellarAddress} onChange={e => setStellarAddress(e.target.value)}
            placeholder="GABC...XYZ"
            className="w-full bg-zinc-900 rounded px-3 py-2 font-mono text-sm" />
          <div className="text-xs text-zinc-600 mt-1">USDC payments land here. must have USDC trustline.</div>
        </div>

        <div>
          <label className="text-xs text-zinc-500 block mb-1">webhook URL</label>
          <input value={webhookUrl} onChange={e => setWebhookUrl(e.target.value)}
            placeholder="https://yourshop.com/webhooks/slippay"
            className="w-full bg-zinc-900 rounded px-3 py-2" />
          <div className="text-xs text-zinc-600 mt-1">https only on mainnet. signed with x-slippay-signature header.</div>
        </div>

        <div>
          <label className="text-xs text-zinc-500 block mb-1">API key (prefix)</label>
          <div className="flex items-center gap-3">
            <input value={`${merchant.api_key_prefix}...`} disabled
              className="flex-1 bg-zinc-900 rounded px-3 py-2 font-mono text-sm opacity-60" />
            <button type="button"
              onClick={async () => {
                if (!confirm("rotate API key? old key stops working immediately.")) return;
                const r = await authFetch("/v1/merchants/me/rotate-key", { method: "POST" });
                if (r.ok) {
                  const j = await r.json();
                  setRevealedKey(j.api_key);
                  // refresh merchant prefix
                  const m = await authFetch("/v1/merchants/me");
                  if (m.ok) {
                    const mj = await m.json();
                    setMerchant(mj.merchant);
                  }
                }
              }}
              className="text-xs text-amber-300 hover:underline">rotate</button>
          </div>
        </div>

        <div className="pt-2">
          <button className="bg-emerald-500 text-black px-4 py-2 rounded font-semibold">save</button>
          {saved && <span className="ml-3 text-sm text-emerald-400">saved</span>}
          {err && <span className="ml-3 text-sm text-red-400">{err}</span>}
        </div>
      </form>
    </div>
  );
}
