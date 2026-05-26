# SlipPay — Deck Rio (Stellar 37 Graus) · v1 draft

**Contexto:** pitch presencial Rio 8-11/jun · júri = painel de investidores de finanças digitais · x402 é o Sprint 2 do currículo do programa · rank atual 24/30, objetivo subir.
**Wedge travado:** visão aninhada — billing/assinatura USD Stellar-nativo pra quem o Stripe exclui. Humanos hoje (WooCommerce/inclusão), agentes amanhã (assinatura recorrente).
**Registro:** concreto-primeiro, sem hype. Número ou prova em cada slide. Mainnet = piso (todos têm, foi exigência de sprint), NÃO diferencial — o diferencial é **assinatura recorrente** + **uso real**.
**Status:** v1 rascunho do Claude (laptop) enquanto Wave estava no limite. Wave refina.

---

## Slide 1 — A visão (abre o arco temporal)

**Título:** O Stripe foi feito pra um clube. O resto do mundo paga em dólar do lado de fora.

**On-slide:**
- 5 milhões de lojas no mundo não conseguem aceitar Stripe — geo-bloqueio, KYC quebrado, taxa proibitiva (BR, LATAM, África, SE Asia).
- O SlipPay é billing em dólar pra quem o sistema excluiu. **Hoje: o merchant. Amanhã: o agente de IA.**
- Os dois precisam de um trilho que a Stellar habilita: settlement 6s, fee ~US$0,000001, não-custodial.

**Nota de fala:** não vender "gateway melhor que X" (comparativo perde). Vender "a infraestrutura de um mundo que está nascendo e precisa da Stellar" (visionário). O arco humanos→agentes é a espinha do deck.

---

## Slide 2 — O gancho (a primitiva que ninguém tem)

**Título:** A primeira assinatura recorrente on-chain. Viva na mainnet.

**On-slide:**
- x402 resolveu o pagamento **avulso** de agente. Mas todo agente sério é **assinante**: Claude→OpenRouter, Cursor→APIs. Assinatura recorrente de agente é a primitiva que **ainda não existe**.
- SlipPay já tem o contrato Soroban de subscription **deployed na mainnet** — `CBJMQ6ZY…DJKSEVQN` — com `subscription_charged` real on-chain.
- tx verificável: `aa3304c9…` · 0,05 USDC buyer→merchant · 6s · auditável no stellar.expert.

**Nota de fala:** este é o slide que bate no Sprint 2 (x402) do júri. Honestidade: mainnet é piso do cohort (foi exigência), então o diferencial NÃO é "estamos em produção" — é "somos a única **assinatura recorrente**, a pista que o x402-one-off deixou vazia". Não over-claim.

---

## Slide 3 — Prova de demanda HOJE (não promessa)

**Título:** Enquanto o agente não chega, o merchant brasileiro já está pagando.

**On-slide:**
- 98% das compras de cripto no Brasil no 1º tri/2026 foram stablecoin — US$ 6,8 bi de US$ 6,9 bi. Dolarização não é tese, é o fluxo dominante (+250% YoY, 5º mercado do mundo).
- Plugin **WooCommerce** vivo: qualquer loja BR aceita e fica em dólar no recebimento, não-custodial.
- **[N] merchants reais processando** [preencher pré-Rio · esta é a métrica que o cohort inteiro não tem — todos pré-tração].

**Nota de fala:** num cohort onde o #3 tem waitlist e o #5 tem 0 stars, merchant real é o diferenciador devastador. Encher o [N] antes do Rio é o caminho crítico de tração.

---

## Slide 4 — O fosso (regulatório, com base jurídica)

**Título:** A Resolução 561 acabou de tornar ilegal o pitch dos nossos concorrentes.

**On-slide:**
- Res. BCB 561 (vigência 01/10/2026): proíbe stablecoin na liquidação cross-border de eFX. Todo gateway "Pix→stablecoin→exterior" fica exposto.
- SlipPay é **doméstico por design** — não há liquidação cross-border via blockchain, a 561 não se aplica ao fluxo.
- SlipPay é provedor de tecnologia: não custodia, não opera câmbio, não é instituição financeira. A conversão BRL→USDC **será executada via instituição de pagamento BR autorizada pelo BCB.**
- **Anchor on/off-ramp — candidatos verificados, todos IP regulada pelo BCB, na janela de autorização PSAV (Res. 519/520/521, até 30/10/2026): Transfero (BRZ), Mercado Bitcoin (SISBACEN, cap R$62,6M), Bity (stablecoin cross-border).** Ninguém no BR é "PSAV-autorizado" hoje — o regime só fecha a janela em out/2026; quem cravar isso agora está mentindo. Nós escolhemos dentro de um pool regulado real.

**Nota de fala:** o ponto vira FORÇA, não fraqueza — "anchor em definição" não é incógnita, é escolha dentro de IPs reguladas esperando o BCB despachar. Transfero/BRZ (stablecoin BR circulando), Mercado Bitcoin (escala+SISBACEN), Bity (cross-border na prática) cobrem vetores diferentes. NÃO dizer "imune por design" como bravata nem afirmar conformidade ativa antes do anchor fechado (propaganda enganosa, CDC 37). Fonte BCB no rodapé do slide.

---

## Slide 5 — O ask

**Título:** [definir com Manuel: o que pede ao programa/investidor]

**On-slide (rascunho):**
- O que SlipPay precisa pra ir de primitiva→adoção: [grant / intro pro anchor licenciado / piloto com N merchants].
- Marco verificável pós-Rio: [ex: X merchants, primeiro agente assinante, anchor fechado] até [data].

**Nota de fala:** o ask tem que ser concreto e ancorado num marco falsificável. Manuel define o número.

---

## Pendências antes do deck final
1. Slide 3: preencher [N] merchants reais (tração pré-Rio).
2. Slide 5: definir o ask + marco falsificável.
3. Confirmar anchor (dupla autorização BCB) — muda o tempo verbal do Slide 4.
4. Wave refina narrativa/registro quando voltar do limite (~10:40 BRT).
