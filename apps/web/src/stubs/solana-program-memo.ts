// Stub for @solana-program/memo (optional peer dep of @privy-io/react-auth/solana).
// Not needed at runtime for embedded-wallet-only usage (no memo instructions are sent).
export function getAddMemoInstruction(): never {
  throw new Error("@solana-program/memo not installed (optional peer dep, not used in comex)");
}
