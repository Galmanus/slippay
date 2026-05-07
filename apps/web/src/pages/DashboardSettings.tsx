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

  if (!merchant) {
    return <div className="text-xs uppercase tracking-[0.18em] text-[#0a0a0a]/55">Loading...</div>;
  }

  return (
    <div className="max-w-3xl">
      <div className="text-xs uppercase tracking-[0.18em] text-[#0a0a0a]/55 mb-3">001. Settings</div>
      <h1 className="text-5xl md:text-7xl font-medium tracking-[-0.04em] leading-[0.95] mb-16">
        Configuration.
      </h1>

      {revealedKey && (
        <div className="mb-12 border-2 border-[#b5e853] bg-[#b5e853]/10 p-6">
          <div className="flex items-center gap-3">
            <span className="inline-block w-3 h-3 bg-[#b5e853]" />
            <div className="text-xs uppercase tracking-[0.18em]">Your API key</div>
          </div>
          <p className="text-sm text-[#0a0a0a]/70 mt-2">
            Copy it now. It will not be shown again — only the prefix is stored.
          </p>
          <code className="block mt-4 p-4 bg-[#0a0a0a] text-[#f1eee7] text-xs font-mono break-all">
            {revealedKey}
          </code>
          <button onClick={() => navigator.clipboard.writeText(revealedKey)}
            className="mt-3 text-xs uppercase tracking-[0.18em] hover:opacity-60">
            Copy ↗
          </button>
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
      }} className="space-y-12">

        <Section title="Identity" eyebrow="002">
          <ReadOnly label="Display name" value={merchant.display_name} />
          <ReadOnly label="Email" value={merchant.email} />
          <ReadOnly label="Network" value={merchant.network} />
        </Section>

        <Section title="On-chain" eyebrow="003">
          <Editable label="Stellar receive address" value={stellarAddress} onChange={setStellarAddress}
            placeholder="GABC..." mono
            hint="USDC payments land here. Must have USDC trustline." />
        </Section>

        <Section title="Webhook" eyebrow="004">
          <Editable label="Endpoint URL" value={webhookUrl} onChange={setWebhookUrl}
            placeholder="https://yourshop.com/webhooks/slippay"
            hint="HTTPS only on mainnet. Signed with x-slippay-signature header (HMAC-SHA256)." />
        </Section>

        <Section title="API key" eyebrow="005">
          <div>
            <span className="text-[10px] uppercase tracking-[0.18em] text-[#0a0a0a]/55 block mb-2">Current key</span>
            <div className="flex items-center gap-4">
              <code className="flex-1 font-mono text-sm py-3 border-b border-[#0a0a0a]/30">{merchant.api_key_prefix}...</code>
              <button type="button"
                onClick={async () => {
                  if (!confirm("Rotate API key? Old key stops working immediately.")) return;
                  const r = await authFetch("/v1/merchants/me/rotate-key", { method: "POST" });
                  if (r.ok) {
                    const j = await r.json();
                    setRevealedKey(j.api_key);
                    const m = await authFetch("/v1/merchants/me");
                    if (m.ok) {
                      const mj = await m.json();
                      setMerchant(mj.merchant);
                    }
                  }
                }}
                className="text-[10px] uppercase tracking-[0.18em] border border-[#0a0a0a]/30 px-4 py-2 hover:bg-[#0a0a0a] hover:text-[#f1eee7]">
                Rotate
              </button>
            </div>
          </div>
        </Section>

        <div className="pt-8 flex items-center gap-6">
          <button className="bg-[#0a0a0a] text-[#f1eee7] px-10 py-4 text-sm uppercase tracking-[0.18em] hover:bg-[#1a1a1a]">
            Save changes
          </button>
          {saved && <span className="text-xs uppercase tracking-[0.18em] text-[#0a0a0a]/70 flex items-center gap-2">
            <span className="inline-block w-1.5 h-1.5 bg-[#b5e853]" /> Saved
          </span>}
          {err && <span className="text-xs uppercase tracking-[0.18em] text-red-700">{err}</span>}
        </div>
      </form>
    </div>
  );
}

function Section({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <div className="grid md:grid-cols-12 gap-6 md:gap-12 border-t border-[#0a0a0a]/10 pt-8">
      <div className="md:col-span-3">
        <div className="text-xs uppercase tracking-[0.18em] text-[#0a0a0a]/55">{eyebrow}. {title}</div>
      </div>
      <div className="md:col-span-9 space-y-6">{children}</div>
    </div>
  );
}

function ReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-[10px] uppercase tracking-[0.18em] text-[#0a0a0a]/55 block mb-2">{label}</span>
      <div className="text-base py-3 border-b border-[#0a0a0a]/10 text-[#0a0a0a]/70">{value}</div>
    </div>
  );
}

function Editable({ label, value, onChange, placeholder, hint, mono }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; hint?: string; mono?: boolean;
}) {
  return (
    <div>
      <span className="text-[10px] uppercase tracking-[0.18em] text-[#0a0a0a]/55 block mb-2">{label}</span>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className={`w-full bg-transparent border-b border-[#0a0a0a]/30 py-3 ${mono ? "font-mono text-sm" : "text-base"} tracking-tight focus:outline-none focus:border-[#0a0a0a] transition-colors`} />
      {hint && <p className="text-xs text-[#0a0a0a]/55 mt-2">{hint}</p>}
    </div>
  );
}
