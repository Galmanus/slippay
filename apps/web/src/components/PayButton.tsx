import { useState } from "react";
import { connectWallet } from "../lib/wallet.ts";

export function PayButton({ onConnected }: { onConnected: (addr: string) => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="mt-6">
      <button
        disabled={loading}
        onClick={async () => {
          setLoading(true);
          setError(null);
          try {
            const addr = await connectWallet();
            onConnected(addr);
          } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "wallet error");
          } finally {
            setLoading(false);
          }
        }}
        className="w-full rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black py-3 font-semibold disabled:opacity-50"
      >
        {loading ? "connecting..." : "connect wallet"}
      </button>
      {error && <div className="mt-2 text-sm text-red-400">{error}</div>}
    </div>
  );
}
