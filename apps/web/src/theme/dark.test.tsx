import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { TOKENS, Index } from "./dark.tsx";

describe("dark theme tokens", () => {
  it("uses the vault ink ground and bone text", () => {
    expect(TOKENS.ink).toBe("#0E0D0B");
    expect(TOKENS.bone).toBe("#F1EEE7");
  });
  it("accent is Slippay yellow, never Bluewave KLEIN", () => {
    expect(TOKENS.accent).toBe("#FDDA24");
    expect(Object.values(TOKENS).join(" ")).not.toMatch(/#002FA7|klein/i);
  });
});

describe("Index", () => {
  it("renders number + label", () => {
    const html = renderToStaticMarkup(<Index n="001" label="why" />);
    expect(html).toContain("001");
    expect(html).toContain("why");
  });
});
