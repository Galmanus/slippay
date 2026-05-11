// "Ask Slippay" — Claude Code as engine (subprocess via OAuth subscription).
//
// Architecture:
//   - Bundle all docs into a single file at boot (/tmp/slippay-docs-bundle.md)
//   - Each question spawns `claude -p ... --append-system-prompt-file <bundle>`
//   - --output-format stream-json --include-partial-messages → streaming
//   - Auth via CLAUDE_CODE_OAUTH_TOKEN env (uses Pro/Max subscription, no
//     per-token billing)
//   - --bare skips CLAUDE.md / local skills (deterministic context)
//
// Why subprocess over Anthropic API direct:
//   - Uses operator's Claude Max subscription instead of metered API
//   - 100-500 questions/day fits easily inside subscription cap
//   - No ANTHROPIC_API_KEY to manage

const SYSTEM_PROMPT = `You are an AI assistant for SlipPay, a Stellar-native USDC/PYUSD payment gateway for Brazilian merchants billing globally.

Answer questions strictly using the slippay documentation provided. Every factual claim must be grounded in the docs.

Rules:
- If the answer isn't in the docs, say "I don't have information about that in the slippay documentation" — do NOT make up details.
- For pricing, fees, contract addresses, API endpoints: quote the docs verbatim where possible.
- Be concise. 2-4 sentences for most questions. Longer for technical setup walkthroughs.
- Match the user's language (Portuguese or English).
- For sensitive operational claims (regulatory status, partnership signed, mainnet live): use the exact hedging from docs/concepts/regulatory.md and the README "Honest disclosures" section. Slippay is currently in execution under a Stellar Brasil ecosystem program; mainnet is testnet-only; partnership-with-VASP not yet signed.

Citation format:
- Cite docs inline as [docs/<path>.md] when stating a specific fact (e.g. "The platform fee is 1% [docs/api-reference/orders.md]").
- At the end of your answer, output a "## Sources" section with each referenced doc on its own line as a bullet:
  ## Sources
  - docs/api-reference/orders.md
  - docs/concepts/regulatory.md

Operational facts to remember:
- Soroban subscription contract deployed Stellar testnet: CBWJ3LQGO7HBZBQK2MGS75EK266HNW4RJS77BVZIGZGDUUENXQMSHRHA
- Backend live: https://api.slippay.cc/api/health
- Network: testnet only; mainnet pending anchor partnership
- Repo: https://github.com/Galmanus/slippay`;

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
const DOCS_BUNDLE = Deno.env.get("SLIPPAY_DOCS_BUNDLE") ?? "/tmp/slippay-docs-bundle.md";
const CLAUDE_BIN = Deno.env.get("CLAUDE_BIN") ?? "claude";
const CLAUDE_CWD = Deno.env.get("CLAUDE_CWD") ?? "/tmp";

let bundlePromise: Promise<string> | null = null;

async function ensureDocsBundle(): Promise<string> {
  if (bundlePromise) return bundlePromise;
  bundlePromise = (async () => {
    let bundled = "# SlipPay Documentation\n\n" +
      "The following files compose the slippay documentation set. " +
      "When citing, reference them by their relative path (e.g. " +
      "`docs/api-reference/orders.md`).\n\n---\n";
    for (const rel of DOC_FILES) {
      try {
        const full = `${DOCS_ROOT}${rel}`;
        const content = await Deno.readTextFile(full);
        bundled += `\n\n## docs/${rel}\n\n${content}\n\n---\n`;
      } catch (e) {
        console.warn(`[ask] doc bundle skip ${rel}:`, String(e));
      }
    }
    await Deno.writeTextFile(DOCS_BUNDLE, bundled);
    console.log(`[ask] docs bundle ready at ${DOCS_BUNDLE} (${bundled.length} chars)`);
    return DOCS_BUNDLE;
  })();
  return bundlePromise;
}

export interface AskRequest {
  question: string;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
}

