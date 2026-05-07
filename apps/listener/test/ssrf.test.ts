import { describe, it, expect } from "vitest";
import { isSafeWebhookUrl } from "../src/ssrf.js";

describe("isSafeWebhookUrl", () => {
  it("accepts https URLs to public hosts", () => {
    expect(isSafeWebhookUrl("https://example.com/wh", "mainnet")).toBe(true);
  });

  it("rejects http on mainnet", () => {
    expect(isSafeWebhookUrl("http://example.com/wh", "mainnet")).toBe(false);
  });

  it("allows http on testnet (dev convenience)", () => {
    expect(isSafeWebhookUrl("http://example.com/wh", "testnet")).toBe(true);
  });

  it("rejects RFC1918 destinations on mainnet", () => {
    for (const url of ["http://10.0.0.1/wh", "https://192.168.1.1/wh", "https://172.16.0.5/wh"]) {
      expect(isSafeWebhookUrl(url, "mainnet")).toBe(false);
    }
  });

  it("rejects localhost on mainnet", () => {
    expect(isSafeWebhookUrl("https://localhost/wh", "mainnet")).toBe(false);
    expect(isSafeWebhookUrl("https://127.0.0.1/wh", "mainnet")).toBe(false);
    expect(isSafeWebhookUrl("https://[::1]/wh", "mainnet")).toBe(false);
  });

  it("rejects malformed URLs", () => {
    expect(isSafeWebhookUrl("not a url", "mainnet")).toBe(false);
    expect(isSafeWebhookUrl("ftp://example.com", "mainnet")).toBe(false);
  });
});
