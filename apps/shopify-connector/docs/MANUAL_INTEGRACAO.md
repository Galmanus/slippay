# SlipPay para Shopify — Manual de Integração

Receba pedidos da sua loja Shopify em USDC (dólar digital, rede Stellar). O
comprador paga on-chain, o pedido é marcado como pago automaticamente na sua
admin da Shopify, com o hash da transação anotado no pedido.

Sem custódia: o dinheiro vai direto pro seu endereço Stellar. O SlipPay não
segura fundos em nenhum momento.

---

## Antes de começar, você precisa de

1. **Conta SlipPay** — crie em [app.slippay.cc/signup](https://app.slippay.cc/signup).
   No dashboard você vai precisar de três coisas:
   - **API key** (`sk_live_...`)
   - **Webhook secret**
   - **Endereço Stellar de recebimento** configurado, com trustline USDC ativa
     (sem ele o checkout não tem pra onde mandar o dinheiro)
2. **Loja Shopify** com acesso de admin (qualquer plano).

---

## Passo 1 — Instalar o app

Abra este link substituindo pelo domínio da sua loja:

```
https://api.slippay.cc/shopify/install?shop=SUA-LOJA.myshopify.com
```

(Se abrir sem o parâmetro, a página pede o domínio num formulário.)

A Shopify vai pedir autorização com dois escopos: **read_orders** e
**write_orders** — leitura pra receber pedidos novos, escrita pra marcar como
pago. Nada além disso.

Ao autorizar, o app registra sozinho o webhook de pedidos da sua loja e te
redireciona pra **página de configurações**, com um link tokenizado. Guarde
esse link — é a sua página de settings. (Perdeu? Refaça a instalação: o mesmo
link de install gera um settings link novo sem duplicar nada.)

## Passo 2 — Conectar sua conta SlipPay

Na página de configurações que abriu, cole:

| Campo | Onde pegar |
|---|---|
| SlipPay API key (`sk_live_...`) | Dashboard SlipPay → API |
| SlipPay webhook secret | Dashboard SlipPay → Webhooks |

E no **dashboard SlipPay**, configure o webhook URL do seu merchant para:

```
https://api.slippay.cc/shopify/slippay-webhook
```

É esse webhook que avisa o conector quando o pagamento confirma on-chain.

## Passo 3 — Criar o meio de pagamento na Shopify

Na admin da sua loja: **Settings → Payments → Manual payment methods → Create
custom payment method**.

- **Nome:** `SlipPay (USDC)` — o nome **precisa conter "slippay"** (é assim
  que o conector reconhece quais pedidos são seus; pedidos com outros meios de
  pagamento são ignorados).
- **Instruções ao cliente** (aparecem na confirmação do pedido):

  > Para pagar, acesse https://api.slippay.cc/shopify/pay/ seguido do número
  > do seu pedido (ex.: https://api.slippay.cc/shopify/pay/1001). Você será
  > levado ao checkout seguro do SlipPay para pagar em USDC.

## Passo 4 — Testar com um pedido real

1. Faça um pedido de valor baixo na sua loja escolhendo **SlipPay (USDC)** no
   checkout.
2. Abra `https://api.slippay.cc/shopify/pay/<número do pedido>` — deve
   redirecionar pro checkout SlipPay com o valor do pedido.
3. Pague. Em até ~1 minuto após a confirmação on-chain, o pedido aparece como
   **Paid** na admin da Shopify, com o `tx_hash` da transação anotado.

Se os 3 passos funcionaram, a integração está completa.

---

## Como funciona por baixo (fluxo completo)

```
Comprador fecha pedido (meio de pagamento: SlipPay)
        │
Shopify → webhook orders/create → conector SlipPay   [assinatura HMAC verificada]
        │
Conector cria a ordem SlipPay (referência shopify:<id do pedido>)
        │
Comprador abre /shopify/pay/<nº do pedido> → redirect pro checkout SlipPay
        │
Pagamento USDC on-chain (Stellar) direto pro SEU endereço
        │
SlipPay confirma on-chain → webhook order.paid → conector   [assinatura verificada]
        │
Conector marca o pedido como Paid na Shopify (Admin API) + anota tx_hash
```

Segurança: os webhooks dos **dois lados** são verificados por assinatura HMAC
(Shopify `X-Shopify-Hmac-Sha256`; SlipPay `x-slippay-signature`). Entregas
duplicadas são deduplicadas. O conector nunca vê nem custodia fundos.

---

## Problemas comuns

| Sintoma | Causa provável | O que fazer |
|---|---|---|
| Link `/pay/<nº>` dá "order not found" | O webhook do pedido ainda não chegou (leva alguns segundos) | Aguarde ~10s e recarregue. Persistindo, confira se o nome do meio de pagamento contém "slippay" |
| Pedido pago não marca como Paid | Webhook secret errado ou webhook URL não configurado no dashboard SlipPay | Confira o secret na página de settings e o URL `https://api.slippay.cc/shopify/slippay-webhook` no dashboard |
| Settings page dá "unauthorized" | Link de settings antigo/perdido | Refaça o install — gera link novo, sem duplicar a instalação |
| Checkout abre sem destino de pagamento | Endereço Stellar não configurado ou sem trustline USDC | Configure o endereço de recebimento no dashboard SlipPay |

Status do serviço (diagnóstico): `https://api.slippay.cc/shopify/health` —
resposta JSON com todos os flags; `ok: true` = serviço no ar.

Suporte: [manuel@bluewaveai.online](mailto:manuel@bluewaveai.online)

---

## Nota de transparência

- O app é instalado via link direto (o fluxo OAuth padrão da Shopify). A
  listagem na Shopify App Store está em preparação; a instalação por link é
  suportada e completa.
- O pagamento usa um **manual payment method** — o comprador finaliza o pedido
  na Shopify e paga em seguida pelo link. Não é (ainda) um gateway nativo
  dentro do checkout da Shopify; esse caminho ("Payments App" oficial) depende
  de aprovação comercial da Shopify e está no roadmap.
- Reembolsos são feitos on-chain por você, manualmente (o SlipPay não custodia
  fundos e não pode reverter transações).

## Alternativa sem OAuth (avançado)

Se você prefere não instalar o app, existe o caminho de **custom app** (você
cria um app privado na sua admin com os mesmos escopos e configura os secrets
manualmente). Requer configuração no servidor por loja — documentado no
[README do conector](../README.md). Recomendado só pra setups sob medida; o
fluxo deste manual cobre o caso normal.
