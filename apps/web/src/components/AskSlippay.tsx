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

const QUICK_PROMPTS: Array<{ tag: string; prompt: string }> = [
  { tag: "pricing",     prompt: "How much does it cost to use slippay?" },
  { tag: "on-chain",    prompt: "What's deployed on Stellar testnet?" },
  { tag: "integration", prompt: "How do I integrate the SDK in 5 minutes?" },
  { tag: "regulatory",  prompt: "Why partnership with a VASP?" },
  { tag: "br-export",   prompt: "Como o slippay reduz o leakage de 6% do Stripe?" },
  { tag: "soroban",     prompt: "How does the subscription contract work on-chain?" },
];

// bluewave design tokens (matching bluewaveai.online)
const BONE = "#EFE9DD";
const INK  = "#1A1A17";
const KLEIN = "#b5e853";

export function AskSlippay() {
  const [open, setOpen] = useState(false);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 250);
  }, [open]);

  useEffect(() => {
    bodyRef.current?.scrollTo({ top: bodyRef.current.scrollHeight, behavior: "smooth" });
  }, [turns]);

  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // ⌘K / ctrl+K → toggle open
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(o => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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

  // Parse inline [docs/path.md] markers from streamed text. We render the
  // raw text + footer cards; inline rendering would interrupt streaming.
  function parseInlineCitations(text: string): string {
    // strip the markdown ## Sources footer from displayed body (cards show it)
    const sourcesIdx = text.search(/\n##\s+sources?/i);
    return sourcesIdx >= 0 ? text.slice(0, sourcesIdx).trimEnd() : text;
  }

  return (
    <>
      {/* Floating launcher — bluewave-style chip */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          style={{ background: INK, color: BONE }}
          className="fixed bottom-6 right-6 z-50 px-4 py-3 flex items-center gap-3 hover:opacity-95 transition-opacity shadow-[0_4px_20px_rgba(26,26,23,0.25)]"
          aria-label="Ask Slippay"
        >
          <span style={{ background: KLEIN }} className="inline-block w-1.5 h-1.5" />
          <span className="text-[10px] uppercase tracking-[0.28em]" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            Ask
          </span>
          <span className="text-[10px] tracking-[0.18em] hidden md:inline opacity-40 border-l border-current/15 pl-3" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            ⌘K
          </span>
        </button>
      )}

      {/* Backdrop */}
      <div
        onClick={() => setOpen(false)}
        className={`fixed inset-0 z-40 transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        style={{ background: `${INK}99`, backdropFilter: "blur(8px)" }}
      />

      {/* Side panel — slides in from right */}
      <aside
        style={{ background: BONE, color: INK }}
        className={`fixed top-0 right-0 bottom-0 z-50 w-full md:w-[560px] flex flex-col transition-transform duration-300 ease-out ${open ? "translate-x-0" : "translate-x-full"}`}
      >
        {/* INK header bar */}
        <div style={{ background: INK, color: BONE }} className="px-7 pt-7 pb-6 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 text-[10px] uppercase tracking-[0.28em] opacity-60" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              <span style={{ background: KLEIN }} className="inline-block w-1 h-1" />
              <span>concierge · ssl v7</span>
              <span className="opacity-40">·</span>
              <span>fleet 001</span>
            </div>
            <h2 className="mt-3 text-[28px] md:text-[34px] leading-none tracking-[-0.02em] font-medium" style={{ fontFamily: "'Space Grotesk', 'Inter', sans-serif" }}>
              Ask SlipPay
            </h2>
            <div className="mt-2 text-[11px] tracking-tight opacity-55 max-w-[42ch]" style={{ fontFamily: "'Inter', sans-serif" }}>
              doc-grounded · cites every claim · says "i don't know" when it doesn't.
            </div>
          </div>
          <button
            onClick={() => setOpen(false)}
            className="text-2xl leading-none opacity-50 hover:opacity-100 transition-opacity"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div ref={bodyRef} className="flex-1 overflow-y-auto">
          {turns.length === 0 && (
            <div className="px-7 py-8 space-y-8">
              <div className="space-y-1">
                <div className="text-[9px] uppercase tracking-[0.30em] opacity-50" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                  // 001 · suggested
                </div>
              </div>
              <div className="-mx-7">
                {QUICK_PROMPTS.map(({ tag, prompt }, i) => (
                  <button
                    key={prompt}
                    onClick={() => submit(prompt)}
                    className={`w-full px-7 py-4 text-left hover:bg-black/[0.04] transition-colors group ${i !== 0 ? "border-t" : ""}`}
                    style={{ borderColor: `${INK}1A` }}
                  >
                    <div className="flex items-baseline gap-3 mb-1.5">
                      <span style={{ background: KLEIN }} className="inline-block w-1 h-1 translate-y-[-2px]" />
                      <span className="text-[9px] uppercase tracking-[0.26em] opacity-50" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                        {tag}
                      </span>
                    </div>
                    <div className="text-[14px] leading-[1.45] tracking-tight pl-4 group-hover:opacity-100" style={{ fontFamily: "'Inter', sans-serif" }}>
                      {prompt}
                    </div>
                  </button>
                ))}
                <div className="border-t" style={{ borderColor: `${INK}1A` }} />
              </div>
              <div className="text-[10px] opacity-40 tracking-tight" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                or type your own ↓
              </div>
            </div>
          )}

          {turns.length > 0 && (
            <div className="px-7 py-7 space-y-8">
              {turns.map((t, i) => (
                <div key={i}>
                  {t.role === "user" ? (
                    <div className="space-y-2">
                      <div className="text-[9px] uppercase tracking-[0.28em] opacity-50" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                        // you
                      </div>
                      <div className="text-[15px] leading-[1.55] tracking-tight" style={{ fontFamily: "'Inter', sans-serif" }}>
                        {t.content}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-baseline gap-2 text-[9px] uppercase tracking-[0.28em] opacity-50" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                        <span style={{ background: KLEIN }} className="inline-block w-1 h-1" />
                        <span>concierge</span>
                      </div>
                      <div className="text-[15px] leading-[1.65] whitespace-pre-wrap tracking-tight" style={{ fontFamily: "'Inter', sans-serif" }}>
                        {parseInlineCitations(t.content)}
                        {streaming && i === turns.length - 1 && (
                          <span style={{ background: INK }} className="inline-block w-[2px] h-[16px] ml-0.5 align-middle animate-pulse" />
                        )}
                      </div>
                      {t.citations && t.citations.length > 0 && (
                        <div className="pt-5 -mx-7">
                          <div className="px-7 pb-2 text-[9px] uppercase tracking-[0.30em] opacity-50" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                            // sources
                          </div>
                          <div className="border-t" style={{ borderColor: `${INK}1A` }}>
                            {dedupeCitations(t.citations).slice(0, 5).map((c, j) => (
                              <a
                                key={j}
                                href={`${GITHUB_DOCS}/${c.doc_path}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="block px-7 py-3 hover:bg-black/[0.04] transition-colors group border-b"
                                style={{ borderColor: `${INK}1A` }}
                              >
                                <div className="flex items-baseline gap-3 mb-1">
                                  <span className="text-[9px] tabular-nums opacity-40" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                                    {String(j + 1).padStart(2, "0")}
                                  </span>
                                  <span className="text-[10px] uppercase tracking-[0.22em] opacity-70 font-medium truncate flex-1" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
                                    {c.doc_path}
                                  </span>
                                  <span className="opacity-30 group-hover:opacity-100 transition-opacity text-xs">↗</span>
                                </div>
                                <div className="text-[12px] leading-[1.5] opacity-70 line-clamp-2 pl-[26px]" style={{ fontFamily: "'Inter', sans-serif" }}>
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
                <div className="border px-4 py-3 text-[12px]" style={{ borderColor: "#b91c1c", background: "#fef2f2", color: "#7f1d1d", fontFamily: "'JetBrains Mono', monospace" }}>
                  <div className="text-[9px] uppercase tracking-[0.22em] mb-1 opacity-70">// error</div>
                  {error}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Input — terminal-style */}
        <div className="border-t" style={{ borderColor: `${INK}26` }}>
          <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="px-7 pt-4 pb-2">
            <div className="flex items-baseline gap-3 text-[9px] uppercase tracking-[0.30em] opacity-50 mb-2" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
              <span style={{ background: KLEIN }} className="inline-block w-1 h-1" />
              <span>// your question</span>
            </div>
            <div className="flex items-end gap-3">
              <div className="flex-1 flex items-start gap-2">
                <span className="text-[14px] leading-[1.5] pt-[3px] opacity-40 select-none" style={{ fontFamily: "'JetBrains Mono', monospace" }}>›</span>
                <textarea
                  ref={inputRef}
                  rows={1}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    // auto-grow up to 4 rows
                    const ta = e.target;
                    ta.style.height = "auto";
                    ta.style.height = `${Math.min(ta.scrollHeight, 96)}px`;
                  }}
                  onKeyDown={onKey}
                  disabled={streaming}
                  placeholder="what's deployed, what's the fee, how do I integrate"
                  className="flex-1 bg-transparent border-0 py-1 text-[14px] tracking-tight resize-none focus:outline-none disabled:opacity-50 placeholder:opacity-30"
                  style={{ fontFamily: "'Inter', sans-serif", minHeight: "26px" }}
                />
              </div>
              <button
                type="submit"
                disabled={!input.trim() || streaming}
                style={{ background: INK, color: BONE, fontFamily: "'JetBrains Mono', monospace" }}
                className="px-5 py-2.5 text-[10px] uppercase tracking-[0.26em] hover:opacity-90 disabled:opacity-25 disabled:cursor-not-allowed flex items-center gap-2 self-end whitespace-nowrap"
              >
                {streaming ? (
                  <>
                    <span style={{ background: KLEIN }} className="inline-block w-1 h-1 animate-pulse" />
                    thinking
                  </>
                ) : (
                  <>
                    <span style={{ background: KLEIN }} className="inline-block w-1 h-1" />
                    ask  ↵
                  </>
                )}
              </button>
            </div>
          </form>
          <div className="px-7 pb-3 pt-1 flex items-center justify-between text-[9px] uppercase tracking-[0.24em] opacity-35" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
            <span>verify with cited docs</span>
            <span className="hidden md:inline">↵ send · ⇧↵ newline · esc close</span>
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
