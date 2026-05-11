import { Hono } from "hono";
import { askSlippayStream } from "../lib/ask.ts";

const r = new Hono();

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
    if (msg.includes("ANTHROPIC_API_KEY")) {
      return c.json({ error: "service_unavailable", detail: "Ask Slippay is not configured. Contact admin." }, 503);
    }
    return c.json({ error: "stream_failed", detail: msg }, 500);
  }

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache",
      "connection": "keep-alive",
      "access-control-allow-origin": "*",
    },
  });
});

export default r;
