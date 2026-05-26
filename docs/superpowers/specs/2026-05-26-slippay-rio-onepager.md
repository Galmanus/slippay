# SlipPay
### Assinatura recorrente em stablecoin, na Stellar. Viva em mainnet.

---

**O PROBLEMA — assinatura recorrente em cripto quebra em três pontos:**

- **UX.** Cada cobrança exige assinatura manual da carteira. Não existe débito recorrente nativo on-chain — o x402 resolveu o pagamento avulso, não a assinatura.
- **Conciliação.** O pagamento on-chain não casa sozinho com o pedido do e-commerce; o lojista reconcilia na unha.
- **Regulatório.** Receber em dólar-stablecoin sem virar câmbio/PSAV ilegal é zona cinzenta — e a Res. BCB 561 acabou de fechar o atalho cross-border.

---

**O QUE É**

Contrato Soroban de assinatura na **Stellar (vivo em mainnet)** + checkout que casa o pagamento por memo + off-ramp BRL via **anchor (Instituição de Pagamento brasileira)**. O merchant recebe em dólar na própria carteira. **Não custodiamos fiat. Não-custodial.**

Hoje: humanos excluídos pelo Stripe (WooCommerce, BR/LATAM). Amanhã: agentes de IA — a primeira primitiva de **assinatura recorrente** on-chain.

---

**POSTURA REGULATÓRIA**

Operamos como **infraestrutura de smart contract** na Stellar. Não custodiamos fiat e **não somos PSAV** — o regime BCB 519/520/521 ainda está em janela de autorização (até 30/10/2026; ninguém no BR está autorizado ainda). O on/off-ramp BRL é executado **via Instituição de Pagamento autorizada pelo BCB**. Candidatos verificados, todos IP regulada: **Transfero, Mercado Bitcoin, Bity**. O fluxo é **doméstico** — a Res. 561 (cross-border) não se aplica por design.

---

**PROVA (verificável)**

- Contrato mainnet: `CBJMQ6ZY…DJKSEVQN` · evento `subscription_charged` on-chain
- Demo WooCommerce live: ordem real R$ 49,90 → 9,92 USDC (rate 5,03), `checkout_url` retornado, plugin v0.2.0 instalado
- 6s de finalidade · 6 auditorias (8 críticas + 14 altas fechadas)

---

**O QUE PEDIMOS DESTA CONVERSA**

> Uma introdução a uma **Instituição de Pagamento BR** disposta a ser o anchor de câmbio do on/off-ramp — a perna licenciada que fecha o fluxo.

*(swappable por conversa: piloto com merchant real · parceria técnica · design partner)*

---

Manuel Galmanus · Bluewave AI · manuel@bluewaveai.online · +55 47 9745-5602
Mario F. Neto · co-founder
github.com/Galmanus/slippay · app.slippay.cc
