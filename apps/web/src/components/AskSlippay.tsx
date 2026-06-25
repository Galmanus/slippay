import { useState, useRef, useEffect, useCallback } from "react";
import { marked } from "marked";
import DOMPurify from "dompurify";

// Render Concierge's streamed markdown as sanitized HTML so **bold**, lists,
// code blocks, and `inline code` actually format properly in the widget.
// marked is sync mode (no front-matter, no GFM tables needed mostly).
marked.setOptions({ gfm: true, breaks: true });

function renderMarkdown(src: string): string {
  const html = marked.parse(src, { async: false }) as string;
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: ["p", "strong", "em", "code", "pre", "ul", "ol", "li", "h1", "h2", "h3", "h4", "blockquote", "br", "a", "hr", "table", "thead", "tbody", "tr", "th", "td"],
    ALLOWED_ATTR: ["href", "target", "rel"],
  });
}

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
  { tag: "economia",   prompt: "Quanto eu economizo vs Stripe e MoonPay?" },
  { tag: "começar",    prompt: "Como começo a receber em dólar?" },
  { tag: "minha loja", prompt: "Funciona na minha loja (WooCommerce, Shopify)?" },
  { tag: "segurança",  prompt: "É seguro e legal no Brasil?" },
  { tag: "a taxa",     prompt: "Qual é a taxa? Tem pegadinha?" },
];

