// Bridges LazorKit's React hook into the chain adapter's plain executor.
//
// LazorKit (passkey smart wallet, secp256r1 verified on-chain) is a React-hook
// SDK. This mounts its provider (kept alive at app root so the executor closure
// stays valid across navigation) and binds the connected wallet into the adapter
// via bindSolanaWallet, so lib/chain/solana stays React-free.
//
// Lazy-loaded only when VITE_CHAIN=solana (see ChainProvider) — the @lazorkit deps
// never enter the default Stellar bundle.

import { type ReactNode, useEffect } from "react";
import { LazorkitProvider, useWallet } from "@lazorkit/wallet";
import { rpcUrl } from "../../lib/chain/solana/usdc.ts";
import { bindSolanaWallet } from "../../lib/chain/solana/wallet.ts";

function Binder() {
  const w = useWallet();
  const addr = w.smartWalletPubkey?.toBase58() ?? null;
  useEffect(() => {
    if (w.isConnected && w.smartWalletPubkey) {
      bindSolanaWallet({
        address: w.smartWalletPubkey.toBase58(),
        execute: async (ixs) => {
          // LazorKit's hook executes ONE CPI per call. Single-instruction flows
          // (the recurring SPL approve) work today. Multi-instruction atomic
          // payments (payOneTime's merchant+fee split) need a program-side split
          // instruction (1 CPI) or the chunk path — tracked, not faked.
          if (ixs.length !== 1) {
            throw new Error(
              "solana multi-instruction execute not wired yet — needs a split " +
              "instruction on the slippay program (payOneTime WIP). Single-" +
              "instruction flows (recurring authorize) work.",
            );
          }
          return w.signAndSendTransaction(ixs[0]!);
        },
      });
    } else {
      bindSolanaWallet(null);
    }
    return () => bindSolanaWallet(null);
  }, [w.isConnected, addr]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

export function SolanaWalletBridge({ children }: { children: ReactNode }) {
  return (
    <LazorkitProvider rpcUrl={rpcUrl()}>
      <Binder />
      {children}
    </LazorkitProvider>
  );
}
