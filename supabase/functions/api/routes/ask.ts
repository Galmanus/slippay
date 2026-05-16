import { Hono, type Context } from "hono";
import { askSlippayStream } from "../lib/ask.ts";
import { rateLimit } from "../middleware/rate_limit.ts";

const r = new Hono();

// Audit-004 · C7 — defense in depth for the unauth Claude-CLI-spawning route:
//  1. Aggressive per-IP rate limit on top of the global limiter
//  2. Referer/Origin allowlist so it only serves the landing page, not random
//     scripts on the open internet
//  3. Concurrency semaphore so a flash flood of valid IPs still can't OOM
//     the container by spawning N concurrent subprocesses
//  4. Question length cap (already present, kept)
const ALLOWED_ORIGINS_RE = /^https:\/\/(app\.)?slippay\.cc$|^http:\/\/(localhost|127\.0\.0\.1):5173$/;
const MAX_CONCURRENT_SUBPROCESSES = 4;
let inFlight = 0;

// Token bucket: 5 req/min sustained, burst 5. Daily-ish cap via second
// limiter below (smaller refill).
r.use("*", rateLimit({ capacity: 5, refillPerSec: 5 / 60, scope: "ask_per_minute" }));
r.use("*", rateLimit({ capacity: 100, refillPerSec: 100 / 86_400, scope: "ask_per_day" }));

// POST /v1/ask — Ask Slippay AI chat widget endpoint.
// Public (no auth required) — intended to be called from the landing page.
// Streams Server-Sent Events: text deltas, citations, usage, done, or error.
//
// Request body: { question: string, history?: [{role, content}] }
//
// SSE event types streamed:
//   {type: "text", text: "..."}             — token-by-token answer text
//   {type: "citation", citation: {...}}     — citation pointing to a doc
//   {type: "usage", usage: {...}}           — final token usage (cost tracking)
//   {type: "done"}                          — end of stream
//   {type: "error", error: "..."}           — fatal error mid-stream
r.post("/", async (c) => {
  // Origin gate: only serve the Slippay landing/app. Random pages cannot
  // CSRF-style invoke us because Origin is browser-set.
  const origin = c.req.header("origin") ?? c.req.header("referer") ?? "";
  if (origin && !ALLOWED_ORIGINS_RE.test(new URL(origin).origin)) {
    return c.json({ error: "origin_not_allowed" }, 403);
  }
  if (inFlight >= MAX_CONCURRENT_SUBPROCESSES) {
    return c.json({ error: "busy", detail: "too many concurrent requests; retry shortly" }, 503);
  }
  inFlight += 1;
  try {
    return await handleAsk(c);
  } finally {
    inFlight -= 1;
  }
});

async function handleAsk(c: Context) {
  let body: { question?: string; history?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "invalid_json" }, 400);
  }
  const question = (body.question ?? "").toString().trim();
  if (!question || question.length > 4000) {
    return c.json({ error: "invalid_question", detail: "expected 1-4000 chars" }, 400);
  }
  const history = Array.isArray(body.history)
    ? (body.history as Array<{ role: "user" | "assistant"; content: string }>)
      .filter(h => (h.role === "user" || h.role === "assistant") && typeof h.content === "string")
      .slice(-10)  // limit to last 10 turns for cost
    : undefined;

  let stream: ReadableStream<Uint8Array>;
  try {
    stream = await askSlippayStream({ question, history });
  } catch (e: unknown) {
    const msg = String((e as Error).message ?? e);
    if (msg.includes("CLAUDE_CODE_OAUTH_TOKEN") || msg.includes("ANTHROPIC_API_KEY")) {
      return c.json({ error: "service_unavailable", detail: "Ask Slippay engine not configured. Contact admin." }, 503);
    }
    return c.json({ error: "stream_failed", detail: msg }, 500);
  }

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      "connection": "keep-alive",
    },
  });
}

export default r;
