import { Hono } from "hono";
import { cors } from "hono/cors";
import { errorMiddleware } from "./middleware/error.ts";
import merchants from "./routes/merchants.ts";
import orders from "./routes/orders.ts";
import subscriptions from "./routes/subscriptions.ts";

const api = new Hono().basePath("/api");
api.use("*", errorMiddleware);
api.use("*", cors({ origin: "*", allowMethods: ["GET", "POST", "PATCH", "OPTIONS"] }));

api.get("/health", (c) => c.json({ ok: true }));
api.route("/v1/merchants", merchants);
api.route("/v1/orders", orders);
api.route("/v1/subscriptions", subscriptions);

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

app.get("*", async (c) => {
  const path = c.req.path === "/" ? "/index.html" : c.req.path;
  const ext = (path.split(".").pop() ?? "").toLowerCase();
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
