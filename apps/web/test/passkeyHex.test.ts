import { describe, it, expect } from "vitest";
import { hexToBytesSafe } from "../src/lib/passkeyHex.ts";

describe("hexToBytesSafe", () => {
  it("round-trips a known credential id", () => {
    const bytes = hexToBytesSafe("0a1b2c");
    expect(Array.from(bytes)).toEqual([0x0a, 0x1b, 0x2c]);
  });
  it("accepts a 0x prefix", () => {
    expect(Array.from(hexToBytesSafe("0xff00"))).toEqual([255, 0]);
  });
  it("rejects odd-length hex (would silently truncate a key)", () => {
    expect(() => hexToBytesSafe("abc")).toThrow();
  });
  it("rejects non-hex chars (never coerce garbage into a signature input)", () => {
    expect(() => hexToBytesSafe("zz")).toThrow();
  });
  it("handles empty as empty", () => {
    expect(hexToBytesSafe("").length).toBe(0);
  });
});
