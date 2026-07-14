// SlipPay × Shopify — connector.
//
// Two integration paths on one server:
//
// A) USABLE TODAY (no Shopify approval needed) — "custom app + manual payment":
//    1. Merchant creates a custom app in their Shopify admin (no review) and a
//       manual payment method named "SlipPay" at checkout.
//    2. Shopify POSTs orders/create here (/shopify/orders-create, HMAC-verified)
//       → we create a SlipPay order (external_ref = shopify order id).
//    3. Buyer follows the static instruction link /shopify/pay/<order_number>
//       → 302 to the SlipPay checkout_url.
//    4. SlipPay listener POSTs order.paid here (/shopify/slippay-webhook,
//       x-slippay-signature verified) → we mark the Shopify order paid via the
//       Admin API transactions endpoint.
//
// B) Payments App path (/payment_sessions etc.) — kept for the future official
//    Shopify Payments App (Partner review is an external gate, not code).
//
// State is persisted to STATE_FILE (JSON) so a restart doesn't orphan pending
// orders. Zero deps, node 18+.
//
// Run: SLIPPAY_API_KEY=sk_... SHOPIFY_WEBHOOK_SECRET=... node src/index.mjs

import http from "node:http";
import { createHmac, timingSafeEqual, randomUUID } from "node:crypto";
import { readFileSync, writeFileSync, renameSync } from "node:fs";

const PORT = Number(process.env.PORT ?? 4001);
const SLIPPAY_API_BASE = process.env.SLIPPAY_API_BASE ?? "https://api.slippay.cc";
const SLIPPAY_API_KEY = process.env.SLIPPAY_API_KEY ?? "";
// Merchant webhook secret from the SlipPay dashboard (signs order.paid).
const SLIPPAY_WEBHOOK_SECRET = process.env.SLIPPAY_WEBHOOK_SECRET ?? "";
// Custom app "API secret key" from the merchant's Shopify admin (signs webhooks).
const SHOPIFY_WEBHOOK_SECRET = process.env.SHOPIFY_WEBHOOK_SECRET ?? "";
const SHOP = process.env.SHOPIFY_SHOP ?? "";            // my-store.myshopify.com
const SHOP_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN ?? ""; // custom app Admin API token
const SHOPIFY_API_VERSION = process.env.SHOPIFY_API_VERSION ?? "2024-10";
// Manual payment methods whose orders we handle (substring match, lowercase).
const GATEWAY_MATCH = (process.env.SLIPPAY_GATEWAY_MATCH ?? "slippay").toLowerCase();
const STATE_FILE = process.env.STATE_FILE ?? "./shopify-connector-state.json";
const WEBHOOK_TOLERANCE_S = 300;

// ---------- state (persisted map: shopify order/session → slippay order) ----------
function loadState() {
  try { return JSON.parse(readFileSync(STATE_FILE, "utf8")); } catch { return { orders: {}, sessions: {} }; }
}
const state = loadState();
function saveState() {
  const tmp = `${STATE_FILE}.tmp`;
  writeFileSync(tmp, JSON.stringify(state, null, 2));
  renameSync(tmp, STATE_FILE);
}

// ---------- helpers ----------
const json = (res, code, body) => {
  res.writeHead(code, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
};
async function readRawBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks);
}
const parse = (buf) => { try { return JSON.parse(buf.toString("utf8")); } catch { return {}; } };

function safeEqual(a, b) {
  const ba = Buffer.from(a), bb = Buffer.from(b);
  if (ba.length !== bb.length) { timingSafeEqual(ba, ba); return false; }
  return timingSafeEqual(ba, bb);
}

// Shopify webhook HMAC: base64(HMAC-SHA256(secret, raw body)).
function verifyShopifyHmac(rawBody, header) {
  if (!SHOPIFY_WEBHOOK_SECRET) return false;
  const digest = createHmac("sha256", SHOPIFY_WEBHOOK_SECRET).update(rawBody).digest("base64");
  return safeEqual(digest, header ?? "");
}

// SlipPay webhook signature: "t=<sec>,v1=<hex hmac over `${t}.${body}`>".
function verifySlippaySig(rawBody, header) {
  if (!SLIPPAY_WEBHOOK_SECRET || !header) return false;
  const parts = Object.fromEntries(header.split(",").map(p => p.split("=")));
  const t = Number(parts.t);
  if (!isFinite(t) || Math.abs(Math.floor(Date.now() / 1000) - t) > WEBHOOK_TOLERANCE_S) return false;
  const hex = createHmac("sha256", SLIPPAY_WEBHOOK_SECRET).update(`${t}.${rawBody.toString("utf8")}`).digest("hex");
  return safeEqual(`t=${t},v1=${hex}`, header);
}

