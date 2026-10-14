# Slippay no seu checkout, via API

Guia para o time técnico de uma loja que quer oferecer **"Pagar com Slippay"** no checkout, usando a API pública da Slippay. É o mesmo fluxo que os conectores de Shopify, WooCommerce e VTEX usam.

Base da API: `https://api.slippay.cc/api`
Autenticação: `Authorization: Bearer sk_live_...` (a API key da loja)

---

## 1. Como funciona

```
Cliente clica "Pagar com Slippay" no seu checkout
        │
        ▼
Seu backend ── POST /v1/orders ──► Slippay      (valor, seu nº de pedido)
        ◄── checkout_url ──────────
        │
        ▼
Você redireciona o cliente para o checkout_url  (página de pagamento Slippay)
        │
        ▼
Cliente paga em USDC (dólar digital) com a carteira dele, na rede Stellar
        │
        ▼
Slippay confirma o pagamento na rede e chama o SEU webhook: order.paid
        │
        ▼
Seu backend confere a assinatura, marca o pedido como pago e libera o produto
```

O dinheiro vai **direto para a conta da loja**: a Slippay não fica com a custódia em nenhum momento.

---

## 2. Antes de integrar (uma vez)

1. Criar a conta da loja em **https://app.slippay.cc/signup**.
2. No painel, em **Configurações**:
   - **Endereço de recebimento (Stellar):** a conta que vai receber os pagamentos. Ela precisa ter a *trustline* de USDC, e o painel avisa se estiver faltando.
   - **Webhook URL:** o endpoint HTTPS público do seu backend que vai receber as confirmações, por exemplo `https://sualoja.com/webhooks/slippay`.
3. Guardar a **API key** (`sk_live_...`). Ela aparece **uma única vez**; se perder, gere outra no painel.
4. O time Slippay envia o **segredo do webhook** por canal privado. Ele serve para validar que cada chamada veio mesmo da Slippay.

> Nunca coloque a API key ou o segredo do webhook no front-end ou no navegador. As chamadas à Slippay saem sempre do seu backend.

---

## 3. Criar o pedido

`POST /v1/orders`

| Campo | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `brl_amount` | string | um dos dois | Valor em reais, ex. `"149.90"`. A Slippay converte para USDC pela cotação do momento. |
| `usd_amount` | string | um dos dois | Valor em dólar, ex. `"29.90"` (1 USDC = 1 USD). |
| `external_ref` | string (até 120) | recomendado | O número do pedido no **seu** sistema. Volta igual no webhook. |
| `expires_in_minutes` | inteiro 5–1440 | não | Validade do pedido. Padrão: 30 minutos. |

Informe **exatamente um** entre `brl_amount` e `usd_amount`.

**curl**
```bash
curl -X POST https://api.slippay.cc/api/v1/orders \
  -H "Authorization: Bearer $SLIPPAY_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"brl_amount":"149.90","external_ref":"PEDIDO-10293","expires_in_minutes":30}'
```

**Node.js**
```js
const r = await fetch("https://api.slippay.cc/api/v1/orders", {
  method: "POST",
  headers: { Authorization: `Bearer ${process.env.SLIPPAY_API_KEY}`, "Content-Type": "application/json" },
  body: JSON.stringify({ brl_amount: "149.90", external_ref: "PEDIDO-10293", expires_in_minutes: 30 }),
});
if (!r.ok) throw new Error(`Slippay ${r.status}: ${await r.text()}`);
const { order, checkout_url } = await r.json();
// salve order.id junto do seu pedido e redirecione o cliente:
res.redirect(checkout_url);
```

**PHP**
```php
$ch = curl_init("https://api.slippay.cc/api/v1/orders");
curl_setopt_array($ch, [
  CURLOPT_POST => true,
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_HTTPHEADER => [
    "Authorization: Bearer " . getenv("SLIPPAY_API_KEY"),
    "Content-Type: application/json",
  ],
  CURLOPT_POSTFIELDS => json_encode([
    "brl_amount" => "149.90",
    "external_ref" => "PEDIDO-10293",
    "expires_in_minutes" => 30,
  ]),
]);
$res = json_decode(curl_exec($ch), true);
header("Location: " . $res["checkout_url"]);
```

**Resposta (201)**
```json
{
  "order": {
    "id": "9b1e…",
    "status": "pending",
    "brl_amount": "149.90",
    "usdc_amount": "…",
    "external_ref": "PEDIDO-10293",
    "expires_at": "2026-10-14T12:30:00Z"
  },
  "checkout_url": "https://…/checkout/9b1e…?t=…",
  "fee": { "platform_fee_bp": …, "gross_usdc": "…", "fee_usdc": "…", "net_usdc": "…" }
}
```

