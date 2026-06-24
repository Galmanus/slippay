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
      // @solana-program/memo is imported by @privy-io/react-auth/solana but only
      // used by the SIWS (Sign-In-With-Solana) auth flow, which this app (email +
      // embedded wallet) never triggers. The real package needs a @solana/kit
      // version incompatible with the one @solana-program/token pins, so it's a
      // dependency dead-end — stubbed. See src/stubs/solana-program-memo.ts.
      "@solana-program/memo": resolve(__dirname, "src/stubs/solana-program-memo.ts"),
    },
  },
  server: {
    port: 5173,
    fs: { allow: ["..", "../..", DOCS_ROOT] },
  },
});
