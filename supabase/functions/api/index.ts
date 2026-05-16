import { Hono } from "hono";
import { cors } from "hono/cors";
import { errorMiddleware } from "./middleware/error.ts";
import { rateLimit } from "./middleware/rate_limit.ts";
import merchants from "./routes/merchants.ts";
import orders from "./routes/orders.ts";
import subscriptions from "./routes/subscriptions.ts";
import ask from "./routes/ask.ts";

const api = new Hono().basePath("/api");
api.use("*", errorMiddleware);
// Audit-004 · M2: CORS allowlist (was "*"). The web app + landing on
// app.slippay.cc / slippay.cc need access; everything else stays denied so
// that the unauthenticated public endpoints (e.g. /v1/orders/:id?t=...) can't
// be invoked from random origins.
const ALLOWED_ORIGINS = new Set([
  "https://app.slippay.cc",
  "https://slippay.cc",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);
api.use("*", cors({
  origin: (origin) => (origin && ALLOWED_ORIGINS.has(origin)) ? origin : "",
  allowMethods: ["GET", "POST", "PATCH", "OPTIONS"],
  allowHeaders: ["authorization", "content-type"],
}));
// Audit-004 · C6: global token-bucket per IP applied to every /api/* request
// as the outer guardrail. Per-route limiters (e.g. /v1/ask) compose on top.
api.use("*", rateLimit({ capacity: 120, refillPerSec: 2, scope: "global" }));

api.get("/health", (c) => c.json({ ok: true }));
api.route("/v1/merchants", merchants);
api.route("/v1/orders", orders);
api.route("/v1/subscriptions", subscriptions);
api.route("/v1/ask", ask);

const app = new Hono();
app.route("/", api);

const WEB_DIST = Deno.env.get("WEB_DIST") ??
  new URL("../../../apps/web/dist/", import.meta.url).pathname;

const MIME: Record<string, string> = {
  html: "text/html; charset=utf-8",
  js: "application/javascript; charset=utf-8",
  css: "text/css; charset=utf-8",
  json: "application/json",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  svg: "image/svg+xml",
  ico: "image/x-icon",
  woff: "font/woff",
  woff2: "font/woff2",
  txt: "text/plain; charset=utf-8",
  webp: "image/webp",
};

// Canonical hostnames:
//   - app.slippay.cc  → landing + SPA (static files from apps/web/dist)
//   - api.slippay.cc  → REST API only; non-/api/* requests redirect to app.
//
// Nginx aliases both hostnames to this Deno backend on :8080 (Mario's vhost
// edit). Routing by Host header here splits the surface cleanly without
// requiring two nginx vhosts.
const APP_HOST   = "app.slippay.cc";
const API_HOST   = "api.slippay.cc";
const APP_ORIGIN = "https://app.slippay.cc";

app.get("*", async (c) => {
  const host = (c.req.header("host") ?? "").toLowerCase();
  const path = c.req.path === "/" ? "/index.html" : c.req.path;
  const ext = (path.split(".").pop() ?? "").toLowerCase();

  // api.slippay.cc — serve API only. Non-/api/* paths get a 301 to the app
  // origin. GET / returns service-info JSON for crawlers / health checks.
  if (host === API_HOST || host.startsWith(API_HOST + ":")) {
    if (c.req.path === "/" || c.req.path === "/index.html") {
      return c.json({
        service: "slippay-api",
        status: "ok",
        canonical_app: APP_ORIGIN,
        health: "/api/health",
        repo: "https://github.com/Galmanus/slippay",
      });
    }
    // Any other non-/api/* path on api.slippay.cc → redirect to app origin.
    return c.redirect(`${APP_ORIGIN}${c.req.path}`, 301);
  }

  // app.slippay.cc (and any other host alias) — serve static + SPA fallback.
  try {
    const file = await Deno.readFile(`${WEB_DIST}${path}`);
    return new Response(file, {
      headers: {
        "content-type": MIME[ext] ?? "application/octet-stream",
        "cache-control": ext === "html" ? "no-cache" : "public, max-age=31536000",
      },
    });
  } catch {
    // SPA fallback — serve index.html for client-side routes
    const file = await Deno.readFile(`${WEB_DIST}/index.html`);
    return new Response(file, {
      headers: { "content-type": MIME.html, "cache-control": "no-cache" },
    });
  }
});

if (import.meta.main) {
  const port = Number(Deno.env.get("PORT") ?? 8000);
  Deno.serve({ port }, app.fetch);
}

export default app;