export async function askSlippayStream(req: AskRequest): Promise<ReadableStream<Uint8Array>> {
  const token = Deno.env.get("CLAUDE_CODE_OAUTH_TOKEN");
  if (!token) throw new Error("CLAUDE_CODE_OAUTH_TOKEN not set");

  const docsPath = await ensureDocsBundle();

  // Build the user prompt. Include history as context.
  let userInput = req.question;
  if (req.history && req.history.length > 0) {
    const hist = req.history
      .map(h => `### ${h.role === "user" ? "User" : "You answered"}\n${h.content}`)
      .join("\n\n");
    userInput = `## Prior conversation\n\n${hist}\n\n---\n\n## Current question\n\n${req.question}`;
  }

  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      const cmd = new Deno.Command(CLAUDE_BIN, {
        cwd: CLAUDE_CWD,
        args: [
          "-p", userInput,
          "--append-system-prompt", SYSTEM_PROMPT,
          "--append-system-prompt-file", docsPath,
          "--output-format", "stream-json",
          "--include-partial-messages",
          "--bare",
        ],
        env: {
          CLAUDE_CODE_OAUTH_TOKEN: token,
          HOME: Deno.env.get("HOME") ?? "/home/manuel",
          PATH: Deno.env.get("PATH") ?? "/usr/bin:/usr/local/bin",
        },
        stdout: "piped",
        stderr: "piped",
      });

      let child;
      try {
        child = cmd.spawn();
      } catch (e: unknown) {
        send({ type: "error", error: `spawn failed: ${(e as Error).message ?? e}` });
        controller.close();
        return;
      }

      // Drain stderr in background (errors surface; non-fatal warnings get logged)
      (async () => {
        const decoder = new TextDecoder();
        const reader = child.stderr.getReader();
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            const txt = decoder.decode(value);
            if (txt.trim()) console.warn("[claude stderr]", txt);
          }
        } catch { /* ignore */ }
      })();

      const decoder = new TextDecoder();
      const reader = child.stdout.getReader();
      let buffer = "";

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            try {
              const evt = JSON.parse(trimmed);
              forwardEvent(evt, send);
            } catch {
              // Not JSON — likely a status line; ignore
            }
          }
        }
        // flush last buffered line if any
        if (buffer.trim()) {
          try {
            const evt = JSON.parse(buffer.trim());
            forwardEvent(evt, send);
          } catch { /* ignore */ }
        }
        const status = await child.status;
        if (status.code !== 0) {
          send({ type: "error", error: `claude exited code ${status.code}` });
        } else {
          send({ type: "done" });
        }
      } catch (e: unknown) {
        send({ type: "error", error: String((e as Error).message ?? e) });
      } finally {
        controller.close();
      }
    },
  });
}

// Parse the various event shapes that `claude --output-format stream-json
// --include-partial-messages` may emit. We only forward text deltas, errors,
// and usage hints to the frontend. Citations from the model's [docs/...]
// inline markers are extracted by the frontend from the streamed text.
function forwardEvent(evt: unknown, send: (data: unknown) => void): void {
  const e = evt as Record<string, unknown>;
  // Pattern A: top-level stream_event wrapping an Anthropic API event
  if (e?.type === "stream_event") {
    const inner = e.event as Record<string, unknown> | undefined;
    if (!inner) return;
    if (inner.type === "content_block_delta") {
      const delta = inner.delta as Record<string, unknown> | undefined;
      if (delta?.type === "text_delta" && typeof delta.text === "string") {
        send({ type: "text", text: delta.text });
      }
    } else if (inner.type === "message_delta") {
      const usage = inner.usage as Record<string, number> | undefined;
      if (usage) send({ type: "usage", usage });
    }
    return;
  }
  // Pattern B: assistant message with text content (non-streaming chunk)
  if (e?.type === "assistant" || e?.role === "assistant") {
    const content = (e.content ?? e.message) as unknown;
    if (typeof content === "string") {
      send({ type: "text", text: content });
    } else if (Array.isArray(content)) {
      for (const b of content) {
        const block = b as Record<string, unknown>;
        if (block.type === "text" && typeof block.text === "string") {
          send({ type: "text", text: block.text });
        }
      }
    }
    return;
  }
  // Pattern C: result envelope at end of run
  if (e?.type === "result" && typeof e.result === "string") {
    // already streamed via stream_event; ignore to avoid duplication
    return;
  }
  // Pattern D: error envelope
  if (e?.type === "error" && typeof e.message === "string") {
    send({ type: "error", error: e.message });
  }
}
