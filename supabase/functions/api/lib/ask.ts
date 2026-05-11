// "Ask Slippay" — Claude API integration with prompt-cached docs + citations.
//
// Architecture:
//   - System prompt: small, stable instructions (cached)
//   - User message: docs as document blocks at front (cached) + question at end
//   - cache_control breakpoint on last document block → docs cached, question varies
//   - Citations API enabled per document → Claude returns char-range citations
//   - Streaming SSE → real-time response
//
// Cost (estimate, Sonnet 4.6 at $3/$15 per 1M):
//   First request:  ~$0.56 (writes ~150k token cache)
//   Subsequent:     ~$0.05/question (reads cache at 0.1x)

import Anthropic from "npm:@anthropic-ai/sdk@0.71.0";

const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 4096;

const SYSTEM_PROMPT = `You are an AI assistant for SlipPay, a Stellar-native USDC/PYUSD payment gateway for Brazilian merchants billing globally.

Answer questions strictly using the provided documentation. Cite sources using the Citations API — every factual claim must be grounded in a doc.

Rules:
- If the answer isn't in the docs, say "I don't have information about that in the slippay documentation" — do NOT make up details.
- For pricing, fees, contract addresses, API endpoints: quote the docs verbatim where possible.
- Be concise. 2-4 sentences for most questions. Longer for technical setup walkthroughs.
- Match the user's language. If they ask in Portuguese, respond in Portuguese.
- Don't mention "the documentation" — just answer with citations underneath.
- For sensitive operational claims (regulatory status, partnership signed, mainnet live): use the exact hedging from docs/concepts/regulatory.md and the README "Honest disclosures" section.

Slippay is currently in execution under a Stellar Brasil ecosystem program. Mainnet is testnet-live; the Soroban subscription contract is deployed on testnet at CBWJ3LQGO7HBZBQK2MGS75EK266HNW4RJS77BVZIGZGDUUENXQMSHRHA.`;

// Doc files included as document blocks (relative to /opt/slippay-backend/docs/).
// Order: foundational concepts first (cached prefix), then references, then guides.
const DOC_FILES = [
  "README.md",
  "quickstart.md",
  "concepts/architecture.md",
  "concepts/non-custodial-settlement.md",
  "concepts/regulatory.md",
  "api-reference/authentication.md",
  "api-reference/merchants.md",
  "api-reference/orders.md",
  "api-reference/subscriptions.md",
  "api-reference/webhooks.md",
  "api-reference/errors.md",
  "guides/drop-in-sdk.md",
  "guides/recurring-billing.md",
  "guides/woocommerce.md",
  "guides/webhooks-handler.md",
  "guides/br-export-merchants.md",
];

const DOCS_ROOT = Deno.env.get("SLIPPAY_DOCS_ROOT") ??
  new URL("../../../../docs/", import.meta.url).pathname;

interface CachedDoc {
  path: string;
  title: string;
  content: string;
}

let cachedDocs: CachedDoc[] | null = null;

async function loadDocs(): Promise<CachedDoc[]> {
  if (cachedDocs) return cachedDocs;
  const docs: CachedDoc[] = [];
  for (const rel of DOC_FILES) {
    try {
      const full = `${DOCS_ROOT}${rel}`;
      const content = await Deno.readTextFile(full);
      docs.push({ path: rel, title: rel, content });
    } catch (e) {
      console.warn(`[ask] failed to load ${rel}:`, String(e));
    }
  }
  cachedDocs = docs;
  console.log(`[ask] loaded ${docs.length} docs, ${docs.reduce((s, d) => s + d.content.length, 0)} chars total`);
  return docs;
}

export interface AskRequest {
  question: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
}

export interface AskCitation {
  doc_path: string;
  doc_title: string;
  cited_text: string;
  start_char_index?: number;
  end_char_index?: number;
}

export async function askSlippayStream(
  req: AskRequest,
): Promise<ReadableStream<Uint8Array>> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY not set");
  }

  const docs = await loadDocs();
  const client = new Anthropic({ apiKey });

  // Build user message content: docs as document blocks + question at end.
  // cache_control on the LAST document block → caches the doc prefix.
  type ContentBlock = {
    type: "document";
    source: { type: "text"; media_type: "text/plain"; data: string };
    title: string;
    citations: { enabled: true };
    cache_control?: { type: "ephemeral" };
  } | {
    type: "text";
    text: string;
  };

  const docBlocks: ContentBlock[] = docs.map((d, i) => ({
    type: "document",
    source: { type: "text", media_type: "text/plain", data: d.content },
    title: d.title,
    citations: { enabled: true },
    ...(i === docs.length - 1 ? { cache_control: { type: "ephemeral" } as const } : {}),
  }));

  // Build messages array. History (if any) comes first as plain text turns.
  // Final user turn has docs + the current question.
  const messages: Anthropic.MessageParam[] = [];
  if (req.history && req.history.length > 0) {
    for (const h of req.history) {
      messages.push({ role: h.role, content: h.content });
    }
  }
  messages.push({
    role: "user",
    content: [
      ...docBlocks,
      { type: "text", text: req.question },
    ] as unknown as Anthropic.ContentBlockParam[],
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        const apiStream = client.messages.stream({
          model: MODEL,
          max_tokens: MAX_TOKENS,
          system: SYSTEM_PROMPT,
          messages,
        });

        for await (const event of apiStream) {
          if (event.type === "content_block_delta") {
            const delta = event.delta;
            if (delta.type === "text_delta") {
              send({ type: "text", text: delta.text });
            } else if (delta.type === "citations_delta") {
              const c = delta.citation as {
                type?: string;
                cited_text?: string;
                document_index?: number;
                document_title?: string;
                start_char_index?: number;
                end_char_index?: number;
              };
              const docIdx = typeof c.document_index === "number" ? c.document_index : -1;
              const matchedDoc = docIdx >= 0 && docIdx < docs.length ? docs[docIdx] : null;
              send({
                type: "citation",
                citation: {
                  doc_path: matchedDoc?.path ?? c.document_title ?? "unknown",
                  doc_title: matchedDoc?.title ?? c.document_title ?? "unknown",
                  cited_text: c.cited_text ?? "",
                  start_char_index: c.start_char_index,
                  end_char_index: c.end_char_index,
                },
              });
            }
          } else if (event.type === "message_delta") {
            // contains stop_reason + usage
            if (event.usage) {
              send({
                type: "usage",
                usage: {
                  input_tokens: event.usage.input_tokens,
                  output_tokens: event.usage.output_tokens,
                  cache_creation_input_tokens: (event.usage as { cache_creation_input_tokens?: number }).cache_creation_input_tokens ?? 0,
                  cache_read_input_tokens: (event.usage as { cache_read_input_tokens?: number }).cache_read_input_tokens ?? 0,
                },
              });
            }
          } else if (event.type === "message_stop") {
            send({ type: "done" });
          }
        }

        controller.close();
      } catch (e: unknown) {
        send({ type: "error", error: String((e as Error).message ?? e) });
        controller.close();
      }
    },
  });

  return stream;
}
