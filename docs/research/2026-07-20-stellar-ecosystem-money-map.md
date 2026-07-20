# Stellar ecosystem money map — 20/07/2026

Pesquisa deep-research (100 agentes, 18 fontes, 89 claims → 25 verificados adversarialmente)
+ re-verificação manual dos números-chave direto nas fontes (api.llama.fi, stellar.org, docs.etherfuse.com) em 20/07/2026 ~01:10 BRT.

## Ranking por dinheiro medido (verificado por mim na API do DefiLlama, 20/07)

| Protocolo | TVL medido | Nota |
|---|---|---|
| Blend Pools V2 (lending) | **$139,1M** | monopólio do lending Stellar (Templar $7,3M, resto irrelevante). USDC APY >8% vs 2-5% Aave (Messari Q1) |
| Aquarius (AMM) | $45,2M | volume 30d $53,7M, fees 30d ~$105K. Real, economics modestos |
| DeFindex (yield aggregator) | $17,5M | a camada de yield sobre o Blend. API-first, non-custodial |
| Soroswap (DEX) | $1,2M | volume 30d = $0 no DefiLlama (morto ou adapter quebrado). Não integrar como dependência |
| Stellar chain total (DeFi) | ~$229,6M | |

## Adoção (fonte primária SDF Q1 2026, verificada por mim)

- Volume de pagamentos em stablecoin: **$5,5B no Q1 2026**, ATH, +72% YoY
- 10,6M endereços únicos, 22,5B operações
- RWAs cruzaram **$2B** no Q1 (os verificadores do workflow refutaram esse claim POR ERRO — está literalmente no post da SDF, título "RWAs crossed $2B")
- Volume diário de contratos Soroban: $16M/dia (vs $2M/dia um ano antes, 8x YoY)
- Stablecoin mcap na Stellar: ~$300M (~$256M é USDC), +20-22% QoQ
- Sinal contrário (Messari Q1): endereços diários ativos em stablecoin CAÍRAM 5,5% QoQ (80.470 → 76.050). Volume sobe, usuários únicos não. O crescimento é institucional/whale, não varejo.

## Quem tem tração comercial de verdade

- **MoneyGram (flagship ramp): só ~$30M de volume TOTAL em 3 anos.** O caso-vitrine de cash on/off-ramp é pequeno. Ramp físico não é onde o dinheiro está.
- **Meru**: wallet USDC non-custodial LatAm (SCF-funded, desde 2022), integrou Blend pra yield — precedente vivo da arquitetura exata do Slippay (wallet + yield non-custodial).
- **Beans**: $610K em depósitos em 3 meses após integrar vaults DeFindex (fonte: defindex.io, self-reported — não auditado).
- **Etherfuse (verificado por mim nos docs)**: ramp live SÓ no México (MXN/SPEI). **Brasil (BRL/Pix) é "upcoming", NÃO está live.** Etherfuse hoje não é off-ramp Pix utilizável. Chains suportadas: Solana, Stellar, Base, Polygon, Monad.

## Conclusão para o Slippay

1. **A integração de maior alavancagem é DeFindex→Blend para o cofrinho.** É onde o dinheiro do ecossistema está ($139M + $17,5M), com yield real (>8% USDC APY medido no Q1), precedente comercial (Meru, Beans) e encaixe exato: transforma a promessa "dólar que rende" da landing em código. Modelo Kast: o usuário vê "rende ~X% ao ano", nunca vê Blend/vault/contrato.
2. **Não depender de Soroswap** (volume zero há 8 semanas).
3. **Off-ramp Pix continua sendo o gargalo nosso**, e Etherfuse não resolve hoje (BR upcoming). Rota real continua 4P (key pendente) / PagFinance (credencial pendente) / Kast pessoal como workaround.
4. O sinal Messari (usuários ativos caindo enquanto volume sobe) reforça o veredito de 02/06: a briga não é por usuário cripto existente, é por gente que nunca tocou cripto — exatamente o posicionamento banco-normal/mãe.

## Falhas da pesquisa (honestidade)

- Synthesis do workflow falhou (session limit); esta síntese é minha, feita sobre os claims verificados + re-checagem manual.
- 2 claims ficaram sem verificação (3 verifiers falharam por limite): chain TVL $232M (eu verifiquei manualmente: $229,6M ✓) e suporte de chains da Etherfuse (eu verifiquei manualmente ✓).
- 1 falso-refute detectado (RWA $2B). Taxa de erro dos verifiers ≥1/25 — justifica a regra "não confie, cheque".
