# Guardião — recuperação + herança non-custodial no smart wallet passkey

Data: 2026-07-21 · Status: aguardando aprovação do Manuel · Feature 1 de 4 do roadmap "conta de família"

## O que é (copy pra mãe)

> "Escolha alguém de confiança. Se você ficar 6 meses sem usar a conta, essa pessoa
> pode recuperar o seu dinheiro pra família. Sem cartório, sem inventário.
> Você pode trocar ou tirar o guardião quando quiser, com um toque."

Mata a objeção nº 1 do non-custodial ("e se eu perder o celular? e se eu faltar?")
sem criar custódia: o guardião NUNCA move fundos; ele só pode, depois de muita
inatividade comprovada e uma janela de contestação, **rotacionar a passkey** da
conta para um novo aparelho. A conta continua a mesma (saldo, cofre, histórico);
o que muda é quem consegue aprovar com o rosto.

## Decisões de design

1. **Herança = rotação de chave, não transferência de fundos.** `finish_recovery`
   troca `passkey_pubkey`/`cred_id`; nada sai da conta. Isso herda TUDO
   (USDC, shares do cofre DeFindex, trustlines futuras) sem varrer ativos.
2. **Sinal de vida = toque de Face ID real, e só isso.** `last_alive` bumpa
   exclusivamente no caminho `WalletAuth::Passkey` com `verify_webauthn` OK.
   Pull-policy (merchant) e Agent NÃO bumpam (threat #1 — autopay manteria
   uma conta de falecida "viva" pra sempre).
3. **Uma pessoa, um guardião (v1).** Multi-guardião (2-de-3) fica pra v2.
4. **Admin fica de fora.** Nenhuma função de guardião aceita admin. Slippay
   não vira custodiante por porta lateral.
5. **Fail-safe na direção do dono.** Qualquer uso da passkey durante a
   contestação cancela a recuperação e re-arma o timer.

## Contrato (contracts/smart-wallet)

Novas variantes de `DataKey` (instance storage):
- `Guardian` → `Address` (G ou C; conta Slippay do familiar é um C-address)
- `LastAlive` → `u64` (ledger timestamp)
- `InactivitySecs` → `u64` (piso `MIN_INACTIVITY = 90d`; default sugerido 180d)
- `ContestSecs` → `u64` (piso `MIN_CONTEST = 30d`)
- `RecoveryStartedAt` → `u64` (ausente = sem recuperação ativa)
- `RecoveryCooldownUntil` → `u64` (anti-griefing, threat #5)
- (reservado p/ feature 2, não implementado agora: `Frozen`)

Funções novas (todas emitem evento; nenhuma aceita admin):
- `set_guardian(guardian, inactivity_secs, contest_secs)` — auth: dono (passkey).
  Rejeita guardian == wallet || guardian == admin; aplica pisos; se houver
  recuperação ativa, cancela (dono agiu ⇒ vivo).
- `remove_guardian()` — auth: dono. Cancela recuperação ativa.
- `heartbeat()` — auth: dono (passkey). Só bumpa `LastAlive`. Patrocinável
  pelo relayer (allowlist nova no validateSponsorable, mesma classe do vault).
- `start_recovery()` — auth: guardião. Exige `now >= LastAlive + InactivitySecs`
  e `now >= RecoveryCooldownUntil`. Seta `RecoveryStartedAt`. Evento vigiado
  pelo watcher (push/email pra dona).
- `cancel_recovery()` — auth: dono OU guardião. Se dono: bumpa `LastAlive`,
  seta cooldown de 30d (threat #5).
- `finish_recovery(new_pubkey, new_cred_id)` — auth: guardião. Exige
  `now >= RecoveryStartedAt + ContestSecs`. Atomicamente: revoga TODAS as
  policies e sessões de agente (threat #4), rotaciona passkey, limpa estado
  de recuperação, bumpa `LastAlive`.

Mudança no `__check_auth`: no caminho Passkey, após `verify_webauthn` OK,
`LastAlive = now` (mesmo padrão de escrita do `last_charge_at`). Nos caminhos
pull-policy e Agent: nenhuma escrita em `LastAlive`.

Aritmética de prazos com `checked_add`/`saturating_add` (u64). Sem calls
externas em nenhuma fn nova (reentrância N/A).

## Fora do contrato

- **Watcher (165, cron)**: observa eventos `start_recovery`/`cancel` dos wallets
  conhecidos; push + email pra dona ("Alguém pediu pra recuperar sua conta.
  Foi você que pediu? Se não reconhece, toque aqui" → cancel com Face ID).
- **Relayer**: allowlist de `heartbeat`/`start_recovery`/`cancel_recovery`/
  `finish_recovery` no `validateSponsorable` (target = wallet do usuário,
  caller contrato; mesma postura do branch do vault: sponsor só paga gás).
- **TTL/archival (threat #8)**: 180d parado arquiva a instância; o fluxo do
  guardião no app faz restore permissionless + start na mesma leva; keeper de
  TTL no cron pros wallets com saldo.
- **App**: tela "Proteção de família" (escolher guardião por link/QR de conta
  Slippay); banner de contestação; pedido de heartbeat quando faltar 30d.

## Migração

Wasm novo só pra contas novas. Base atual de usuários reais = zero; contas de
teste não migram. O hash novo entra no `RELAYER_WASM_HASH` quando shipar.

## Testes (gate de done)

Unit (os que provam o threat model): pull-policy NÃO bumpa LastAlive; Agent não
autoriza heartbeat/cancel; admin rejeitado em todas as fns novas; pisos de
parâmetro; cooldown; finish antes do prazo falha; finish revoga policies+sessões
e rotaciona; uso do dono durante contestação cancela. E2e testnet nos moldes do
cofre: deploy → set_guardian → simular inatividade → start → contest-cancel →
start → finish → herdeiro assina. Pisos em teste: feature Cargo `test-floors`
(compila MIN_INACTIVITY/MIN_CONTEST em segundos) usada SÓ no wasm de e2e
testnet; o wasm de produção compila sem a feature e os pisos de 90d/30d são
constantes — o hash pinado no relayer é o de produção, então um wasm de teste
em mainnet é estruturalmente impossível sem trocar o env do 165.

## Riscos aceitos (v1)

Guardião comprometido + dona genuinamente ausente T+30d = takeover indevido
(P baixa, dupla condição rara). Mitigação futura: multi-guardião. Threat model
completo na conversa de 21/07 (STRIDE + bateria Soroban).