async function createSlippayOrder({ apiKey, amount, externalRef }) {
  const r = await fetch(`${SLIPPAY_API_BASE}/api/v1/orders`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ brl_amount: Number(amount).toFixed(2), external_ref: externalRef }),
  });
  const data = await r.json().catch(() => ({}));
  if (r.status !== 201) throw new Error(`slippay ${r.status}: ${JSON.stringify(data)}`);
  return data;
}

async function shopifyAdmin(path, method = "GET", body) {
  if (!SHOP || !SHOP_TOKEN) return { skipped: "no SHOPIFY_SHOP/ACCESS_TOKEN" };
  const r = await fetch(`https://${SHOP}/admin/api/${SHOPIFY_API_VERSION}${path}`, {
    method,
    headers: { "content-type": "application/json", "X-Shopify-Access-Token": SHOP_TOKEN },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json().catch(() => ({}));
  return { status: r.status, data };
}

// Mark a manual-payment order as paid: capture the pending transaction, falling
// back to a plain sale transaction if the shop has nothing to capture.
async function markShopifyOrderPaid(orderId, { amount, currency, txHash }) {
  let out = await shopifyAdmin(`/orders/${orderId}/transactions.json`, "POST", {
    transaction: { kind: "capture", status: "success" },
  });
  if (out.status >= 400) {
    out = await shopifyAdmin(`/orders/${orderId}/transactions.json`, "POST", {
      transaction: { kind: "sale", status: "success", amount, currency, source: "external" },
    });
  }
  if (txHash) {
    await shopifyAdmin(`/orders/${orderId}.json`, "PUT", {
      order: { id: orderId, note_attributes: [{ name: "slippay_tx", value: txHash }] },
    });
  }
  return out;
}

// Legacy Payments App finalize (path B).
async function resolveShopifySession(sessionId) {
  if (!SHOP || !SHOP_TOKEN) return { skipped: "no SHOPIFY_SHOP/ACCESS_TOKEN (test mode)" };
  const q = `mutation { paymentSessionResolve(id: "${sessionId}") { paymentSession { id status { code } } userErrors { field message } } }`;
  const r = await fetch(`https://${SHOP}/payments_apps/api/${SHOPIFY_API_VERSION}/graphql.json`, {
    method: "POST",
    headers: { "content-type": "application/json", "X-Shopify-Access-Token": SHOP_TOKEN },
    body: JSON.stringify({ query: q }),
  });
  return r.json().catch(() => ({}));
}

// ---------- server ----------
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;

  // --- path A: Shopify orders/create webhook (custom app) ---
  if (req.method === "POST" && path === "/shopify/orders-create") {
    const raw = await readRawBody(req);
    if (!verifyShopifyHmac(raw, req.headers["x-shopify-hmac-sha256"])) {
      return json(res, 401, { error: "bad shopify hmac" });
    }
    const o = parse(raw);
    const gateways = (o.payment_gateway_names ?? []).map(g => String(g).toLowerCase());
    if (!gateways.some(g => g.includes(GATEWAY_MATCH))) {
      return json(res, 200, { ignored: "not a slippay order", gateways });
    }
    const key = String(o.id);
    if (state.orders[key]) return json(res, 200, { deduped: true }); // webhook redelivery
    try {
      const { order, checkout_url } = await createSlippayOrder({
        apiKey: SLIPPAY_API_KEY,
        amount: o.total_price,
        externalRef: `shopify:${o.id}`,
      });
      state.orders[key] = {
        shopifyOrderId: o.id,
        orderNumber: String(o.order_number ?? o.number ?? ""),
        name: o.name ?? "",                      // e.g. "#1001"
        amount: o.total_price,
        currency: o.currency,
        slippayOrderId: order.id,
        checkoutUrl: checkout_url,
        status: "pending",
        createdAt: new Date().toISOString(),
      };
      saveState();
      console.log(`[orders-create] shopify ${o.name} → slippay ${order.id}`);
      return json(res, 200, { ok: true, slippay_order: order.id });
    } catch (e) {
      console.error(`[orders-create] ${e.message ?? e}`);
      // 200 so Shopify doesn't retry forever on a permanent SlipPay error;
      // the failure is logged and visible in /health state count.
      return json(res, 200, { ok: false, error: String(e.message ?? e) });
    }
  }

  // --- path A: buyer payment link (from the manual method's static instructions) ---
  // /shopify/pay/<order_number>  (accepts "1001" or "#1001")
  if (req.method === "GET" && path.startsWith("/shopify/pay/")) {
    const wanted = decodeURIComponent(path.split("/").pop() ?? "").replace(/^#/, "");
    const hit = Object.values(state.orders).find(
      s => s.orderNumber === wanted || s.name === `#${wanted}` || String(s.shopifyOrderId) === wanted,
    );
    if (!hit) return json(res, 404, { error: "order not found (webhook may not have arrived yet — retry in a few seconds)" });
    res.writeHead(302, { location: hit.checkoutUrl });
    return res.end();
  }

  // --- path A: SlipPay order.paid → mark Shopify order paid ---
  if (req.method === "POST" && path === "/shopify/slippay-webhook") {
    const raw = await readRawBody(req);
    if (!verifySlippaySig(raw, req.headers["x-slippay-signature"])) {
      return json(res, 401, { error: "bad slippay signature" });
    }
    const b = parse(raw);
    if (b.type !== "order.paid") return json(res, 200, { received: true, ignored: b.type });
    const d = b.data ?? {};
    const hit = Object.entries(state.orders).find(([, s]) =>
      s.slippayOrderId === d.id || `shopify:${s.shopifyOrderId}` === d.external_ref);
    if (!hit) return json(res, 200, { received: true, unmatched: d.id });
    const [key, s] = hit;
    if (s.status === "paid") return json(res, 200, { received: true, deduped: true });
    const out = await markShopifyOrderPaid(s.shopifyOrderId, {
      amount: s.amount, currency: s.currency, txHash: d.tx_hash,
    });
    state.orders[key] = { ...s, status: "paid", txHash: d.tx_hash, paidAt: d.paid_at };
    saveState();
    console.log(`[order.paid] slippay ${d.id} → shopify ${s.name} marked paid (${out.status ?? "skipped"})`);
    return json(res, 200, { received: true, shopify: out });
  }

  // --- path B: Payments App flow (future official app) ---
  if (req.method === "POST" && path === "/payment_sessions") {
    const raw = await readRawBody(req);
    const b = parse(raw);
    const sessionId = b.id ?? b.gid ?? randomUUID();
    if (state.sessions[sessionId]) {
      return json(res, 201, { redirect_url: state.sessions[sessionId].checkoutUrl });
    }
    const amount = b.amount ?? b.payment?.amount;
    const apiKey = b.merchant_settings?.api_key || SLIPPAY_API_KEY;
    if (!apiKey) return json(res, 400, { error: "missing SlipPay api_key" });
    try {
      const { order, checkout_url } = await createSlippayOrder({ apiKey, amount, externalRef: `shopify-session:${sessionId}` });
      state.sessions[sessionId] = { slippayOrderId: order.id, status: "pending", checkoutUrl: checkout_url };
      saveState();
      return json(res, 201, { redirect_url: checkout_url, slippay_order: order.id });
    } catch (e) {
      return json(res, 422, { error: String(e.message ?? e) });
    }
  }
  if (req.method === "POST" && path === "/slippay-webhook") {
    const raw = await readRawBody(req);
    if (!verifySlippaySig(raw, req.headers["x-slippay-signature"])) {
      return json(res, 401, { error: "bad slippay signature" });
    }
    const b = parse(raw);
    if (b.type !== "order.paid") return json(res, 200, { received: true, ignored: b.type });
    const entry = Object.entries(state.sessions).find(([, s]) => s.slippayOrderId === b.data?.id);
    if (!entry) return json(res, 200, { received: true });
    const [sessionId, s] = entry;
    s.status = "resolved";
    saveState();
    const out = await resolveShopifySession(sessionId);
    return json(res, 200, { received: true, resolved: sessionId, shopify: out });
  }
  for (const kind of ["refund", "capture", "void"]) {
    if (req.method === "POST" && path === `/${kind}_sessions`) {
      const b = parse(await readRawBody(req));
      return json(res, 201, { id: b.id, code: `${kind}-acknowledged`, message: "non-custodial; settles on-chain at payment time" });
    }
  }

  if (req.method === "GET" && (path === "/health" || path === "/shopify/health")) {
    return json(res, 200, {
      ok: true,
      slippay: SLIPPAY_API_BASE,
      hasSlippayKey: Boolean(SLIPPAY_API_KEY),
      verifiesShopifyHmac: Boolean(SHOPIFY_WEBHOOK_SECRET),
      verifiesSlippaySig: Boolean(SLIPPAY_WEBHOOK_SECRET),
      canMarkPaid: Boolean(SHOP && SHOP_TOKEN),
      orders: Object.keys(state.orders).length,
    });
  }
  json(res, 404, { error: "not_found", path });
});

server.listen(PORT, () => console.log(`SlipPay×Shopify connector on :${PORT} → ${SLIPPAY_API_BASE}`));
