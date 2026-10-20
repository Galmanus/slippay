// Pix BR Code (EMV MPM) — the QR every Brazilian merchant shows at the counter.
// The scanned QR text IS the "copia e cola" payload, so a valid parse here can
// be fed straight into PagFinance's validateCode. We parse locally only to
// (a) detect "this QR is Pix, not a slippay: request" and (b) show who/how-much
// before any network call. PagFinance remains the authority on validity.
//
// EMV TLV: each field is ID(2) + LEN(2) + VALUE(len). Pix lives in a merchant
// account template (ID 26-51) whose sub-field 00 is the GUI "br.gov.bcb.pix".
// Amount is tag 54, merchant name 59, city 60, CRC-16/CCITT-FALSE is tag 63.

export interface PixBrCode {
  /** The raw payload — what PagFinance's validateCode expects. */
  raw: string;
  /** Fixed amount in BRL, or null for open-amount QRs ("pague quanto quiser"). */
  amountBRL: number | null;
  merchantName?: string;
  merchantCity?: string;
  /** Static key or dynamic payload URL, whichever the QR carries. */
  pixKey?: string;
  /** True when tag 63 checks out. A failed CRC is reported, not rejected —
   * some generators emit lowercase hex or recalculate poorly. */
  crcOk: boolean;
}

interface Tlv { id: string; value: string; }

function parseTlv(s: string): Tlv[] | null {
  const out: Tlv[] = [];
  let i = 0;
  while (i < s.length) {
    if (i + 4 > s.length) return null;
    const id = s.slice(i, i + 2);
    const len = Number(s.slice(i + 2, i + 4));
    if (!/^\d\d$/.test(s.slice(i + 2, i + 4))) return null;
    if (i + 4 + len > s.length) return null;
    out.push({ id, value: s.slice(i + 4, i + 4 + len) });
    i += 4 + len;
  }
  return out;
}

/** CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF) over the payload with the
 * 4-char CRC value replaced by nothing — i.e. everything up to and including
 * the "6304" tag+len. */
function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let b = 0; b < 8; b++) {
      crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

/** Fast pre-check: does this scanned text even look like an EMV/Pix payload? */
export function looksLikeBrCode(raw: string): boolean {
  return /^000201/.test(raw.trim());
}

/** Parse a scanned QR into a Pix BR Code, or null when it isn't one. */
export function parseBrCode(raw: string): PixBrCode | null {
  const s = raw.trim();
  if (!looksLikeBrCode(s)) return null;
  const fields = parseTlv(s);
  if (!fields) return null;

  // must carry the Pix GUI inside a merchant-account template (26-51)
  let pixKey: string | undefined;
  let isPix = false;
  for (const f of fields) {
    const n = Number(f.id);
    if (n < 26 || n > 51) continue;
    const sub = parseTlv(f.value);
    if (!sub) continue;
    const gui = sub.find((t) => t.id === "00")?.value ?? "";
    if (gui.toLowerCase() === "br.gov.bcb.pix") {
      isPix = true;
      // static QR: key in sub 01 · dynamic QR: payload URL in sub 25
      pixKey = sub.find((t) => t.id === "01")?.value ?? sub.find((t) => t.id === "25")?.value;
    }
  }
  if (!isPix) return null;

  const amountStr = fields.find((f) => f.id === "54")?.value;
  const amountBRL = amountStr !== undefined && /^\d+(\.\d{1,2})?$/.test(amountStr)
    ? Number(amountStr)
    : null;

  const crcField = fields.find((f) => f.id === "63")?.value ?? "";
  const crcIdx = s.lastIndexOf("6304");
  const crcOk = crcIdx >= 0 && crcField.toUpperCase() === crc16(s.slice(0, crcIdx + 4));

  return {
    raw: s,
    amountBRL,
    merchantName: fields.find((f) => f.id === "59")?.value,
    merchantCity: fields.find((f) => f.id === "60")?.value,
    pixKey,
    crcOk,
  };
}
