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

export function AskSlippay() {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100);
  }, [open]);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: "smooth" });
  }, [turns]);

  const submit = useCallback(async () => {
    const q = input.trim();
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
      if (!resp.body) {
        setError("No response body");
        setStreaming(false);
        return;
      }

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
                return [
                  ...prev.slice(0, -1),
                  { ...last, content: last.content + evt.text },
                ];
              });
            } else if (evt.type === "citation") {
              setTurns(prev => {
                const last = prev[prev.length - 1];
                if (last?.role !== "assistant") return prev;
                return [
                  ...prev.slice(0, -1),
                  { ...last, citations: [...(last.citations ?? []), evt.citation] },
                ];
              });
            } else if (evt.type === "error") {
              setError(evt.error);
            }
          } catch {
            // ignore malformed lines
          }
        }
      }
    } catch (e: unknown) {
      setError(String((e as Error).message ?? e));
    } finally {
      setStreaming(false);
    }
  }, [input, streaming, turns]);

  return (
    <>
      {/* Floating launcher button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 bg-[#0a0a0a] text-[#f1eee7] px-5 py-3 text-[10px] uppercase tracking-[0.22em] hover:bg-[#1a1a1a] shadow-lg flex items-center gap-2"
          aria-label="Ask Slippay"
        >
          <span className="inline-block w-1.5 h-1.5 bg-[#b5e853]" />
          Ask Slippay
        </button>
      )}

      {/* Modal overlay */}
      {open && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center pt-20 px-4">
          <div className="bg-[#f1eee7] text-[#0a0a0a] w-full max-w-2xl max-h-[80vh] flex flex-col border border-[#0a0a0a]/15 shadow-2xl">
            {/* Header */}
            <div className="border-b border-[#0a0a0a]/15 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="inline-block w-1.5 h-1.5 bg-[#b5e853]" />
                <span className="text-[11px] uppercase tracking-[0.22em] font-mono">Ask SlipPay</span>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="text-[#0a0a0a]/55 hover:text-[#0a0a0a] text-xl leading-none"
              >
                ×
              </button>
            </div>

            {/* Body */}
            <div ref={bodyRef} className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
              {turns.length === 0 && (
                <div className="space-y-4">
                  <div className="text-sm text-[#0a0a0a]/75 leading-[1.6] max-w-[55ch]">
                    Ask anything about SlipPay — fees, how the Soroban subscription
                    contract works, what's deployed, how to integrate the SDK,
                    regulatory framing, or partnership status. Answers cite the
                    actual docs.
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-2">
                    {[
                      "How much does it cost to use slippay?",
                      "What's deployed on Stellar testnet?",
                      "Como funciona o checkout no WooCommerce?",
                      "Why partnership with a VASP?",
                    ].map(s => (
                      <button
                        key={s}
                        onClick={() => { setInput(s); setTimeout(() => submit(), 50); }}
                        className="text-left text-xs px-3 py-2 border border-[#0a0a0a]/15 hover:border-[#0a0a0a] hover:bg-[#0a0a0a]/[0.02] transition-colors"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {turns.map((t, i) => (
                <div key={i}>
                  {t.role === "user" ? (
                    <div className="flex justify-end">
                      <div className="bg-[#0a0a0a] text-[#f1eee7] px-4 py-2.5 text-sm leading-[1.5] max-w-[80%]">
                        {t.content}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="text-sm leading-[1.6] text-[#0a0a0a] whitespace-pre-wrap">
                        {t.content}
                        {streaming && i === turns.length - 1 && (
                          <span className="inline-block w-2 h-4 bg-[#0a0a0a] ml-1 align-middle animate-pulse" />
                        )}
                      </div>
                      {t.citations && t.citations.length > 0 && (
                        <div className="space-y-2 pt-2">
                          <div className="text-[10px] uppercase tracking-[0.22em] text-[#0a0a0a]/55 font-mono">
                            Sources
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {dedupeCitations(t.citations).slice(0, 4).map((c, j) => (
                              <a
                                key={j}
                                href={`${GITHUB_DOCS}/${c.doc_path}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block border border-[#0a0a0a]/15 px-3 py-2 hover:border-[#0a0a0a] hover:bg-[#0a0a0a]/[0.02] transition-colors"
                              >
                                <div className="text-[10px] uppercase tracking-[0.18em] text-[#0a0a0a]/55 font-mono mb-1 truncate">
                                  {c.doc_path}
                                </div>
                                <div className="text-[11px] text-[#0a0a0a]/75 line-clamp-2 leading-snug">
                                  {c.cited_text.slice(0, 140)}{c.cited_text.length > 140 ? "…" : ""}
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
                <div className="border border-red-700/30 bg-red-50 text-red-900 text-sm px-3 py-2 font-mono">
                  Error: {error}
                </div>
              )}
            </div>

            {/* Input */}
            <div className="border-t border-[#0a0a0a]/15 px-6 py-4">
              <form
                onSubmit={(e) => { e.preventDefault(); submit(); }}
                className="flex gap-2"
              >
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={streaming}
                  placeholder="Ask us anything…"
                  className="flex-1 bg-transparent border-b border-[#0a0a0a]/30 py-2 text-sm focus:outline-none focus:border-[#0a0a0a] disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || streaming}
                  className="bg-[#0a0a0a] text-[#f1eee7] px-5 py-2 text-[10px] uppercase tracking-[0.22em] hover:bg-[#1a1a1a] disabled:opacity-40"
                >
                  {streaming ? "…" : "Ask"}
                </button>
              </form>
              <div className="text-[10px] text-[#0a0a0a]/55 mt-2 font-mono">
                AI can make mistakes. Verify with the docs linked above.
              </div>
            </div>
          </div>
        </div>
      )}
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
