# Cofrinho DeFindex→Blend — estado e os 2 portões (20/07/2026)

Construído nesta madrugada, DORMENTE (não afeta prod até você ligar). Objetivo: a mãe do Manuel guarda dólar e vê render, com Face ID, sem carteira externa, sem seed.

## O que já está pronto (código, testado no que dá pra testar sem rede)

- `apps/web/src/lib/cofrinho.ts` — depósito/saque do smart wallet passkey no vault, autorizado por Face ID e patrocinado pelo relayer. Reusa a construção de assertion PROVADA em `lib/wallet.ts payViaRelayer`. Gated por env: joga erro se o vault não estiver fixado.
- `supabase/functions/api/routes/relayer.ts` — branch (c) novo em `validateSponsorable`: patrocina `deposit`/`withdraw` SÓ no vault fixado, chamado por um contrato (passkey wallet). **Inerte enquanto `RELAYER_DEFINDEX_VAULT` não for setado** — deployar o código não muda a fronteira de segurança até você fixar o vault conscientemente.
- `apps/web/src/pages/Vault.tsx` — detecta conta passkey e usa Face ID (não Freighter). Sem vault fixado, mostra estado honesto "cofrinho chegando", nunca joga a mãe pra uma carteira de navegador.
- `lib/passkeyHex.ts` + testes. tsc=0, 14 testes passando, build ok. NÃO deployado.

## Portão 1 — EXECUTADO (20/07/2026): vault próprio Slippay em mainnet

Vault deployado via factory oficial e LIGADO (web + relayer):
- **Vault mainnet: `CDB6GLRRBBN3B7MGARZQDFAXDUGFWY74E24MPNGEXMM3M5KZEKE4AMKS`** (tx `d8071ab2…6724`, fee paga pela conta merchant ~1,9 XLM)
- Verificado on-chain: asset = Circle USDC `CCW67TSZ…` ✓ · strategy = `usdc_blend_autocompound_fixed` `CDB2WMKQ…` ✓ · manager/emergency/rebalance/feeReceiver = `GCEYFLGN…` (Manuel) ✓ · **non-upgradable** (ninguém troca o código embaixo do usuário; bug = novo vault + migração) ✓
- Fees (em bps DO RENDIMENTO, não do principal — semântica confirmada no source do vault): Slippay 50 (0,5% do yield — ajustável depois pelo manager via `lock_fees`, sem redeploy) · **DeFindex protocolo 5000 = 50% do yield** (herdado do factory mainnet; testnet era 2000). Com Blend a ~8%, usuário vê ~4%. Se quiser negociar/reavaliar, é com a PaltaLabs.
- Vault testnet gêmeo p/ testes: `CCZGBYTEXS4XQG44RXJHPQIBSXYOE6UQSFEV4SJTP3ILADGVCUUG5PES`
- Script reproduzível: `scripts/deploy-defindex-vault.mjs`
- Cliente reescrito **sem api.defindex.io** (403 sem key): `lib/defindex.ts` + `lib/cofrinho.ts` falam com o vault direto via RPC (construção provada no e2e). APY não é exibido (sem indexador) — só a copy honesta "varia".
- Relayer 165: merge do branch (c) COM as melhorias que estavam só na prod (sdk@15, `RELAYER_FUND_AMOUNT_V2` default 0/carteira-vazia) — a prod estava à frente do git nesse arquivo. Bug real pego pelo typecheck no deploy: o branch (c) original era código morto (o branch de transfer engolia todo invokeContract); corrigido roteando (c) dentro do mesmo branch. `RELAYER_DEFINDEX_VAULT` pinado; `/info` expõe; rejeição `not_pinned_vault` verificada viva em prod.
- Primeiro depósito do vault queima 1000 shares (defesa inflation-attack): o 1º depositante "perde" 0,0001 USDC. Irrelevante, mas documentado.

## (histórico) Portão 1 — fixar um vault USDC mainnet (decisão sua + verificação on-chain)

Endereços verificados nos docs oficiais (docs.defindex.io/contract-deployments/mainnet-deployment):
- USDC Circle SAC mainnet: `CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75`
- Factory: `CDKFHFJIET3A73A2YN4KV7NSV32S6YGQMUFH3DNJXLBWL4SKEGVRNFKI`
- USDC Blend Fixed Pool Strategy: `CDB2WMKQQNVZMEBY7Q7GZ5C7E7IAFSNMZ7GGVD6WKTCEWK7XOIAVZSAP`
- USDC YieldBlox Strategy: `CCSRX5E4337QMCMC3KO3RDFYI57T5NZV5XB3W3TWE4USCASKGL5URKJL`

