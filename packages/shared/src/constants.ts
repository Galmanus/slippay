export const NETWORK = {
  testnet: {
    horizon: "https://horizon-testnet.stellar.org",
    passphrase: "Test SDF Network ; September 2015",
    usdc_issuer: "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
  },
  mainnet: {
    horizon: "https://horizon.stellar.org",
    passphrase: "Public Global Stellar Network ; September 2015",
    usdc_issuer: "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN",
  },
} as const;

export const USDC_ASSET_CODE = "USDC";
export const STELLAR_ADDRESS_LENGTH = 56;
export const MEMO_HASH_HEX_LENGTH = 64; // 32 bytes
export const DEFAULT_PLATFORM_FEE_BP = 100; // 1%
export const ORDER_DEFAULT_EXPIRY_MINUTES = 30;
export const API_KEY_PREFIX = "sk_live_";
export const API_KEY_BYTES = 32;
