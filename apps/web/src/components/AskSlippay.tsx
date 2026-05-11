import { useState, useRef, useEffect, useCallback } from "react";

interface Citation {
  doc_path: string;
  doc_title: string;
  cited_text: string;
  start_char_index?: number;
  end_char_index?: number;
}

interface Turn {
  role: "user" | "assistant";
  content: string;
  citations?: Citation[];
}

const API_BASE = import.meta.env.VITE_API_BASE ?? "/api";
const ASK_URL = `${API_BASE.replace(/\/$/, "")}/v1/ask`;
const GITHUB_DOCS = "https://github.com/Galmanus/slippay/blob/main/docs";

const QUICK_PROMPTS: Array<{ category: string; prompt: string }> = [
  { category: "Pricing",     prompt: "How much does it cost to use slippay?" },
  { category: "On-chain",    prompt: "What's deployed on Stellar testnet?" },
  { category: "Integration", prompt: "How do I integrate the SDK in 5 minutes?" },
  { category: "Regulatory",  prompt: "Why partnership with a VASP?" },
  { category: "BR-export",   prompt: "Como o slippay reduz o leakage de 6% do Stripe?" },
  { category: "Soroban",     prompt: "How does the subscription contract work on-chain?" },
];

export function AskSlippay() {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 200);
  }, [open]);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: "smooth" });
  }, [turns]);

  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  // ESC to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const submit = useCallback(async (qOverride?: string) => {
    const q = (qOverride ?? input).trim();
    if (!q || streaming) return;

    setError(null);
    setStreaming(true);
    setInput("");

    const newTurns: Turn[] = [
      ...turns,
      { role: "user", content: q },
      { role: "assistant", content: "", citations: [] },
    ];
    setTurns(newTurns);

    const history = turns.map(t => ({ role: t.role, content: t.content }));

    try {
      const resp = await fetch(ASK_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ question: q, history }),
      });

      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        setError(body.detail ?? body.error ?? `HTTP ${resp.status}`);
        setStreaming(false);
        return;
      }
      if (!resp.body) { setError("No response body"); setStreaming(false); return; }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;
          const json = line.slice(5).trim();
          if (!json) continue;
          try {
            const evt = JSON.parse(json);
            if (evt.type === "text") {
              setTurns(prev => {
                const last = prev[prev.length - 1];
                if (last?.role !== "assistant") return prev;
                return [...prev.slice(0, -1), { ...last, content: last.content + evt.text }];
              });
            } else if (evt.type === "citation") {
              setTurns(prev => {
                const last = prev[prev.length - 1];
                if (last?.role !== "assistant") return prev;
                return [...prev.slice(0, -1), { ...last, citations: [...(last.citations ?? []), evt.citation] }];
              });
            } else if (evt.type === "error") {
              setError(evt.error);
            }
          } catch { /* malformed */ }
        }
      }
    } catch (e: unknown) {
      setError(String((e as Error).message ?? e));
    } finally {
      setStreaming(false);
    }
  }, [input, streaming, turns]);

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <>
      {/* Floating launcher (lower-right, editorial) */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-8 right-8 z-50 bg-[#0a0a0a] text-[#f1eee7] pl-5 pr-6 py-3.5 group flex items-center gap-3 hover:bg-[#1a1a1a] transition-colors"
          aria-label="Ask Slippay"
        >
          <span className="inline-block w-1.5 h-1.5 bg-[#b5e853]" />
          <span className="text-[10px] uppercase tracking-[0.24em] font-mono">Ask Slippay</span>
          <span className="text-[#f1eee7]/40 text-[10px] uppercase tracking-[0.18em] font-mono border-l border-[#f1eee7]/15 pl-3 hidden md:inline">
            ⌘K
          </span>
        </button>
      )}

      {/* Backdrop */}
      <div
        onClick={() => setOpen(false)}
        className={`fixed inset-0 bg-[#0a0a0a]/60 backdrop-blur-sm z-40 transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0 pointer-events-none"}`}
      />

      {/* Side panel (slides in from right) */}
      <aside
        className={`fixed top-0 right-0 bottom-0 z-50 w-full md:w-[540px] bg-[#f1eee7] text-[#0a0a0a] flex flex-col transition-transform duration-300 ease-out ${open ? "translate-x-0" : "translate-x-full"}`}
      >
        {/* Header — INK bar with editorial labels */}
        <div className="bg-[#0a0a0a] text-[#f1eee7] px-8 py-6 flex items-end justify-between border-b border-[#0a0a0a]">
          <div>
            <div className="text-[10px] uppercase tracking-[0.24em] font-mono text-[#f1eee7]/55 tabular-nums">
              ╱╱  Issue 002
            </div>
            <h2 className="mt-2 text-2xl md:text-3xl font-medium tracking-[-0.03em] leading-none">
              Ask SlipPay
              <span className="inline-block w-2 h-2 bg-[#b5e853] ml-2.5 align-baseline -translate-y-[2px]" />
            </h2>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="text-[#f1eee7]/55 hover:text-[#f1eee7] text-2xl leading-none mb-1"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div ref={bodyRef} className="flex-1 overflow-y-auto px-8 py-8 space-y-8">
          {turns.length === 0 && (
            <div className="space-y-10">
              <div className="space-y-5">
                <div className="text-[10px] uppercase tracking-[0.22em] text-[#0a0a0a]/55 font-mono">
                  ┃ The thesis
                </div>
                <p className="text-base leading-[1.65] tracking-tight max-w-[44ch] text-[#0a0a0a]/80">
                  Ask anything about SlipPay — fees, the Soroban subscription
                  contract, what's deployed on testnet, SDK integration, regulatory
                  framing, partnerships. Answers cite the actual docs, never invent.
                </p>
              </div>

              <div className="space-y-3">
                <div className="text-[10px] uppercase tracking-[0.22em] text-[#0a0a0a]/55 font-mono">
                  ┃ Try one of these
                </div>
                <div className="grid grid-cols-1 gap-px bg-[#0a0a0a]/15 border border-[#0a0a0a]/15">
                  {QUICK_PROMPTS.map(({ category, prompt }) => (
                    <button
                      key={prompt}
                      onClick={() => submit(prompt)}
                      className="bg-[#f1eee7] hover:bg-[#0a0a0a]/[0.03] transition-colors p-4 text-left group"
                    >
                      <div className="text-[9px] uppercase tracking-[0.22em] text-[#0a0a0a]/55 font-mono mb-1.5 flex items-center gap-2">
                        <span className="inline-block w-1 h-1 bg-[#b5e853]" />
                        {category}
                      </div>
                      <div className="text-sm leading-[1.45] tracking-tight group-hover:text-[#0a0a0a]">
                        {prompt}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {turns.map((t, i) => (
            <div key={i}>
              {t.role === "user" ? (
                <div className="space-y-2">
                  <div className="text-[10px] uppercase tracking-[0.22em] text-[#0a0a0a]/55 font-mono">
                    ┃ You
                  </div>
                  <div className="text-base leading-[1.55] tracking-tight text-[#0a0a0a]">
                    {t.content}
                  </div>
                </div>
              ) : (
                <div className="space-y-4 border-l-2 border-[#b5e853] pl-5">
                  <div className="text-[10px] uppercase tracking-[0.22em] text-[#0a0a0a]/55 font-mono flex items-center gap-2">
                    <span className="inline-block w-1 h-1 bg-[#b5e853]" />
                    SlipPay
                  </div>
                  <div className="text-[15px] leading-[1.65] text-[#0a0a0a] whitespace-pre-wrap tracking-tight">
                    {t.content}
                    {streaming && i === turns.length - 1 && (
                      <span className="inline-block w-1.5 h-4 bg-[#0a0a0a] ml-0.5 align-middle animate-pulse" />
                    )}
                  </div>
                  {t.citations && t.citations.length > 0 && (
                    <div className="space-y-3 pt-3 border-t border-[#0a0a0a]/15">
                      <div className="text-[10px] uppercase tracking-[0.22em] text-[#0a0a0a]/55 font-mono">
                        ┃ Sources
                      </div>
                      <div className="space-y-1.5">
                        {dedupeCitations(t.citations).slice(0, 5).map((c, j) => (
                          <a
                            key={j}
                            href={`${GITHUB_DOCS}/${c.doc_path}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block px-3 py-2 border border-[#0a0a0a]/15 hover:border-[#0a0a0a] hover:bg-[#0a0a0a]/[0.02] transition-colors group"
                          >
                            <div className="flex items-baseline gap-2.5 mb-1">
                              <span className="text-[9px] tabular-nums text-[#0a0a0a]/40 font-mono">{String(j + 1).padStart(2, "0")}</span>
                              <span className="text-[10px] uppercase tracking-[0.18em] text-[#0a0a0a]/70 font-mono truncate flex-1">
                                {c.doc_path}
                              </span>
                              <span className="text-[#0a0a0a]/30 group-hover:text-[#0a0a0a] text-xs">↗</span>
                            </div>
                            <div className="text-[11px] leading-[1.45] text-[#0a0a0a]/75 line-clamp-2 pl-[26px]">
                              {c.cited_text.slice(0, 160)}{c.cited_text.length > 160 ? "…" : ""}
                            </div>
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}

          {error && (
            <div className="border border-red-800/30 bg-red-50 text-red-900 text-sm px-4 py-3 font-mono">
              <div className="text-[10px] uppercase tracking-[0.18em] mb-1 text-red-700">Error</div>
              {error}
            </div>
          )}
        </div>

        {/* Input — editorial submit */}
        <div className="border-t border-[#0a0a0a]/15 bg-[#f1eee7]">
          <form
            onSubmit={(e) => { e.preventDefault(); submit(); }}
            className="px-8 pt-5 pb-2"
          >
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <div className="text-[10px] uppercase tracking-[0.22em] text-[#0a0a0a]/55 font-mono mb-2">
                  ┃ Your question
                </div>
                <textarea
                  ref={inputRef}
                  rows={2}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={onKey}
                  disabled={streaming}
                  placeholder="What's deployed? What's the fee? How do I integrate?"
                  className="w-full bg-transparent border-0 border-b border-[#0a0a0a]/20 py-2 text-[15px] tracking-tight resize-none focus:outline-none focus:border-[#0a0a0a] disabled:opacity-50 placeholder:text-[#0a0a0a]/35"
                />
              </div>
              <button
                type="submit"
                disabled={!input.trim() || streaming}
                className="bg-[#0a0a0a] text-[#f1eee7] px-6 py-3.5 text-[10px] uppercase tracking-[0.24em] font-mono hover:bg-[#1a1a1a] disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-2.5 self-end"
              >
                {streaming ? (
                  <span className="flex items-center gap-2">
                    <span className="inline-block w-1.5 h-1.5 bg-[#b5e853] animate-pulse" />
                    Thinking
                  </span>
                ) : (
                  <>
                    <span className="inline-block w-1.5 h-1.5 bg-[#b5e853]" />
                    Ask
                  </>
                )}
              </button>
            </div>
          </form>
          <div className="px-8 pb-5 flex items-center justify-between text-[9px] uppercase tracking-[0.22em] text-[#0a0a0a]/40 font-mono">
            <span>AI can drift — verify with cited docs</span>
            <span className="hidden md:inline">Enter to send · Shift+Enter newline</span>
          </div>
        </div>
      </aside>
    </>
  );
}

function dedupeCitations(citations: Citation[]): Citation[] {
  const seen = new Map<string, Citation>();
  for (const c of citations) {
    if (!seen.has(c.doc_path)) seen.set(c.doc_path, c);
  }
  return Array.from(seen.values());
}
