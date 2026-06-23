// VERIFY-WITH-KEYS: the Privy raw-sign + Stellar-address-derivation calls below are wired per Privy docs but unverifiable without VITE_PRIVY_APP_ID. Re-check against the installed @privy-io/react-auth version when the App ID is set.

import { createContext, useContext, type ReactNode } from "react";
import {
  PrivyProvider,
  usePrivy,
  useWallets,
  type ConnectedWallet,
  type PrivyClientConfig,
} from "@privy-io/react-auth";

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

const PRIVY_CONFIG: PrivyClientConfig = {
  loginMethods: ["email"],
  embeddedWallets: {
    ethereum: { createOnLogin: "users-without-wallets" },
  },
  mfa: {
    noPromptOnMfaRequired: false,
  },
};

export function ComexPrivyProvider({ children }: { children: ReactNode }) {
  return (
    <PrivyProvider
      appId={import.meta.env.VITE_PRIVY_APP_ID ?? ""}
      config={PRIVY_CONFIG}
    >
      <ComexWalletProviderInner>{children}</ComexWalletProviderInner>
    </PrivyProvider>
  );
}

// ---------------------------------------------------------------------------
// Wallet context
// ---------------------------------------------------------------------------

interface ComexWalletCtx {
  ready: boolean;
  authenticated: boolean;
  email: string | null;
  /** Ethereum hex address of the Privy embedded wallet (stable account ID).
   *  VERIFY-WITH-KEYS: if a Stellar Ed25519 chain is added to Privy's config,
   *  replace with the Stellar G... address from the Stellar embedded wallet. */
  address: string | null;
  walletId: string | null;
  login: () => void;
  logout: () => Promise<void>;
  /** Signs arbitrary raw bytes using the embedded wallet via personal_sign.
   *  Returns raw signature bytes (65 bytes: r+s+v).
   *  VERIFY-WITH-KEYS: personal_sign adds an EIP-191 prefix. For bare hash
   *  signing (Stellar), use rawSignHash from privyWallet.ts (server-wallet path). */
  signHash: (hash: Buffer) => Promise<Buffer>;
}

const ComexWalletContext = createContext<ComexWalletCtx>({
  ready: false,
  authenticated: false,
  email: null,
  address: null,
  walletId: null,
  login: () => {},
  logout: async () => {},
  signHash: async () => Buffer.alloc(0),
});

// ---------------------------------------------------------------------------
// Inner provider — lives inside PrivyProvider tree
// ---------------------------------------------------------------------------

function ComexWalletProviderInner({ children }: { children: ReactNode }) {
  const { ready, authenticated, user, login, logout } = usePrivy();
  const { wallets } = useWallets();

  // Resolve email from linked accounts
  const emailAccount = user?.linkedAccounts?.find((a) => a.type === "email") as
    | { type: "email"; address: string }
    | undefined;
  const email = emailAccount?.address ?? null;

  // First embedded (Privy-created) wallet
  const embedded: ConnectedWallet | null =
    (wallets as ConnectedWallet[]).find(
      (w) => w.walletClientType === "privy" || w.walletClientType === "privy-v2",
    ) ?? null;

  const address: string | null = embedded?.address ?? null;
  const walletId: string | null = embedded?.address ?? null;

  async function signHash(hash: Buffer): Promise<Buffer> {
    if (!embedded) throw new Error("comexPrivy: carteira incorporada não disponível");
    // ConnectedWallet.sign() wraps personal_sign (EIP-191 prefix applied).
    // For raw Ed25519 Stellar signing, use rawSignHash from privyWallet.ts instead.
    // VERIFY-WITH-KEYS: confirm behavior with VITE_PRIVY_APP_ID configured.
    const sig = await embedded.sign(`0x${hash.toString("hex")}`);
    return Buffer.from(sig.replace(/^0x/, ""), "hex");
  }

  return (
    <ComexWalletContext.Provider
      value={{ ready, authenticated, email, address, walletId, login, logout, signHash }}
    >
      {children}
    </ComexWalletContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Public hook
// ---------------------------------------------------------------------------

export function useComexWallet(): ComexWalletCtx {
  return useContext(ComexWalletContext);
}
