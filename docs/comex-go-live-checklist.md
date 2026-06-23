# Comex (tesouraria B2B Solana) — checklist de GO-LIVE

Quando as chaves chegarem (Privy App ID + 4P API key), siga na ordem. O app já está
construído e gated; nada aparece em produção até `VITE_PRIVY_APP_ID` existir.

Branch: `feat/comex-treasury-phase1`. Tudo Solana, non-custodial.

---

## 0. Pré-requisitos (chaves a obter)
- [ ] **Privy App ID** — criar app em dashboard.privy.io
- [ ] **4P API key** (`FOURP_API_KEY`) — do Mario/4P
- [ ] **(opcional, recomendado) RPC Solana pago** (Helius/Triton/QuickNode) — o público `api.mainnet-beta` é rate-limited e não aguenta produção

## 1. Configurar o app Privy (dashboard.privy.io)
- [ ] Login methods: **apenas e-mail** (sem biometria/passkey)
- [ ] **MFA habilitado** (TOTP)
- [ ] **Embedded wallets: Solana, createOnLogin** (sem EVM)
- [ ] Allowed domains: `app.slippay.cc`
- [ ] Copiar o **App ID**

## 2. Env do FRONTEND — `apps/web/.env.production`
(build-time; já tem `VITE_COMEX_ENABLED=1` e `VITE_STELLAR_NETWORK=PUBLIC`)
- [ ] `VITE_PRIVY_APP_ID=<app id>`
- [ ] `VITE_SOLANA_NETWORK=mainnet`
- [ ] `VITE_SOLANA_RPC=<url do RPC pago>`  ← senão cai no público (frágil)
- [ ] `VITE_4P_OFFRAMP_RECEIVER=<endereço Solana base58 da 4P>`  ← **segurança (I-3)**: pino do receiver da venda. Sem isso a venda fica desabilitada; se a 4P retornar endereço diferente do pino, a operação é bloqueada antes de assinar. Pedir o endereço oficial à 4P.
- [ ] (USDC mint mainnet é fixo no código — Circle `EPjFW...grmGp2`, não setar)
- [ ] NÃO existe secret de assinatura no front (non-custodial) — confirmar: `grep -ri "AUTHORIZATION_PRIVATE\|secret" apps/web/src` = vazio

## 3. Env do BACKEND 4P (supabase function `api`, rota `/4p`)
- [ ] `FOURP_API_KEY=<key da 4P>`
- [ ] `FOURP_CHAIN=Solana`  ← **crítico** (default é `Base`; sem isso a 4P entrega na chain errada)
- [ ] `FOURP_ASSET=USDC`
- [ ] `FOURP_BASE_URL=https://api.4p.finance` (confirmar com a doc deles)
- [ ] redeploy da supabase function
- [ ] smoke do gate: `curl https://api.slippay.cc/api/4p/status` → `{enabled:true, chain:"Solana", asset:"USDC"}`

## 4. Vender (off-ramp USDC→R$) — PENDENTE endpoint 4P
A compra (R$→USDC) já está fiada. A venda está estruturada (`ramp4p.ts`:
`quoteOfframp4p`/`createOfframp4p`/`getOfframp4p`) mas precisa do endpoint real:
- [ ] obter a doc do **off-ramp da 4P**
- [ ] adicionar as rotas `/api/4p/offramp{,/quote,/:id}` no backend (`supabase/functions/api/routes/fourp.ts`) espelhando o on-ramp
- [ ] ajustar os campos em `ramp4p.ts` ao contrato real (hoje são best-guess)
- até lá, a aba "vender" mostra "em ativação" (não quebra)

## 5. Confirmar com a 4P (fatos que travam o fluxo)
- [ ] a 4P entrega o USDC na **rede Solana**, no **endereço da carteira Privy** que o app passa? (não em Base)
- [ ] a estrutura "4P origina o câmbio (licenciada), Slippay é só a plataforma non-custodial" está acordada? (mantém Slippay fora do VASP — ver memo `project_slippay_not_vasp`)

## 6. Build + deploy
- [ ] backup: `ssh manuel@165.22.10.194 "cp -r /opt/slippay-backend/apps/web/dist /opt/slippay-backend/apps/web/dist.bak-$(date +%Y%m%d-%H%M%S)"`
- [ ] build: `cd apps/web && VITE_COMEX_ENABLED=1 pnpm build`
- [ ] sanity local: `grep -c "EPjFW" dist/assets/index-*.js` > 0 (mint mainnet no bundle)
- [ ] rsync: `rsync -az --checksum --delete dist/ manuel@165.22.10.194:/opt/slippay-backend/apps/web/dist/`
- [ ] confirmar bundle live == local (o `deploy-web.sh` faz isso)

## 7. Smoke test (produção, valores pequenos)
- [ ] `/comex` agora abre o **app** (não mais a BusinessLanding) — login e-mail + **MFA**
- [ ] carteira Solana criada; **Saldo/Receber** mostra endereço base58 + saldo
- [ ] **Comprar**: R$ pequeno → quote → código Pix → pagar → USDC cai na carteira (confirmar no solscan)
- [ ] **Enviar**: mandar USDC pequeno → ConfirmTxModal mostra **destino+valor corretos** → assina → solscan confirma
- [ ] **Vender** (quando off-ramp live): USDC pequeno → Pix cai
- [ ] o resto do site (`/`, `/zk/`, `/pay`) intacto

## 8. VERIFY-WITH-KEYS (confirmar contra a sessão Privy real)
- [ ] `comexSolana.tsx`: chamadas exatas de criação de wallet + `signTransaction` da Privy Solana (validar contra `@privy-io/react-auth@3.x` com App ID ativo)
- [ ] gate de MFA (shape do `mfaMethods`)
- [ ] stub `@solana-program/memo` (`vite.config.ts` alias + `src/stubs/`): se a Privy precisar dele em runtime, **instalar o pacote de verdade** — cuidado com a interação com o override `@solana-program/token>@solana/kit@5.5.1` (que conserta o build)

## 9. Rollback
- env é build-time, então rollback = redeploy de um backup:
  `rsync -az --delete dist.bak-<ts>/ /opt/slippay-backend/apps/web/dist/` no servidor
- backups ficam em `/opt/slippay-backend/apps/web/dist.bak-*`

---

### Estado atual (23/06)
Pronto e testado (tsc 0, 47 testes, build 0), gated, não-deployado o transacional:
carteira Privy-Solana + gate de segurança + saldo/receber + enviar + comprar (4P).
Falta: key da 4P (liga compra + destrava venda), Privy App ID (liga o app), endpoint
off-ramp 4P (venda), deploy junto com a migração Solana. Yield = fase 2 (DeFindex é Stellar).