**Esses são STRATEGIES, não um vault pronto.** Duas rotas, decisão sua:
1. **Deployar vault próprio Slippay** via factory, com Slippay como manager/feeReceiver (vaultFeeBps ex. 50 = 0,5%) sobre a strategy Blend USDC. Prós: você controla a taxa e o manager (mais non-custodial-friendly). Contras: você vira responsável pela config do vault.
2. **Reusar um vault USDC de produção público** já rodando. Prós: zero setup. Contras: confia no manager de terceiro (pode pausar/rebalancear).

Recomendo rota 1 (vault próprio, Slippay manager) — alinha com o DNA non-custodial e captura a taxa do vault.

**Verificação obrigatória antes de fixar** (o código avisa isso): Manager identity + upgradable flag on-chain. Setar em: `apps/web/.env` → `VITE_DEFINDEX_USDC_VAULT=<vault>` + `VITE_DEFINDEX_ENABLED=1` + `VITE_DEFINDEX_API_KEY`; e no relayer (165, /opt/slippay-backend/.env) → `RELAYER_DEFINDEX_VAULT=<mesmo vault>`.

## Portão 2 — PROVADO em testnet (20/07/2026)

`scripts/e2e-cofrinho-defindex-testnet.mjs`: deploy de smart wallet passkey, depósito de 50 USDC no vault DeFindex testnet e saque integral, autorizados SÓ por assertion WebAuthn verificada on-chain. Round-trip sem perda (100 → 50 no cofre → 100 de volta).
- Deposit: tx `9d4fb38fb64ab0de8affc586ffa7fcd9b72972ee00248711b51ce636e489d883`
- Withdraw: tx `abe635468cf63a418f601b0c563681748eb4607e2a7c08f08b74dfb9f5093f8e`

Correções sobre o que este doc dizia antes:
1. **`CAQCFVLO…` NÃO é vault** — é o SAC do USDC testnet do Blend (issuer `GATALTGT…`). O vault USDC testnet real é `usdc_paltalabs_vault` = `CBMVK2JK6NTOT2O4HNQAIQFJY232BHKGLIMXDVQVHIIZKDACXDFZDWHN` (fonte: defindex-io/stellar-contracts `public/testnet.contracts.json`).
2. **Asset-mismatch em MAINNET NÃO existe**: `Asset("USDC", GA5ZSEJYB37…).contractId(PUBLIC)` = `CCW67TSZ…` — exatamente o Circle SAC dos docs DeFindex. Mesmo contrato. (Em testnet o mismatch existe — USDC do app é issuer SDF `GBBD47IF…` — mas testnet não é produto.)
3. **Bug real encontrado e corrigido**: o wasm do smart wallet que estava no testnet (`0e1c8655…`, upload de 01/06, build de árvore suja pré-cleanup-N2) TRAPAVA no `__check_auth` com a árvore de contexts do vault (`deposit` com 4 args → `unwrap()` panica). O source commitado está correto; wasm novo no testnet: `c4ffec0a366d05503157e9022a5a2ea7e35ebe7c9b6fc0cbbab53b3cb51553f2`. Regressão coberta em `src/test.rs` (`passkey_authorizes_vault_deposit_context_tree` nativo + `passkey_vault_deposit_context_tree_wasm` contra o artefato wasm).
4. **Mainnet verificado**: o binário pinado na prod (`RELAYER_WASM_HASH=8e9b6760…`) foi baixado da chain e passa o mesmo teste de contexts do vault. Sem blocker mainnet por esse bug.

## Falha nomeada (atualizada)

O que restava de risco técnico do portão 2 foi exercido. Riscos que continuam: (a) vault mainnet ainda não escolhido/verificado (portão 1, decisão do Manuel); (b) o e2e usa o vault direto via RPC — o caminho via api.defindex.io (SDK) não foi exercido por falta de `VITE_DEFINDEX_API_KEY`; se o SDK montar a tx com shape diferente (ex.: fee-bump), `extractInvoke` de `cofrinho.ts` joga erro fail-closed, não move fundos errado.
