import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { fetchOrder, type PublicOrder } from "../lib/api.ts";
import { Countdown } from "../components/Countdown.tsx";
import { PayButton } from "../components/PayButton.tsx";
import { buildAtomicTx, fetchSequence, submitSignedTx } from "../lib/stellar.ts";
import { signTx } from "../lib/wallet.ts";

type SubmitState = "idle" | "building" | "signing" | "submitting" | "submitted" | "paid" | "error";

export default function Checkout() {
  const { order_id } = useParams<{ order_id: string }>();
  const [order, setOrder] = useState<PublicOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [txHash, setTxHash] = useState<string | null>(null);

  useEffect(() => {
    if (!order_id) return;
    fetchOrder(order_id).then(setOrder).catch(e => setError(e.message));
  }, [order_id]);

  useEffect(() => {
    if (submitState !== "submitted" || !order_id) return;
    const id = setInterval(async () => {
      try {
        const fresh = await fetchOrder(order_id);
        setOrder(fresh);
        if (fresh.status === "paid") {
          clearInterval(id);
          setSubmitState("paid");
        }
      } catch {}
    }, 2000);
    return () => clearInterval(id);
  }, [submitState, order_id]);

  if (error) return <div className="p-8 text-red-400">{error}</div>;
  if (!order) return <div className="p-8 text-zinc-400">loading...</div>;

  return (
    <main className="max-w-md mx-auto p-8">
      <h1 className="text-2xl font-semibold">pay with crypto</h1>
      <div className="mt-8 rounded-lg bg-zinc-900 p-6">
        <div className="text-sm text-zinc-500">amount due</div>
        <div className="text-3xl font-semibold mt-1">R$ {Number(order.brl_amount).toFixed(2)}</div>
        <div className="text-zinc-500 mt-2 tabular-nums">{order.usdc_amount} USDC</div>
        <div className="mt-6 text-sm text-zinc-500">
          expires in <Countdown expiresAt={order.expires_at} />
        </div>
      </div>

      {!walletAddress
        ? <PayButton onConnected={setWalletAddress} />
        : (
          <div className="mt-6">
            <div className="text-xs text-zinc-500 mb-2">connected: {walletAddress.slice(0,8)}...{walletAddress.slice(-4)}</div>
            <button
              disabled={submitState !== "idle" && submitState !== "error"}
              onClick={async () => {
                setError(null);
                setSubmitState("building");
                try {
                  if (!order.merchant_stellar_address) throw new Error("merchant has no stellar_address");
                  const platformAddress = import.meta.env.VITE_PLATFORM_ADDRESS;
                  if (!platformAddress) throw new Error("VITE_PLATFORM_ADDRESS not configured");
                  const network = (import.meta.env.VITE_STELLAR_NETWORK ?? "TESTNET").toUpperCase() as "TESTNET" | "PUBLIC";
                  const seq = await fetchSequence(network, walletAddress);
                  const xdr = await buildAtomicTx({
                    buyerPublicKey: walletAddress,
                    buyerSequence: seq,
                    merchantAddress: order.merchant_stellar_address,
                    platformAddress,
                    usdcAmount: order.usdc_amount,
                    platformFeeBp: 100,
                    memo: order.memo,
                    network,
                    maxTime: Math.floor(new Date(order.expires_at).getTime() / 1000),
                  });
                  setSubmitState("signing");
                  const signed = await signTx(xdr);
                  setSubmitState("submitting");
                  const { hash } = await submitSignedTx(network, signed);
                  setTxHash(hash);
                  setSubmitState("submitted");
                } catch (e: unknown) {
                  setSubmitState("error");
                  setError(e instanceof Error ? e.message : "unknown error");
                }
              }}
              className="w-full rounded-lg bg-emerald-500 hover:bg-emerald-400 text-black py-3 font-semibold disabled:opacity-50"
            >
              {submitState === "idle" || submitState === "error" ? `pay ${order.usdc_amount} USDC` :
               submitState === "building" ? "preparing..." :
               submitState === "signing" ? "waiting for wallet..." :
               submitState === "submitting" ? "submitting..." :
               submitState === "submitted" ? "awaiting confirmation..." :
               "paid"}
            </button>
            {(submitState === "submitted" || submitState === "paid") && txHash && (
              <div className="mt-4 rounded-lg bg-emerald-900/30 border border-emerald-700 p-3 text-sm">
                <div className="text-emerald-300 font-semibold">tx submitted, awaiting confirmation</div>
                <a className="text-xs text-emerald-200/70 hover:underline mt-1 block break-all"
                   href={`https://stellar.expert/explorer/testnet/tx/${txHash}`} target="_blank" rel="noreferrer">
                  {txHash}
                </a>
              </div>
            )}
            {submitState === "paid" && (
              <div className="mt-6 rounded-lg bg-emerald-900/30 border border-emerald-700 p-4">
                <div className="text-emerald-300 font-semibold">payment confirmed</div>
                {txHash && (
                  <a className="text-xs text-emerald-200/70 hover:underline mt-1 block break-all"
                     href={`https://stellar.expert/explorer/testnet/tx/${txHash}`} target="_blank" rel="noreferrer">
                    {txHash}
                  </a>
                )}
              </div>
            )}
          </div>
        )}
    </main>
  );
}
