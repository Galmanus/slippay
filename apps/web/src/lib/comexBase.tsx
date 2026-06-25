// VERIFY-WITH-KEYS: Privy EVM API used (from @privy-io/react-auth@3.32.2 installed types):
//
// Wallet creation (auto, via config):
//   embeddedWallets.ethereum.createOnLogin: "users-without-wallets"
//   — Privy creates an EVM embedded wallet automatically on login (no manual createWallet call).
//
// Wallet lookup:
//   const { wallets } = useWallets();  // ConnectedWallet[] (types-sr2FRXdy.d.ts line 1325)
//   wallets filtered by wallet.type === "ethereum" && wallet.walletClientType === "privy"
//   wallet.address → 0x-prefixed EVM address
//
// Send transaction (EIP-1193 EVM embedded wallet):
//   import { useSendTransaction } from "@privy-io/react-auth/tempo";
//   const { sendTransaction } = useSendTransaction();
//   await sendTransaction({ transaction: { to, data, value, chainId }, wallet })
//   → Promise<{ hash: Hex }>  (tempo.d.ts line 14)
//
// usePrivy(): { ready, authenticated, user, login, logout }  (index.d.ts line 1338)

import {
  createContext,
  useCallback,
  useContext,
  type ReactNode,
} from "react";
import {
  PrivyProvider,
  usePrivy,
  useWallets,
  useSendTransaction,
  type ConnectedWallet,
  type PrivyClientConfig,
} from "@privy-io/react-auth";
import { base, baseSepolia } from "viem/chains";
import { baseNet } from "./chain/base/usdc.ts";

// ---------------------------------------------------------------------------
// Provider config — corporate: email + MFA only, NO solana, NO biometric.
// EVM embedded wallet auto-created for users without one.
// defaultChain restricted to Base (mainnet or sepolia via env).
// ---------------------------------------------------------------------------

const _defaultChain = baseNet() === "sepolia" ? baseSepolia : base;

const PRIVY_CONFIG: PrivyClientConfig = {
  loginMethods: ["email"],
  embeddedWallets: {
    ethereum: { createOnLogin: "users-without-wallets" },
    // solana explicitly omitted — comex B2B is EVM/Base only.
  },
  mfa: {
    // Enforce MFA — corporate treasury requirement.
    noPromptOnMfaRequired: false,
  },
  defaultChain: _defaultChain,
  supportedChains: [_defaultChain],
};

export function ComexBaseProvider({ children }: { children: ReactNode }) {
  return (
    <PrivyProvider
      appId={import.meta.env.VITE_PRIVY_APP_ID ?? ""}
      config={PRIVY_CONFIG}
    >
      <ComexBaseProviderInner>{children}</ComexBaseProviderInner>
    </PrivyProvider>
  );
}

// ---------------------------------------------------------------------------
// Wallet context
// ---------------------------------------------------------------------------

interface SendTxArgs {
  to: `0x${string}`;
  data: `0x${string}`;
  value: bigint;
}

interface ComexBaseCtx {
  ready: boolean;
  authenticated: boolean;
  email: string | null;
  /** 0x-prefixed EVM address of the Privy embedded wallet. Null before wallet is created. */
  address: `0x${string}` | null;
  login: () => void;
  logout: () => Promise<void>;
  /**
   * Send an EVM transaction via the Privy embedded wallet.
   * Uses useSendTransaction from @privy-io/react-auth/tempo (tempo.d.ts line 14).
   * Returns { hash } — the on-chain tx hash.
   *
   * Gate contract: caller (baseAuthorize.ts) MUST invoke this only AFTER:
   *   build → decode → assert → human-confirm have all passed.
   */
  sendTransaction: (args: SendTxArgs) => Promise<{ hash: `0x${string}` }>;
}

const ComexBaseContext = createContext<ComexBaseCtx>({
  ready: false,
  authenticated: false,
  email: null,
  address: null,
  login: () => {},
  logout: async () => {},
  sendTransaction: async () => {
    throw new Error("comexBase: wallet not ready");
  },
});

// ---------------------------------------------------------------------------
// Inner provider — lives inside PrivyProvider tree
// ---------------------------------------------------------------------------

function ComexBaseProviderInner({ children }: { children: ReactNode }) {
  const { ready, authenticated, user, login, logout } = usePrivy();
  // VERIFY-WITH-KEYS: useWallets from @privy-io/react-auth (index.d.ts line 1331).
  // Returns ConnectedWallet[] (ethereum wallets when walletChainType not set to solana-only).
  const { wallets } = useWallets();
  // VERIFY-WITH-KEYS: useSendTransaction from @privy-io/react-auth/tempo (tempo.d.ts line 25).
  const { sendTransaction: privySendTx } = useSendTransaction();

  // Resolve email from linked accounts
  const emailAccount = user?.linkedAccounts?.find((a) => a.type === "email") as
    | { type: "email"; address: string }
    | undefined;
  const email = emailAccount?.address ?? null;

  // Pick the Privy embedded EVM wallet (walletClientType === "privy", type === "ethereum").
  const evmWallet: ConnectedWallet | undefined = wallets.find(
    (w) => w.walletClientType === "privy",
  ) as ConnectedWallet | undefined;

  const address: `0x${string}` | null = evmWallet?.address
    ? (evmWallet.address as `0x${string}`)
    : null;

  const sendTransaction = useCallback(
    async (args: SendTxArgs): Promise<{ hash: `0x${string}` }> => {
      if (!evmWallet) {
        throw new Error("comexBase: EVM wallet not available — authenticate first");
      }
      // Main useSendTransaction (prompts the user, signs with the embedded
      // wallet). Flat UnsignedTransactionRequest; `address` targets this wallet.
      const { hash } = await privySendTx(
        {
          to: args.to,
          data: args.data,
          value: `0x${args.value.toString(16)}` as `0x${string}`,
          chainId: _defaultChain.id,
        },
        { address: evmWallet.address },
      );
      return { hash: hash as `0x${string}` };
    },
    [evmWallet, privySendTx],
  );

  return (
    <ComexBaseContext.Provider
      value={{ ready, authenticated, email, address, login, logout, sendTransaction }}
    >
      {children}
    </ComexBaseContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Public hook
// ---------------------------------------------------------------------------

export function useComexBaseWallet(): ComexBaseCtx {
  return useContext(ComexBaseContext);
}
