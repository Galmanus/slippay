# Arc (Circle) — base de conhecimento p/ o slippay

Estudo feito em 2026-10-13 a partir de `docs.arc.network/llms-full.txt` (146 páginas, 1,58 MB) + páginas da Circle (`developers.circle.com`) sobre CCTP↔Stellar, Gateway, StableFX, x402. Contexto: slippay na **Arc Acceleration Season** (programa Circle p/ fintech/IA LatAm, 22/09–24/10/2026: onboarding → build testnet (App Kits, Gateway, StableFX) → ship mainnet → Demo Day).

**Cobertura:** lido na íntegra = conceitos, referências, integrate/*, build/*, App Kits (todas as capacidades + SDK reference), tutoriais memo/batch/ERC-8004/ERC-8183/monitor, Circle CCTP Stellar↔Arc, Gateway, StableFX, x402. Lido por títulos/prosa = Circle Contracts (deploy/interact templates), operação de nó (run-an-arc-node, systemd, Prometheus). Abas de linguagem alternativas (Python/ethers quando havia viem) puladas.

**Verificado ao vivo (2026-10-13 ~13:40 BRT):** `rpc.mainnet.arc.io` → chainId `0x13b2`=5042, bloco 25.776.374, gasPrice 20,000001 gwei; bloco 1 = 2026-05-15 13:58 UTC. `rpc.testnet.arc.io` → 5042002, bloco 67.013.428, 25 gwei. Custo real mainnet: send nativo 21k gas = **US$ 0,00042**; transfer ERC-20 ~65k = **US$ 0,0013**.

---

## 1. Rede
- L1 da Circle. Consenso **Malachite** (Tendermint BFT, PoA permissionado, validadores = instituições SOC2, proposer rotativo). Execução **Reth**. EVM baseline **Osaka** (EIP-7702 ok) + EIP-7708 adiantado.
- Chain ID **mainnet 5042 / testnet 5042002**. viem ≥2.38: `import { arc, arcTestnet } from "viem/chains"` (slippay usa viem ^2.53 → já tem).
- RPC: `https://rpc.mainnet.arc.io` (anônimo, CORS aberto) / `wss://` idem; testnet `https://rpc.testnet.arc.io`. Alternativos: Alchemy (`arc-mainnet.g.alchemy.com/v2/KEY`), Blockdaemon, dRPC, QuickNode, Goldsky (paga por request via x402).
- Explorer `explorer.arc.io` / `explorer.testnet.arc.io` (Blockscout; verify com `--verifier blockscout --verifier-url https://explorer.testnet.arc.io/api/`). Faucet `faucet.circle.com` (USDC, EURC, cirBTC testnet). Status `status.arc.io`. **Gas USDC mainnet: pedir ao contato Circle** ou trazer via CCTP.
- Bloco ~0,48–0,5 s; benchmark 3.000+ TPS c/ 20 validadores, finality <350 ms; 30M gas/bloco.
- **Finalidade determinística**: tx = pending OU final. 1 confirmação basta. `safe`/`finalized` = latest. Sem reorg.
- Gotchas RPC: `eth_getLogs` máx **10.000 blocos** (erro -32012, ~85 min); RPC primário load-balanced → **-32014** perto do head (retry c/ backoff). Timestamps **não-decrescentes** (granularidade 1 s) → ordenar por `blockNumber`+`logIndex`.
- Não disponível ainda: **APS** (privacidade confidencial, TEE + X-Wing KEM), **Stablecoin Services** (paymaster nativo, gas multi-stablecoin). PQ: só verificação SLH-DSA-SHA2-128s via precompile `0x1800..04` (live na mainnet).

## 2. USDC nativo — o ponto que mais quebra código
- USDC é o gas token. **Um saldo, duas interfaces**: nativo **18 dec** (`eth_getBalance`, `msg.value`, gas, fees) e ERC-20 em `0x3600000000000000000000000000000000000000` **6 dec** (`balanceOf`, approve, transferFrom, EIP-3009, permit). Mesmo endereço em mainnet e testnet.
- `balanceOf` trunca 12 casas → `balanceOf==0` ≠ saldo zero (dust gastável como gas). Mostrar **uma** linha de saldo. Converter nativo→display: `/1e12` p/ 6 dec.
- Nunca misturar `msg.value` (18) com `balanceOf` (6). Não existe WUSDC; não aliasar `0xEeee…` (EIP-7528) p/ 0x3600.
- **Allowance não limita gasto nativo**: `approve` só governa `transferFrom`; módulo com execução numa smart account move USDC nativo sem allowance.
- Regras de valor: send com valor p/ `address(0)` **reverte** ("Zero address not allowed"); burn proibido; **blocklist** — sender bloqueado é rejeitado antes do mempool (sem gas); destinatário bloqueado → tx incluída, `status 0`, **gas consumido**. SELFDESTRUCT move o USDC do contrato; CALL com valor p/ conta destruída reverte.
- `PREVRANDAO`=0 (sem aleatoriedade on-chain), EIP-4788 vazio, blobs (type-3) rejeitados.
- Endereço blocklisted de teste (testnet): `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` (mnemonic "test…junk" índice 1).
- EIP-712 domain do USDC: `{name:"USDC", version:"2", chainId, verifyingContract:0x3600…}` → EIP-3009 `transferWithAuthorization` (~65k gas).
- Testar com **Arc Foundry** (`arc-forge`, `arc-cast`, `arc-anvil --network arc`, `arc-forge test --network arc`); anvil comum NÃO reproduz precompile/EIP-7708/blocklist. `arc-cast run <tx>` reproduz revert de blocklist.

## 3. Eventos / indexação
- Emissor de sistema **EIP-7708**: `0xffffFFFfFFffffffffffffffFfFFFfffFFFfFFfE` emite `Transfer(from,to,value)` **18 dec** p/ TODO movimento (send nativo, perna nativa do ERC-20, mint/burn, CREATE com valor, selfdestruct). É o primeiro log do tx. Zero-value e self-transfer não emitem. topic0 `0xddf252ad…b3ef`.
- Contrato 0x3600 emite seu próprio `Transfer` **6 dec** só p/ chamadas ERC-20 → **transfer() ERC-20 gera 2 logs**. Detectar pagamento = filtrar SÓ o emissor de sistema (filtrar 0x3600 perde sends nativos; filtrar os dois duplica). Creditar em 18 dec.
- Gas não emite evento (`gasUsed × effectiveGasPrice`).
- Relayer EIP-3009/ERC-4337: atribuir pelo `from` do Transfer, nunca `tx.from` (é o relayer/bundler).
- USDC 0x3600 também emite `Blocklisted(account)` / `UnBlocklisted(account)`.
- Circle Contracts tem event monitors + webhooks (`contracts.eventLog`), mas p/ USDC precisa monitor no emissor de sistema.

## 4. Fees
- EIP-1559 + **EWMA** da utilização; base fee NÃO é queimada; alvo ~US$ 0,001/transfer ERC-20. Próximo base fee no `extra_data` do header pai (8 bytes BE).
- **`maxFeePerGas` ≥ 20 gwei** — abaixo disso a tx é **dropada em silêncio** (sem erro, sem receipt). Defaults de ETH/L2 costumam estar abaixo → clamp. Teto 20.000 gwei. Priority 0 ok (1 gwei sob carga).
- Mostrar fee em US$ ("< $0.01"), nunca "ETH"/"Gwei" (viem/ethers rotulam ETH por padrão).
- Errata da doc: `gas-and-fees` usa `value: parseUnits("1", 6)` num send NATIVO (errado: nativo = 18 dec); página de ramps diz "native decimals 6" (errado); `fee-display` usa RPC `rpc.arc.circle.com` não listado.

## 5. Contratos (mainnet | testnet)
| | mainnet | testnet |
|-|-|-|
| USDC (ERC-20 6 dec) | `0x3600000000000000000000000000000000000000` | idem |
| EURC (6) | `0xbEf5f6d51CB62b58e6A8f77868681825C6fe21c1` | `0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a` |
| USYC (6, institucional não-US, min $100k) | `0x8a5D989Bbb96929F689B0200f435f53dA42bF490` | `0xe9185F0c5F296Ed1797AaE4238D26CCaBEadb86C` |
| cirBTC (8) | `0x171A4217b86A807A64eB94757Db6849fb4bDbAA0` | `0xf0C4a4CE82A5746AbAAd9425360Ab04fbBA432BF` |
| WETH bridged (18) | `0x128cC466B61f542da60c70e3aA11c10e19B84EDB` | `0x2c4047028a72803939b6fb674D01bC059B5C4961` |
| CCTP TokenMessengerV2 (domínio **26**) | `0x28b5a0e9C621a5BadaA536219b3a228C8168cf5d` | `0x8FE6B999Dc680CcFDD5Bf7EB0974218be2542DAA` |
| CCTP MessageTransmitterV2 | `0x81D40F21F12A8F0E3252Bccb954D722d4c464B64` | `0xE737e5cEBEEBa77EFE34D4aa090756590b1CE275` |
| CCTP TokenMessengerWithFees | `0x71f54F818671cD0D7ea140Da213e5C8b5C92a408` | `0x8745D906D67C346E5eb1aEEED38Eb87F34DF0C0A` |
| CCTP TokenMinterV2 / MessageV2 / CrossChainTokenService | `0xfd78EE91…` / `0xec546b6B…` / `0x43187122…` | `0xb43db544…` / `0xbaC0179b…` / `0x63753E72…` |
| Gateway Wallet | `0x77777777Dcc4d5A8B6E418Fd04D8997ef11000eE` | `0x0077777d7EBA4688BDeF3E311b846F25870A19B9` |
| Gateway Minter | `0x2222222d7164433c4C09B0b0D809a9b52C04C205` | `0x0022222ABE238Cc2C7Bb1f21003F0a260052475B` |
| StableFX FxEscrow | `0xe2E5F173576B513d994073CCbDaCBE027d43DFe6` | `0xd68256f4D69C6BbEcB873D8588AE0Dc6B8E22E10` |
| **Memo** | `0x5294E9927c3306DcBaDb03fe70b92e01cCede505` | idem |
| **Multicall3From** | `0x522fAf9A91c41c443c66765030741e4AaCe147D0` | idem |
| ERC-8004 Identity/Reputation/Validation | `0x8004A169…a432` / `0x8004BAa1…9b63` / `0x8004Cc84…AB58` | `0x8004A818BFB912233c491871b3d84c89A494BD9e` / `0x8004B663056A597Dffe9eCcC1965A193B7388713` / `0x8004Cb1BF31DAf7788923b405b754f57acEB4272` |
| ERC-8183 AgenticCommerce (ref impl) | — | `0x0747EEf0706327138c69792bF28Cd525089e4583` |
| Permit2 / Multicall3 / CREATE2 | `0x000000000022D473030F116dDEE9F6B43aC78BA3` / `0xcA11bde05977b3631167028862bE2a173976CA11` / `0x4e59b44847b379578588920cA78FbF26c0B4956C` | idem |
| EntryPoint v0.7 (doc pede verificar) | `0x0000000071727De22E5E9d8BAf0edAc6f37da032` | idem |
- Precompiles `0x1800..00` NativeCoinAuthority · `..01` NativeCoinControl (blocklist) · `..02` SystemAccounting · `..03` CallFrom · `..04` PQ SLH-DSA verify.

## 6. Memo e batch (reconciliação de pedidos)
- `Memo.memo(target, data, bytes32 memoId, bytes memoData)` encaminha a chamada (ex.: `USDC.transfer`) via CallFrom preservando `msg.sender`. Eventos: `BeforeMemo(memoIndex)` → eventos do alvo → `Memo(sender idx, target idx, callDataHash, memoId idx, memo, memoIndex)` (topic `0xeb15ee72…a5e4`). `memoId` indexado → busca por pedido/fatura sem tx hash.
- **Só EOA chamando direto.** ERC-4337/Circle SCA/Safe/Privy smart wallet → revert (anti-spoofing). Sem STATICCALL/DELEGATECALL. Se a chamada filha reverte, tudo reverte (`MemoFailed`).
- `Multicall3From.aggregate3(Call3[])` batch preservando sender; só EOA; **sem valor** (não há aggregate3Value).
- Compliance: monitorar Memo/Multicall3From atribuindo ao sender original.

## 7. CCTP e a ponte Stellar ↔ Arc (essencial p/ o slippay)
- Arc domínio **26**, Stellar **27**. Iris: mainnet `https://iris-api.circle.com`, sandbox `https://iris-api-sandbox.circle.com`; `GET /v2/messages/{srcDomain}?transactionHash=…` (rate limit 40 req/s, excedeu → bloqueio 5 min). Fee CCTP FAST 1–14 bps; Standard 0.
- **Quickstart oficial existe**: developers.circle.com/cctp/quickstarts/transfer-usdc-stellar-arc.
  - **Stellar → Arc**: `approve` no USDC SAC Stellar p/ TokenMessengerMinter; `deposit_for_burn(from, amount i128 [7 dec!], 26, mintRecipient=bytes32(pad(evmAddr)), burnToken=USDC SAC, destination_caller=32 zero bytes, max_fee, 1000=fast|2000=std)`; Iris; `receiveMessage(message, attestation)` no MessageTransmitterV2 da Arc.
  - **Arc → Stellar**: `approve` 0x3600 p/ TokenMessengerV2; `depositForBurnWithHook(amount 6 dec, 27, mintRecipient=CctpForwarder bytes32, USDC, destinationCaller=CctpForwarder bytes32, maxFee, 2000, hookData)`; hookData = 24 bytes zero + uint32 versão 0 + uint32 len + strkey UTF-8 (G/C/M); Iris; `mint_and_forward(message, attestation)` no CctpForwarder Stellar (atômico, não-custodial). **mintRecipient/destinationCaller errados = fundos presos para sempre.** G/M precisam trustline USDC.
  - Testnet Stellar: TokenMessengerMinter `CDNG7HXAPBWICI2E3AUBP3YZWZELJLYSB6F5CC7WLDTLTHVM74SLRTHP`, CctpForwarder `CA66Q2WFBND6V4UEB7RD4SAXSVIWMD6RA4X3U32ELVFGXV5PJK4T4VSZ`, USDC SAC `CBIELTK6YBZJU5UP2WWQEUCYKLPU6AUNZ2BQ4WWFEIE3USCIHMXQDAMA`. Mainnet (memória slippay 06/2026): CctpForwarder `CBZL2IH7F6BIDAA3WBNXYKIXSATJGMSW7K5P5MJ6STX5RXN47TZJDF5T`, MessageTransmitter `CACMENFFJPJMSDAJQLX4R7K3SFZIW2LJSE3R2UMLGSWHFHS353FVXAZV`, TokenMessengerMinter `CAE2G5Z77UP7GYPYGFOWFGW7C7J6I4YP2AFGSADRKQY62SYUFLPNFTXL` — reconferir em cctp/references/stellar-contracts antes de mainnet.
- ⚠ **App Kit NÃO faz bridge com Stellar**: `Stellar` existe no enum `Blockchain` do SDK, mas não em `BridgeChain` nem `UnifiedBalanceChain`. Gateway também não tem Stellar. → Stellar↔Arc = CCTP cru (acima).
- Para EVM↔Arc use App Kit `kit.bridge` (abaixo) ou CCTP cru.

## 8. App Kits (`@circle-fin/app-kit`)
- Adapters: `@circle-fin/adapter-viem-v2` (`createViemAdapterFromProvider({provider})` no browser via EIP-6963; `createViemAdapterFromPrivateKey` no server; `getPublicClient/getWalletClient` p/ RPC custom), `adapter-ethers-v6` (evitar no browser em fluxo cross-chain: BrowserProvider quebra ao trocar rede), `adapter-solana(-kit)`, `adapter-circle-wallets` (server-only; precisa `address` no contexto). Constantes: `import { ArcTestnet } from "@circle-fin/app-kit/chains"`.
- Identificadores: `Arc`, `Arc_Testnet`, `Base`, `Base_Sepolia`, `Ethereum_Sepolia`, `Optimism`, `Polygon`, `Solana_Devnet`… Arc é a única rede com as 7 capacidades.
- **Send** `kit.send({from:{adapter,chain}, to, amount:"1.00", token})` → BridgeStep.
- **Bridge** `kit.bridge({from, to:{adapter|recipientAddress, chain, useForwarder}, amount, token?, config:{transferSpeed, maxFee, customFee, feePayment:"source", batchTransactions}})`; `kit.estimateBridge`; `kit.retryBridge(result,{from,to})`; steps approve→burn→fetchAttestation→mint; EIP-5792 batch approve+burn; Forwarding Service = Circle submete o mint (dispensa wallet no destino). Saindo da Arc testnet: amount > ~1,4 USDC ou revert "Max fee must be less than amount".
- **Swap**: só mainnet, exceto Arc testnet; na Arc só **USDC/EURC/cirBTC**; provider fee 2 bps; `slippageBps` default 300; `stopLimit`; `apiKey` (kitKey é legado); liquidez testnet instável.
- **Unified Balance** (= Gateway): deposit de várias redes → `spend` instantâneo; Gateway fee 0,5 bp cross-chain; delegates (backend assina por um dono; Privy server wallet e Circle SCA precisam de delegate); `removeFund` 7 dias (escape hatch); fast deposits Arbitrum/Ethereum/OP/…→ Arc.
- **Onramp**: widget hospedado `onramp.arc.io` compra USDC/EURC na Arc; sessão server (`createAppServerKit`, `createSessionRouteHandler`, 30 min); cartão/Apple/Google Pay exige **KYB** + `referrerDomain`; banco só EUA/UE. **Brasil/Pix não citados.** Webhooks = fonte de verdade.
- **Earn**: vaults **Morpho** na Arc (ex. "Steakhouse USDC"), USDC/EURC, `exploreVaults` → `getDepositQuote` → `deposit` → `getPosition` (pnl) → `withdraw`; sem fee same-chain; performance 0–50%, mgmt 0–5% (curador); API key só server-side.
- **Borrow**: cirBTC → USDC (Morpho), health bands, webhooks, `idempotencyKey`, `integratorFeeBps`.
- **Monetização embutida**: `customFee` em bridge/swap/unified-balance/borrow → **90% p/ nós, 10% p/ Arc/Circle**. `kit.setCustomFeePolicy({bridge, swap, unifiedBalance})`.
- Telemetria: o SDK manda analytics/erros p/ Circle por padrão → `new AppKit({ disableAnalytics: true, disableErrorReporting: true })`.

## 9. StableFX (FX on-chain na Arc) — o ângulo LatAm
- RFQ off-chain (makers via Talos, resposta <500 ms) + settlement **PvP** on-chain no FxEscrow da Arc; Permit2 obrigatório; tenor `instant` (30 min) | `hourly` | `daily`; mínimo 10 USDC; fee taker/maker; webhooks; Settlement Advance (crédito p/ maker).
- **Permissionado**: só instituições vetadas; API key via representante Circle (`TEST` → sandbox/Arc testnet, `LIVE` → Arc mainnet). Arc mainnet suportada desde **2026-09-16**.
- Moedas na Arc mainnet incluem **BRLA (real, emissor Avenia) `0x75700e137c05B2beb2b3A436cCB551652E3D8B11`**, **MXNB (peso MX, Bitso) `0xF197FFC28c23E0309B5559e7a166f2c6164C80aA`**, EURC, AUDD/AUDF, CADD/QCAD, CHFAU, EURAU, GBPA, JPYC, KRW1, SEKAU, TRYB, ZARU.

## 10. Agentes / x402
- **Facilitator Service** (Circle): facilitator x402 hospedado, EIP-3009 `exact`, settle em **Arc**, Base, Polygon; Circle paga gas e faz screening; trial sem chave; "Arc settlements are final" (Base/Polygon têm risco de reorg).
- **Gateway Nanopayments**: x402 com pagamentos até US$ 0,000001, assinatura off-chain, settlement em lote; comprador pré-deposita no Gateway; SDK `@circle-fin/x402-batching`; só EOA (sem ERC-1271).
- **ERC-8004** (identidade NFT `register(uri)`, reputação `giveFeedback(...)` — dono não avalia o próprio agente, validação request/response) mainnet+testnet. **ERC-8183** jobs com escrow USDC (createJob → setBudget → approve+fund → submit(hash) → complete) só testnet.
- Circle Agent Stack: Circle CLI, agent wallets com política de gasto, Agent Marketplace / Discovery API.

## 11. Carteiras / AA
- EOA padrão (secp256k1, BIP-44 m/44'/60', mesmo endereço do Ethereum). ERC-4337 com EntryPoint v0.7 (Pimlico, Alchemy, Biconomy, ZeroDev, Privy, Dynamic, Turnkey, Crossmint, MetaMask Embedded, Para, Thirdweb, Circle Modular Wallets c/ **passkey**). Depósito de paymaster em USDC nativo 18 dec (10 USDC = 10e18). EIP-7702 funciona.
- Relayer EIP-3009: EOA paga gas em USDC por usuário que só assina EIP-712.
- Circle Gas Station patrocina gas de SCAs Circle (~0,006 USDC/tx testnet).
- Circle SCA não assina permit (ecrecover ≠ ERC-1271) → `allowanceStrategy: "approve"`.

## 12. Ferramentas
- Arc Studio (studio.arc.io, só testnet) + `@circle-fin/arc-studio-cli` (`arc-studio skills install --tool claude-code`). MCP de docs: `claude mcp add --transport http arc-docs https://docs.arc.io/mcp`. Skills Circle: `/plugin marketplace add circlefin/skills`. MCP Circle (SDK/endereços): `https://api.circle.com/v1/codegen/mcp`.
- Sample apps circlefin: arc-commerce, arc-p2p-payments (passkey + gasless), arc-escrow, arc-nanopayments (x402), arc-ecommerce-payments, usdc-onramp-demo, arc-multichain-wallet, arc-fintech, arc-stablecoin-fx, arc-defi-lend-borrow, arc-prediction-markets.
- Indexers: Alchemy, Envio, Goldsky, Pinax, The Graph, Thirdweb, Zerion. Oráculos: Chainlink, Chronicle, Pyth, RedStone, Stork. Compliance: Chainalysis, Elliptic, TRM.
- Nó próprio: 64 GB RAM, 1 TB NVMe, bootstrap só por snapshot (testnet ~68+16 GB comprimido), v0.8.0. Não vale p/ o slippay agora.

## 13. Encaixe no slippay (preliminar — design ainda não aprovado)
- Base técnica pronta: ComexBase já é viem + Privy + ERC-4337 (Base) → retarget p/ `arc` é configuração, não reescrita; viem ^2.53 no repo.
- Peças candidatas: (a) checkout/QR com settlement em USDC na Arc (final <1 s, ~US$ 0,0004/tx); (b) ponte Stellar↔Arc via CCTP p/ ligar o produto Stellar atual; (c) USDC↔BRLA via StableFX (exige ser instituição aprovada); (d) cofre via Earn/Morpho; (e) x402 via Facilitator Service; (f) receita via customFee 90/10.
- Riscos conhecidos: Memo não funciona com smart wallet (Privy/4337) → reconciliação no app ou contrato próprio; Onramp sem Pix; StableFX permissionado; App Kit sem Stellar; Swap na Arc só USDC/EURC/cirBTC; piso de 20 gwei derruba tx em silêncio; 18 vs 6 decimais.
