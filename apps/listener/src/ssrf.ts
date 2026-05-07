const RFC1918 = [
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
];
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1", "0.0.0.0"]);

export function isSafeWebhookUrl(url: string, network: "testnet" | "mainnet"): boolean {
  let parsed: URL;
  try { parsed = new URL(url); } catch { return false; }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
  if (network === "mainnet" && parsed.protocol !== "https:") return false;

  const host = parsed.hostname.toLowerCase();
  if (network === "mainnet") {
    if (LOCAL_HOSTS.has(host)) return false;
    if (RFC1918.some(re => re.test(host))) return false;
  }
  return true;
}
