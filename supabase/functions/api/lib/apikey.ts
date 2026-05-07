import { API_KEY_PREFIX, API_KEY_BYTES } from "@slippay/shared";

export function generateApiKey(): { plain: string } {
  const bytes = new Uint8Array(API_KEY_BYTES);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, "0")).join("");
  return { plain: API_KEY_PREFIX + hex };
}

export async function hashApiKey(plain: string): Promise<string> {
  const data = new TextEncoder().encode(plain);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

export async function verifyApiKey(plain: string, hash: string): Promise<boolean> {
  const computed = await hashApiKey(plain);
  if (computed.length !== hash.length) return false;
  let diff = 0;
  for (let i = 0; i < computed.length; i++) {
    diff |= computed.charCodeAt(i) ^ hash.charCodeAt(i);
  }
  return diff === 0;
}

export function prefixOf(plain: string, n = 16): string {
  return plain.slice(0, n);
}
