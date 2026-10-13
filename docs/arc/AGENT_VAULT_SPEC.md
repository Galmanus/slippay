# AgentVault (Arc) — spec curto

Status: em construção 2026-10-13. Decisões tomadas por padrão (Manuel pediu "começa a construir"); revisar.

## O que é
Contrato Solidity na Arc que guarda USDC de um dono (humano ou empresa) e deixa agentes de IA gastarem **dentro de limites impostos on-chain**, com identidade de máquina (ERC-8004) e autorização **híbrida clássica + pós-quântica** (ECDSA + SLH-DSA-SHA2-128s via precompile `0x1800…0004`). Porta para EVM a semântica do `install_agent_session` do smart-wallet Soroban (`contracts/smart-wallet/src/lib.rs`).

## Decisões padrão
1. **Dono** = um `address` imutável no construtor (EOA, Privy embedded, ou smart account). Passkey do dono via smart account 4337 fica para depois (P-256 já existe on-chain em `0x100`).
2. **Sessão** identificada pelo `agentSigner` (endereço ECDSA do agente). Uso único: reinstalar sobre a mesma chave é proibido (preserva o limite provado de 2× window_cap).
3. **PQ por faixa**: cada sessão tem `pqThreshold`. Gasto `> pqThreshold` exige também assinatura SLH-DSA sobre o mesmo digest EIP-712. `pqThreshold = 0` → todo gasto é PQ. `type(uint128).max` → nunca. Motivo medido: assinar SLH-DSA-128s leva ~2,7 s em JS (noble 0.7.1) e verificar custa ~382k gas (~US$ 0,0076) — inviável por micropagamento, ok p/ valores altos.
4. **Limites** = mesmos do Soroban: `perTxCap > 0`, `perTxCap ≤ maxAbsolutePerTx` (imutável), `perTxCap ≤ windowCap ≤ 100·perTxCap`, `windowSeconds ≥ 60`, `expiresAt` 0 ou futuro, allowlist de destinatários não-vazia e sem dono/vault/zero. Janela deslizante O(1) (`curSpent`/`prevSpent` com decaimento linear) + teto duro `prev+cur+amount ≤ 2·windowCap`.
5. **Identidade**: sessão carrega `agentId` do ERC-8004 IdentityRegistry. Se o registry estiver configurado, `ownerOf(agentId)` precisa existir na instalação.
6. **Nonce** sequencial por sessão; `deadline` por intent; `orderId` (bytes32) emitido no evento — o contrato Memo da Arc não aceita chamada vinda de contrato, então a reconciliação é pelo nosso evento.
7. **USDC** via interface ERC-20 (6 decimais) do endereço passado no construtor (`0x3600…` na Arc). Depósito por `transfer` ERC-20 ou send nativo (mesmo saldo).
8. **Qualquer um submete** o `spend` (relayer paga gas em USDC); a autorização está nas assinaturas, não em `msg.sender`.

## Digest (EIP-712)
Domain `{name:"SlippayAgentVault", version:"1", chainId, verifyingContract}`.
`Spend(address agentSigner,address to,uint256 amount,uint64 nonce,uint64 deadline,bytes32 orderId)`.
ECDSA: `ecrecover(digest)` = `agentSigner` (s baixo). SLH-DSA: `verifySlhDsaSha2128s(vk32, abi.encodePacked(digest), sig7856) == true`.

## Fora do escopo agora
Factory/proxy, passkey do dono, x402 Facilitator, ERC-8004 ValidationRegistry/attester on-chain, UI.
