// Stellar adapter — wraps the existing lib/{wallet,stellar,soroban} with ZERO
// behavior change. The classic checkout (buildAtomicTx + Horizon submit) and the
// recurring allowance (Soroban approve) are exactly what shipped on mainnet; this
// only re-exposes them behind ChainAdapter so pages stop importing chain SDKs.

import { connectWallet as stellarConnect, signTx } from "../../wallet.ts";
import {
  fetchSequence, submitSignedTx, buildAtomicTx,
  isValidStellarAddress, checkReceiveAddress,
} from "../../stellar.ts";
import { approveAllowance } from "../../soroban.ts";
import type {
  ChainAdapter, AddressCheck, OneTimePayArgs, ApproveArgs, PayResult,
} from "../types.ts";

function network(): "TESTNET" | "PUBLIC" {
  return ((import.meta.env.VITE_STELLAR_NETWORK ?? "TESTNET").toUpperCase()) as "TESTNET" | "PUBLIC";
}

export const stellarAdapter: ChainAdapter = {
  id: "stellar",

  connectWallet: () => stellarConnect(),

  isValidAddress: (addr) => isValidStellarAddress(addr),

  checkReceiveAddress: (addr): Promise<AddressCheck> => checkReceiveAddress(network(), addr),

  async payOneTime(a: OneTimePayArgs): Promise<PayResult> {
    const net = network();
    const seq = await fetchSequence(net, a.buyerAddress);
    const xdr = await buildAtomicTx({
      buyerPublicKey: a.buyerAddress,
      buyerSequence: seq,
      merchantAddress: a.merchantAddress,
      platformAddress: a.platformAddress,
      usdcAmount: a.usdcAmount,
      platformFeeBp: a.platformFeeBp,
      memo: a.memoHex,
      network: net,
      maxTime: a.maxTime,
    });
    const signed = await signTx(xdr);
    return submitSignedTx(net, signed);
  },

  async approveRecurring(a: ApproveArgs): Promise<PayResult> {
    if (!a.rpcUrl) throw new Error("stellar approveRecurring requires rpcUrl");
    if (a.expirationLedger == null) throw new Error("stellar approveRecurring requires expirationLedger");
    const hash = await approveAllowance({
      sacAddress: a.tokenAddress,
      owner: a.owner,
      spender: a.spender,
      amount: a.amount,
      expirationLedger: a.expirationLedger,
      rpcUrl: a.rpcUrl,
    });
    return { hash };
  },
};
