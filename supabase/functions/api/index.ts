import { Hono } from "hono";
import { cors } from "hono/cors";
import { errorMiddleware } from "./middleware/error.ts";
import merchants from "./routes/merchants.ts";

const app = new Hono().basePath("/api");
app.use("*", errorMiddleware);
app.use("*", cors({ origin: "*", allowMethods: ["GET", "POST", "PATCH", "OPTIONS"] }));

app.get("/health", (c) => c.json({ ok: true }));
app.route("/v1/merchants", merchants);

if (import.meta.main) {
  Deno.serve(app.fetch);
}

export default app;
