import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { req } from "./_helpers.ts";
import { serviceClient } from "../lib/supabase.ts";

async function createMerchant() {
  const sb = serviceClient();
  const email = `m-${crypto.randomUUID()}@slippay.test`;
  const { data: u } = await sb.auth.admin.createUser({ email, email_confirm: true, password: "p" });
  const { data: s } = await sb.auth.signInWithPassword({ email, password: "p" });
  const create = await req("/v1/merchants", {
    method: "POST",
    headers: { authorization: `Bearer ${s.session!.access_token}`, "content-type": "application/json" },
    body: JSON.stringify({ display_name: "T", stellar_address: "G" + "A".repeat(55) }),
  });
  return await create.json();
}

Deno.test("POST /v1/orders without api key returns 401", async () => {
  const res = await req("/v1/orders", { method: "POST", body: JSON.stringify({ brl_amount: "10.00" }) });
  assertEquals(res.status, 401);
});

Deno.test("POST /v1/orders creates order, returns checkout_url + memo + usdc_amount", { sanitizeOps: false, sanitizeResources: false }, async () => {
  const m = await createMerchant();
  const res = await req("/v1/orders", {
    method: "POST",
    headers: { authorization: `Bearer ${m.api_key}`, "content-type": "application/json" },
    body: JSON.stringify({ brl_amount: "100.00", external_ref: "cart_1" }),
  });
  assertEquals(res.status, 201);
  const body = await res.json();
  assert(body.order.id);
  assertEquals(body.order.status, "pending");
  assert(body.order.memo.length === 64);
  assert(parseFloat(body.order.usdc_amount) > 0);
  assert(body.checkout_url.includes(body.order.id));
});

Deno.test("POST /v1/orders rejects invalid amount", { sanitizeOps: false, sanitizeResources: false }, async () => {
  const m = await createMerchant();
  const res = await req("/v1/orders", {
    method: "POST",
    headers: { authorization: `Bearer ${m.api_key}`, "content-type": "application/json" },
    body: JSON.stringify({ brl_amount: "0.00" }),
  });
  assertEquals(res.status, 400);
});

Deno.test("GET /v1/orders lists own orders only", { sanitizeOps: false, sanitizeResources: false }, async () => {
  const a = await createMerchant();
  const b = await createMerchant();
  await req("/v1/orders", { method: "POST",
    headers: { authorization: `Bearer ${a.api_key}`, "content-type": "application/json" },
    body: JSON.stringify({ brl_amount: "10.00" }) });
  await req("/v1/orders", { method: "POST",
    headers: { authorization: `Bearer ${b.api_key}`, "content-type": "application/json" },
    body: JSON.stringify({ brl_amount: "20.00" }) });
  const res = await req("/v1/orders", { headers: { authorization: `Bearer ${a.api_key}` } });
  const body = await res.json();
  assertEquals(body.orders.length, 1);
  assertEquals(body.orders[0].brl_amount, "10.00");
});

Deno.test("GET /v1/orders/:id returns public limited fields without auth", { sanitizeOps: false, sanitizeResources: false }, async () => {
  const m = await createMerchant();
  const c = await req("/v1/orders", { method: "POST",
    headers: { authorization: `Bearer ${m.api_key}`, "content-type": "application/json" },
    body: JSON.stringify({ brl_amount: "50.00" }) });
  const { order } = await c.json();
  const res = await req(`/v1/orders/${order.id}`);
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.order.id, order.id);
  assertEquals("api_key_hash" in body.order, false);
});

Deno.test("POST /v1/orders/:id/cancel marks status cancelled", { sanitizeOps: false, sanitizeResources: false }, async () => {
  const m = await createMerchant();
  const c = await req("/v1/orders", { method: "POST",
    headers: { authorization: `Bearer ${m.api_key}`, "content-type": "application/json" },
    body: JSON.stringify({ brl_amount: "5.00" }) });
  const { order } = await c.json();
  const res = await req(`/v1/orders/${order.id}/cancel`, { method: "POST",
    headers: { authorization: `Bearer ${m.api_key}` } });
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.order.status, "cancelled");
});