// design tokens — on-brand slippay palette
const BONE = "#f1eee7";
const INK  = "#0a0a0a";
const YELLOW = "#FDDA24";

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
      {/* Floating launcher button — bone pill, fixed bottom-right, visible always */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Pergunte à IA Slippay"
        style={{
          background: BONE,
          color: INK,
          border: `1.5px solid ${INK}`,
          bottom: "max(1.5rem, env(safe-area-inset-bottom, 1.5rem))",
          right: "max(1.5rem, env(safe-area-inset-right, 1.5rem))",
          fontFamily: "'Space Grotesk', 'Inter', sans-serif",
          boxShadow: "0 4px 24px rgba(10,10,10,0.18)",
          display: open ? "none" : undefined,
        }}
        className="fixed z-50 rounded-full px-4 py-3 md:px-5 md:py-3.5 flex items-center gap-2 md:gap-3 transition-all duration-200 active:scale-95 group"
      >
        {/* Chat bubble icon */}
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="shrink-0">
          <path d="M8 1.5C4.41 1.5 1.5 4.19 1.5 7.5c0 1.25.38 2.42 1.04 3.39L1.5 14.5l3.71-1.01A6.45 6.45 0 0 0 8 13.5c3.59 0 6.5-2.69 6.5-6S11.59 1.5 8 1.5Z" stroke={INK} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          <circle cx="5.5" cy="7.5" r="0.75" fill={INK}/>
          <circle cx="8" cy="7.5" r="0.75" fill={INK}/>
          <circle cx="10.5" cy="7.5" r="0.75" fill={INK}/>
        </svg>
        <span className="text-[12px] md:text-[13px] font-semibold tracking-tight">
          Pergunte à IA
        </span>
        {/* ⌘K badge — desktop only, on hover */}
        <span
          className="hidden md:inline-flex items-center text-[10px] tracking-widest opacity-0 group-hover:opacity-40 transition-opacity duration-200 border border-current/20 rounded px-1.5 py-0.5 ml-1"
          style={{ fontFamily: "'Space Grotesk', monospace" }}
        >
          ⌘K
        </span>
      </button>

      {/* Mobile backdrop */}
      <div
        onClick={() => setOpen(false)}
        className={`md:hidden fixed inset-0 z-40 transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        style={{ background: `${INK}80`, backdropFilter: "blur(4px)" }}
      />

      {/* Desktop backdrop */}
      <div
        onClick={() => setOpen(false)}
        className={`hidden md:block fixed inset-0 z-40 transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0 pointer-events-none"}`}
        style={{ background: `${INK}40` }}
      />

      {/* === DESKTOP PANEL (md+): bottom-right corner popup === */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Slippay AI"
        style={{
          background: BONE,
          color: INK,
          bottom: "6rem",
          right: "1.5rem",
          width: "400px",
          height: "min(600px, calc(100vh - 13rem))",
          border: `1px solid ${INK}1A`,
        }}
        className={`hidden md:flex fixed z-50 rounded-2xl shadow-2xl flex-col overflow-hidden transition-all duration-300 origin-bottom-right ${open ? "opacity-100 translate-y-0 scale-100" : "opacity-0 translate-y-2 scale-95 pointer-events-none"}`}
      >
        {/* Header — ink bar */}
        <div
          className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ background: INK }}
        >
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: YELLOW }} />
            <span
              className="text-[15px] font-semibold tracking-tight text-white"
              style={{ fontFamily: "'Space Grotesk', 'Inter', sans-serif" }}
            >
              Slippay AI
            </span>
          </div>
          <button
            onClick={() => setOpen(false)}
            aria-label="Fechar chat"
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors text-white/60 hover:text-white text-lg leading-none"
          >
            ×
          </button>
        </div>

        {/* Message area */}
        <div ref={bodyRef} className="flex-1 overflow-y-auto p-4 flex flex-col gap-3">
          {/* Empty state */}
          {turns.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-4 py-6 gap-5">
              <p
                className="text-[14px] leading-relaxed"
                style={{ color: `${INK}99`, fontFamily: "'Space Grotesk', 'Inter', sans-serif" }}
              >
                Sou a IA da Slippay — pergunta o que quiser sobre receber dólar, taxas, como começar.
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {QUICK_PROMPTS.map(({ tag, prompt }) => (
                  <button
                    key={prompt}
                    onClick={() => submit(prompt)}
                    className="px-3 py-1.5 rounded-full text-[11px] font-medium transition-colors duration-150 hover:text-[#0a0a0a]"
                    style={{
                      border: `1px solid ${INK}30`,
                      background: BONE,
                      color: INK,
                      fontFamily: "'Space Grotesk', 'Inter', sans-serif",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = YELLOW; e.currentTarget.style.borderColor = YELLOW; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = BONE; e.currentTarget.style.borderColor = `${INK}30`; }}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          {turns.length > 0 && turns.map((t, i) => (
            <div
              key={i}
              className={`flex ${t.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {t.role === "user" ? (
                <div
                  className="max-w-[80%] px-4 py-2.5 rounded-2xl rounded-tr-sm text-[13px] leading-relaxed"
                  style={{
                    background: INK,
                    color: "#fff",
                    fontFamily: "'Space Grotesk', 'Inter', sans-serif",
                  }}
                >
                  {t.content}
                </div>
              ) : (
                <div className="max-w-[90%] flex flex-col gap-2">
                  <div className="flex items-start gap-2">
                    <span className="mt-1 w-2 h-2 rounded-full shrink-0" style={{ background: YELLOW }} />
                    <div className="flex flex-col gap-1 flex-1">
                      {streaming && i === turns.length - 1 && !t.content ? (
                        <ThinkingIndicator />
                      ) : (
                        <>
                          <div
                            className="ask-md text-[13px] leading-[1.65] px-3 py-2.5 rounded-2xl rounded-tl-sm"
                            style={{
                              background: `${INK}08`,
                              fontFamily: "'Space Grotesk', 'Inter', sans-serif",
                              borderLeft: `2px solid ${YELLOW}`,
                            }}
                            dangerouslySetInnerHTML={{ __html: renderMarkdown(parseInlineCitations(t.content)) }}
                          />
                          {streaming && i === turns.length - 1 && (
                            <span
                              className="inline-block w-[2px] h-[14px] ml-3 align-middle animate-pulse"
                              style={{ background: INK }}
                            />
                          )}
                        </>
                      )}
                      {/* Citations */}
                      {t.citations && t.citations.length > 0 && !streaming && (
                        <div className="mt-1 flex flex-col gap-1 pl-1">
                          {dedupeCitations(t.citations).slice(0, 5).map((c, j) => (
                            <a
                              key={j}
                              href={`${GITHUB_DOCS}/${c.doc_path}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1.5 text-[10px] hover:underline"
                              style={{ color: `${INK}60`, fontFamily: "'Space Grotesk', monospace" }}
                            >
                              <span style={{ color: YELLOW }}>↗</span>
                              <span className="truncate">{c.doc_path}</span>
                              {c.cited_text && (
                                <span className="opacity-60 line-clamp-1 flex-1">{c.cited_text.slice(0, 80)}{c.cited_text.length > 80 ? "…" : ""}</span>
                              )}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Error state */}
          {error && (
            <div
              className="rounded-xl px-4 py-3 text-[12px]"
              style={{
                background: "#fef2f2",
                border: "1px solid #fca5a5",
                color: "#7f1d1d",
                fontFamily: "'Space Grotesk', 'Inter', sans-serif",
              }}
            >
              Serviço temporariamente indisponível. Tente novamente em instantes.
            </div>
          )}
        </div>

        {/* Input area */}
        <div className="shrink-0 border-t p-3" style={{ borderColor: `${INK}15` }}>
          <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="flex items-end gap-2">
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
              aria-label="Sua pergunta"
              placeholder="quanto eu economizo? como começo?"
              className="flex-1 border rounded-xl px-3 py-2.5 text-[13px] resize-none focus:outline-none disabled:opacity-50 placeholder:opacity-40"
              style={{
                background: "rgba(255,255,255,0.6)",
                border: `1px solid ${INK}20`,
                fontFamily: "'Space Grotesk', 'Inter', sans-serif",
                minHeight: "40px",
                color: INK,
              }}
            />
            <button
              type="submit"
              disabled={!input.trim() || streaming}
              aria-label="Enviar pergunta"
              className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center transition-colors duration-150 disabled:opacity-30 disabled:cursor-not-allowed"
              style={{ background: YELLOW }}
            >
              {streaming ? (
                <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: INK }} />
              ) : (
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M2 8h12M9 3l5 5-5 5" stroke={INK} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </button>
          </form>
          <div
            className="mt-1.5 text-[10px] text-center opacity-30"
            style={{ fontFamily: "'Space Grotesk', monospace", color: INK }}
          >
            ↵ enviar · ⇧↵ linha · esc fechar
          </div>
        </div>
      </aside>

      {/* === MOBILE PANEL (< md): full-screen overlay === */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Slippay AI"
        style={{ background: BONE, color: INK }}
        className={`md:hidden fixed inset-0 z-50 flex flex-col transition-all duration-300 ${open ? "opacity-100 translate-y-0" : "opacity-0 translate-y-full pointer-events-none"}`}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 shrink-0"
          style={{ background: INK }}
        >
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: YELLOW }} />
            <span
              className="text-[16px] font-semibold tracking-tight text-white"
              style={{ fontFamily: "'Space Grotesk', 'Inter', sans-serif" }}
            >
              Slippay AI
            </span>
          </div>
          <button
            onClick={() => setOpen(false)}
            aria-label="Fechar chat"
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/10 transition-colors text-white/60 hover:text-white text-xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Message area — flex-1 + pb for safe-area */}
        <div
          ref={bodyRef}
          className="flex-1 overflow-y-auto p-4 flex flex-col gap-3"
          style={{ paddingBottom: "env(safe-area-inset-bottom, 16px)" }}
        >
          {/* Empty state */}
          {turns.length === 0 && (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-4 py-8 gap-6">
              <p
                className="text-[15px] leading-relaxed"
                style={{ color: `${INK}99`, fontFamily: "'Space Grotesk', 'Inter', sans-serif" }}
              >
                Sou a IA da Slippay — pergunta o que quiser sobre receber dólar, taxas, como começar.
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {QUICK_PROMPTS.map(({ tag, prompt }) => (
                  <button
                    key={prompt}
                    onClick={() => submit(prompt)}
                    className="min-h-[44px] px-4 py-2 rounded-full text-[12px] font-medium border transition-colors duration-150"
                    style={{
                      border: `1px solid ${INK}30`,
                      background: BONE,
                      color: INK,
                      fontFamily: "'Space Grotesk', 'Inter', sans-serif",
                    }}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          {turns.length > 0 && turns.map((t, i) => (
            <div
              key={i}
              className={`flex ${t.role === "user" ? "justify-end" : "justify-start"}`}
            >
              {t.role === "user" ? (
                <div
                  className="max-w-[80%] px-4 py-3 rounded-2xl rounded-tr-sm text-[14px] leading-relaxed"
                  style={{
                    background: INK,
                    color: "#fff",
                    fontFamily: "'Space Grotesk', 'Inter', sans-serif",
                  }}
                >
                  {t.content}
                </div>
              ) : (
                <div className="max-w-[90%] flex flex-col gap-2">
                  <div className="flex items-start gap-2">
                    <span className="mt-2 w-2 h-2 rounded-full shrink-0" style={{ background: YELLOW }} />
                    <div className="flex flex-col gap-1 flex-1">
                      {streaming && i === turns.length - 1 && !t.content ? (
                        <ThinkingIndicator />
                      ) : (
                        <>
                          <div
                            className="ask-md text-[14px] leading-[1.65] px-4 py-3 rounded-2xl rounded-tl-sm"
                            style={{
                              background: `${INK}08`,
                              fontFamily: "'Space Grotesk', 'Inter', sans-serif",
                              borderLeft: `2px solid ${YELLOW}`,
                            }}
                            dangerouslySetInnerHTML={{ __html: renderMarkdown(parseInlineCitations(t.content)) }}
                          />
                          {streaming && i === turns.length - 1 && (
                            <span
                              className="inline-block w-[2px] h-[16px] ml-4 align-middle animate-pulse"
                              style={{ background: INK }}
                            />
                          )}
                        </>
                      )}
                      {/* Citations */}
                      {t.citations && t.citations.length > 0 && !streaming && (
                        <div className="mt-1 flex flex-col gap-1 pl-2">
                          {dedupeCitations(t.citations).slice(0, 5).map((c, j) => (
                            <a
                              key={j}
                              href={`${GITHUB_DOCS}/${c.doc_path}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1.5 text-[11px] min-h-[44px] hover:underline"
                              style={{ color: `${INK}60`, fontFamily: "'Space Grotesk', monospace" }}
                            >
                              <span style={{ color: YELLOW }}>↗</span>
                              <span className="truncate">{c.doc_path}</span>
                            </a>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Error state */}
          {error && (
            <div
              className="rounded-xl px-4 py-3 text-[13px]"
              style={{
                background: "#fef2f2",
                border: "1px solid #fca5a5",
                color: "#7f1d1d",
                fontFamily: "'Space Grotesk', 'Inter', sans-serif",
              }}
            >
              Serviço temporariamente indisponível. Tente novamente em instantes.
            </div>
          )}
        </div>

        {/* Input area — sticky bottom, safe-area aware */}
        <div
          className="shrink-0 border-t p-3 pt-2"
          style={{
            borderColor: `${INK}15`,
            paddingBottom: "max(0.75rem, env(safe-area-inset-bottom, 0.75rem))",
          }}
        >
          <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                const ta = e.target;
                ta.style.height = "auto";
                ta.style.height = `${Math.min(ta.scrollHeight, 96)}px`;
              }}
              onKeyDown={onKey}
              disabled={streaming}
              aria-label="Sua pergunta"
              placeholder="quanto eu economizo? como começo?"
              className="flex-1 border rounded-xl px-3 py-3 text-[14px] resize-none focus:outline-none disabled:opacity-50 placeholder:opacity-40"
              style={{
                background: "rgba(255,255,255,0.6)",
                border: `1px solid ${INK}20`,
                fontFamily: "'Space Grotesk', 'Inter', sans-serif",
                minHeight: "48px",
                color: INK,
              }}
            />
            <button
              type="submit"
              disabled={!input.trim() || streaming}
              aria-label="Enviar pergunta"
              className="shrink-0 w-12 h-12 rounded-xl flex items-center justify-center transition-colors duration-150 disabled:opacity-30 disabled:cursor-not-allowed"
              style={{ background: YELLOW }}
            >
              {streaming ? (
                <span className="w-2.5 h-2.5 rounded-full animate-pulse" style={{ background: INK }} />
              ) : (
                <svg width="18" height="18" viewBox="0 0 16 16" fill="none">
                  <path d="M2 8h12M9 3l5 5-5 5" stroke={INK} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </button>
          </form>
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

// "Thinking…" indicator shown while the Concierge spawn is initializing
// and before the first token streams. Rotates through 5 status phrases so
// the user knows something is happening even on a 4-5s cold start.
function ThinkingIndicator() {
  const phrases = [
    "lendo a documentação",
    "buscando a resposta certa",
    "conferindo os detalhes",
    "montando a resposta",
  ];
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setIdx(i => (i + 1) % phrases.length), 1400);
    return () => clearInterval(id);
  }, []);
  return (
    <div
      className="flex items-center gap-2 px-3 py-2.5 rounded-2xl rounded-tl-sm"
      style={{ background: `${INK}08`, borderLeft: `2px solid ${YELLOW}` }}
    >
      <div className="flex items-center gap-1">
        <span className="w-1.5 h-1.5 rounded-full" style={{ background: YELLOW, animation: "ask-pulse 1.2s ease-in-out infinite" }} />
        <span className="w-1.5 h-1.5 rounded-full opacity-60" style={{ background: YELLOW, animation: "ask-pulse 1.2s ease-in-out infinite 0.2s" }} />
        <span className="w-1.5 h-1.5 rounded-full opacity-30" style={{ background: YELLOW, animation: "ask-pulse 1.2s ease-in-out infinite 0.4s" }} />
      </div>
      <span
        className="text-[11px] italic"
        style={{ color: `${INK}55`, fontFamily: "'Space Grotesk', 'Inter', sans-serif" }}
      >
        {phrases[idx]}…
      </span>
      <style>{`
        @keyframes ask-pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(0.6); opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}
