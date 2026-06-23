import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

// Allow Vite to resolve raw imports of the monorepo's top-level docs/ so the
// /docs route can bundle every markdown file at build time.
const DOCS_ROOT = resolve(__dirname, "../../docs");

export default defineConfig({
  plugins: [react()],
  define: {
    __BUILD_TAG__: JSON.stringify(new Date().toISOString().replace(/[-:T]/g, "").slice(0, 14)),
  },
  resolve: {
    alias: {
      // @solana-program/memo is an optional peer dep of @privy-io/react-auth/solana.
      // It is not installed (not needed for embedded-wallet USDC transfers).
      // Stub it so Rollup doesn't fail on the missing export at build time.
      "@solana-program/memo": resolve(__dirname, "src/stubs/solana-program-memo.ts"),
    },
  },
  server: {
    port: 5173,
    fs: { allow: ["..", "../..", DOCS_ROOT] },
  },
});
