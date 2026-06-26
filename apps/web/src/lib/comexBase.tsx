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
  type ConnectedWallet,
  type PrivyClientConfig,
} from "@privy-io/react-auth";
import { SmartWalletsProvider, useSmartWallets } from "@privy-io/react-auth/smart-wallets";
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
      <SmartWalletsProvider>
        <ComexBaseProviderInner>{children}</ComexBaseProviderInner>
      </SmartWalletsProvider>
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
  // Smart wallet (ERC-4337) client — the comex account IS the smart wallet,
  // controlled by the Privy embedded EOA signer. Gas is paid via the paymaster
  // configured in the Privy dashboard (USDC), so the company never needs ETH.
  const { client: smartClient } = useSmartWallets();
  const { wallets } = useWallets();

  // Resolve email from linked accounts
  const emailAccount = user?.linkedAccounts?.find((a) => a.type === "email") as
    | { type: "email"; address: string }
    | undefined;
  const email = emailAccount?.address ?? null;

  // The embedded EOA (signer). Used as the address fallback so balance/receive/buy
  // keep working before the smart wallet is provisioned (dashboard not yet set up).
  const evmWallet = wallets.find((w) => w.walletClientType === "privy") as
    | ConnectedWallet
    | undefined;

  // Prefer the smart wallet address once it exists; fall back to the EOA. The UI
  // upgrades to the smart wallet automatically when Privy provisions it.
  const address: `0x${string}` | null = smartClient?.account?.address
    ? (smartClient.account.address as `0x${string}`)
    : evmWallet?.address
    ? (evmWallet.address as `0x${string}`)
    : null;

  const sendTransaction = useCallback(
    async (args: SendTxArgs): Promise<{ hash: `0x${string}` }> => {
      if (!smartClient) {
        throw new Error("Carteira inteligente ainda não ativada — configure os smart wallets no Privy para enviar sem ETH.");
      }
      // Smart wallet send: routed as an ERC-4337 UserOp through the bundler +
      // paymaster (gas in USDC). viem-style params (value as bigint).
      const hash = await smartClient.sendTransaction({
        to: args.to,
        data: args.data,
        value: args.value,
      } as Parameters<typeof smartClient.sendTransaction>[0]);
      return { hash: hash as `0x${string}` };
    },
    [smartClient],
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