O bloco `fee` mostra, pedido a pedido, quanto o cliente paga (`gross_usdc`), a taxa da plataforma (`fee_usdc`) e o líquido da loja (`net_usdc`).

---

## 4. Receber a confirmação (webhook)

Quando o pagamento é confirmado na rede, a Slippay faz um `POST` no seu Webhook URL:

**Headers**
- `content-type: application/json`
- `x-slippay-signature: t=<unix>,v1=<hex>`
- `x-slippay-delivery-id: <id único da entrega>`

**Corpo**
```json
{
  "type": "order.paid",
  "data": {
    "id": "9b1e…",
    "external_ref": "PEDIDO-10293",
    "brl_amount": "149.90",
    "usdc_amount": "…",
    "tx_hash": "…",
    "memo": "…",
    "paid_at": "2026-10-14T12:07:31Z"
  }
}
```

| Evento | Quando |
|---|---|
| `order.paid` | Pago o valor certo. **Libere o pedido.** |
| `order.underpaid` | Pagou menos que o devido. Vem com `expected` e `received`. Não libere. |

**Validar a assinatura (obrigatório).** A assinatura é `HMAC-SHA256(segredo, "<t>.<corpo bruto>")` em hexadecimal. Rejeite se `t` estiver a mais de 5 minutos do horário atual.

**Node.js (Express)**
```js
import crypto from "node:crypto";
app.post("/webhooks/slippay", express.raw({ type: "application/json" }), (req, res) => {
  const header = req.get("x-slippay-signature") ?? "";
  const { t, v1 } = Object.fromEntries(header.split(",").map((p) => p.split("=")));
  const body = req.body.toString("utf8");              // corpo BRUTO, sem reformatar
  const expected = crypto.createHmac("sha256", process.env.SLIPPAY_WEBHOOK_SECRET).update(`${t}.${body}`).digest("hex");
  const fresh = Math.abs(Date.now() / 1000 - Number(t)) <= 300;
  const ok = fresh && v1 && v1.length === expected.length && crypto.timingSafeEqual(Buffer.from(v1), Buffer.from(expected));
  if (!ok) return res.status(401).end();
  const evt = JSON.parse(body);
  if (evt.type === "order.paid") marcarComoPago(evt.data.external_ref, evt.data.tx_hash); // idempotente!
  res.status(200).end();
});
```

**PHP**
```php
$body = file_get_contents("php://input");                       // corpo BRUTO
parse_str(str_replace(",", "&", $_SERVER["HTTP_X_SLIPPAY_SIGNATURE"] ?? ""), $sig);
$expected = hash_hmac("sha256", $sig["t"] . "." . $body, getenv("SLIPPAY_WEBHOOK_SECRET"));
if (abs(time() - (int)$sig["t"]) > 300 || !hash_equals($expected, $sig["v1"] ?? "")) { http_response_code(401); exit; }
$evt = json_decode($body, true);
if ($evt["type"] === "order.paid") { marcar_como_pago($evt["data"]["external_ref"], $evt["data"]["tx_hash"]); }
http_response_code(200);
```

Boas práticas:
- **Idempotência.** Use `x-slippay-delivery-id`, ou o `id` do pedido, para não processar a mesma confirmação duas vezes.
- **Responda 2xx rápido** e faça o trabalho pesado depois.
- **Redirecionamentos (3xx) não são aceitos.** O endpoint precisa ser HTTPS público.

---

## 5. Outras chamadas úteis

| Chamada | Para quê |
|---|---|
| `GET /v1/orders?status=paid&limit=50` | Listar pedidos da loja por status (conciliação). |
| `POST /v1/orders/{id}/cancel` | Cancelar um pedido ainda `pending`. |

Status possíveis: `pending`, `paid`, `underpaid`, `expired`, `cancelled`, `dead`.

---

## 6. Checklist de go-live

- [ ] Conta criada; endereço de recebimento com trustline de USDC (o painel mostra "ready to receive").
- [ ] API key guardada no backend, em variável de ambiente.
- [ ] Webhook URL em HTTPS configurada; segredo recebido e configurado.
- [ ] Assinatura validada e rejeição com 401 testada (corpo alterado deve falhar).
- [ ] Um pedido real de valor baixo pago de ponta a ponta: `order.paid` recebido e pedido liberado.
- [ ] Pedido expirado e pedido cancelado tratados no seu sistema.

Dúvidas: time Slippay.
