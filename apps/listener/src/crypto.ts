const TOLERANCE_S = 300;

export async function signWebhook(secret: string, body: string, t: number): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const data = enc.encode(`${t}.${body}`);
  const buf = await crypto.subtle.sign("HMAC", key, data);
  const hex = [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2,"0")).join("");
  return `t=${t},v1=${hex}`;
}

export async function verifyWebhook(secret: string, body: string, header: string, nowSec: number): Promise<boolean> {
  const parts = Object.fromEntries(header.split(",").map(p => p.split("=") as [string, string]));
  const t = Number(parts.t);
  if (!isFinite(t) || Math.abs(nowSec - t) > TOLERANCE_S) return false;
  const expected = await signWebhook(secret, body, t);
  if (expected.length !== header.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ header.charCodeAt(i);
  return diff === 0;
}
