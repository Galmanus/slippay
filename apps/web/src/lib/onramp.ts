// Fiat on-ramp via Transak (hosted widget). Transak is the on-ramp that covers
// Pix (Brazil) + Stellar + USDC today, KYC + regulation handled on their side —
// we only deep-link with the user's wallet address. Set VITE_TRANSAK_API_KEY
// (free signup at transak.com). Staging by default; flip VITE_TRANSAK_ENV=production.
//
// NOTE (honest): on-ramps deliver to a Stellar address. Our wallet is a contract
// (C…) address. If Transak only settles to classic (G…) accounts, we route the
// deposit through a relayer G-address and forward to the C-wallet — verified on
// the first live buy. This builds the flow; the live test confirms delivery.

export function transakConfigured(): boolean {
  return Boolean(import.meta.env.VITE_TRANSAK_API_KEY);
}

export function buildOnrampUrl(walletAddress: string, opts?: { fiat?: string; amount?: number }): string {
  const production = import.meta.env.VITE_TRANSAK_ENV === "production";
  const base = production ? "https://global.transak.com" : "https://global-stg.transak.com";
  const p = new URLSearchParams({
    apiKey: (import.meta.env.VITE_TRANSAK_API_KEY as string) ?? "",
    productsAvailed: "BUY",
    cryptoCurrencyCode: "USDC",
    network: "stellar",
    walletAddress,
    fiatCurrency: opts?.fiat ?? "BRL",
    defaultPaymentMethod: "pix",
    defaultFiatAmount: String(opts?.amount ?? 50),
    themeColor: "FDDA24",
    disableWalletAddressForm: "true",
  });
  return `${base}/?${p.toString()}`;
}
