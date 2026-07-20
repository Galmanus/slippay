# Cofrinho DeFindex→Blend — estado e os 2 portões (20/07/2026)

Construído nesta madrugada, DORMENTE (não afeta prod até você ligar). Objetivo: a mãe do Manuel guarda dólar e vê render, com Face ID, sem carteira externa, sem seed.

## O que já está pronto (código, testado no que dá pra testar sem rede)

- `apps/web/src/lib/cofrinho.ts` — depósito/saque do smart wallet passkey no vault, autorizado por Face ID e patrocinado pelo relayer. Reusa a construção de assertion PROVADA em `lib/wallet.ts payViaRelayer`. Gated por env: joga erro se o vault não estiver fixado.
- `supabase/functions/api/routes/relayer.ts` — branch (c) novo em `validateSponsorable`: patrocina `deposit`/`withdraw` SÓ no vault fixado, chamado por um contrato (passkey wallet). **Inerte enquanto `RELAYER_DEFINDEX_VAULT` não for setado** — deployar o código não muda a fronteira de segurança até você fixar o vault conscientemente.
- `apps/web/src/pages/Vault.tsx` — detecta conta passkey e usa Face ID (não Freighter). Sem vault fixado, mostra estado honesto "cofrinho chegando", nunca joga a mãe pra uma carteira de navegador.
- `lib/passkeyHex.ts` + testes. tsc=0, 14 testes passando, build ok. NÃO deployado.

## Portão 1 — fixar um vault USDC mainnet (decisão sua + verificação on-chain)

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

## Portão 2 — provar e2e em testnet ANTES de ligar em mainnet

O `cofrinho.ts` NÃO foi rodado ponta-a-ponta (não tem vault fixado). Antes de mainnet, rodar contra vault USDC testnet DeFindex (BlendUSDC `CAQCFVLOBK5GIULPNZRGATJJMIZL5BSP7X5YJVMGCPTUEPFM4AVSRCJU`), igual o pagamento foi provado em `scripts/e2e-passkey-pay-testnet.mjs`. Confirmar: assertion aceita pelo __check_auth, settlement, e **checar que a USDC do vault bate com a USDC do payAssetSac** (passkey.ts deriva de issuer `GA5ZSEJYB37...`; o vault mainnet usa `CCW67TSZ...` — se não forem o mesmo contrato, tem bug de asset mismatch). Esse é o teste crítico.

## Falha nomeada

Se ligar em mainnet sem o e2e de testnet: o depósito pode reverter no __check_auth (assertion mal construída) ou, pior, mover a USDC errada. Custo do erro = confusão do usuário + gás. Por isso os dois portões são sequenciais e a rota é gated.
