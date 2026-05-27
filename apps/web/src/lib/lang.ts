import { useEffect, useState } from "react";

// Landing locale. Auto-detect from the browser on first visit (pt-* → pt,
// everything else → en) so international visitors land in English. Persisted
// in localStorage so a manual toggle sticks.
export type Lang = "pt" | "en";

const KEY = "slippay_lang";

export function detectLang(): Lang {
  if (typeof window === "undefined") return "pt";
  const stored = window.localStorage.getItem(KEY);
  if (stored === "pt" || stored === "en") return stored;
  return navigator.language?.toLowerCase().startsWith("pt") ? "pt" : "en";
}

export function useLang(): [Lang, (l: Lang) => void] {
  const [lang, setLangState] = useState<Lang>(() => detectLang());
  useEffect(() => {
    document.documentElement.lang = lang === "pt" ? "pt-BR" : "en";
  }, [lang]);
  const setLang = (l: Lang) => {
    try { window.localStorage.setItem(KEY, l); } catch { /* ignore */ }
    setLangState(l);
  };
  return [lang, setLang];
}
