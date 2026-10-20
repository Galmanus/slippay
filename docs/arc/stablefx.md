# Circle StableFX on Arc: what the taker client relies on

Reference for `packages/arc-agent/src/stablefx.ts`. Every fact below cites the Circle doc page it
comes from (read 2026-10-20) or an on-chain read made the same day. Where the docs disagree with
themselves the ambiguity is written down here instead of guessed; the client is fail-closed on
each of them. No API key exists yet (the company still has to apply and pass KYB), so nothing in
this file was confirmed against the live API.

Sources:
- [TG] https://developers.circle.com/stablefx/concepts/technical-guide
- [QS] https://developers.circle.com/stablefx/quickstarts/fx-trade-taker
- [Q] https://developers.circle.com/api-reference/stablefx/all/create-quote
- [T] https://developers.circle.com/api-reference/stablefx/all/create-trade
- [FP] https://developers.circle.com/api-reference/stablefx/all/generate-funding-presign-data
- [F] https://developers.circle.com/api-reference/stablefx/all/fund-trade
- [RS] https://developers.circle.com/api-reference/stablefx/all/register-trade-signature (embeds the OpenAPI fragment)
- [GS] https://developers.circle.com/api-reference/stablefx/all/generate-trade-signature-data
- [CI] https://developers.circle.com/stablefx/references/contract-interfaces
- [SC] https://developers.circle.com/stablefx/references/supported-currencies
- [P2] https://developers.circle.com/stablefx/howtos/grant-usdc-allowance-permit2

## Environments and auth

- A `TEST` key runs against Arc testnet at `https://api-sandbox.circle.com/`; a `LIVE` key runs against Arc mainnet at `https://api.circle.com/` [TG].
- `Authorization: Bearer <key>`; keys look like `PREFIX:ID:SECRET` [RS].
- The product is permissioned, for financial institutions (PSPs, fintechs, OTC desks, prime brokers) [TG].

## Taker flow (single trade, gross funding)

1. `POST /v1/exchange/stablefx/quotes` with `from: { currency, amount }`, `to: { currency }`, `tenor`, `type: "tradable"`, `recipientAddress`. Give an amount on `from` or on `to`, not both [Q][QS]. `type: "reference"` gives an indicative quote without typed data [Q].
2. Sign the quote's `typedData` (Permit2 `PermitWitnessTransferFrom` with a `TraderDetails` witness) [QS].
3. `POST /v1/exchange/stablefx/trades` with `idempotencyKey` (UUIDv4), `quoteId`, `address`, `message` (the quote's `typedData.message`), `signature`. The response has `id`, `contractTradeId` and `status: "pending_settlement"` [QS][T].
4. `POST /v1/exchange/stablefx/signatures/funding/presign` with `contractTradeIds: [id]`, `type: "taker"` (required, `maker`|`taker`), and `fundingMode` (default `gross`) [FP][QS]. The response has `typedData` (Permit2 `PermitWitnessTransferFrom` with `SingleTradeWitness { id }`), `deliverables`, `receivables` [FP].
5. Sign it, then `POST /v1/exchange/stablefx/fund` with `type: "taker"`, `signature`, `permit2` (the presign message) and `fundingMode` [F][QS]. An accepted request returns a blank `200` [QS].
6. `GET /v1/exchange/stablefx/trades/{id}`: funded when `status` is `taker_funded` [QS].

Funding can also be done directly on `FxEscrow.takerDeliver(id, permit, signature)` without the API [TG][CI]. The maker then settles: the taker gets the buy currency minus the taker fee [TG].

The signature endpoints `POST /v1/exchange/stablefx/signatures` (register) and `GET .../signatures/presign/{tradeId}` are the maker side [RS][GS]; the taker client does not use them.

Prerequisite outside the API: the taker's wallet must `approve` the Permit2 contract on the token it funds with [P2][QS].

## Rules that the client enforces

- Minimum trade: quotes under 10 USDC fail [TG].
- Tenors: `instant` (30 min settlement window), `hourly` (1 h), `daily` (1 day) [TG].
- The trade and funding signatures must be submitted within 10 minutes or the trade expires [TG].
- The wallet must be individually owned (not omnibus), support Permit2 and sign EIP-712 without broadcasting [TG].
- Permit2 `spender` is "the address of the StableFX contract" [RS], which is `FxEscrow` [CI].

## Addresses

| What | Arc mainnet | Arc testnet | Source |
| --- | --- | --- | --- |
| FxEscrow | `0xe2E5F173576B513d994073CCbDaCBE027d43DFe6` | `0xd68256f4D69C6BbEcB873D8588AE0Dc6B8E22E10` | [CI]; code present on both (eth_getCode, 2026-10-20) |
| Permit2 | `0x000000000022D473030F116dDEE9F6B43aC78BA3` | same | [P2] says "same across all EVM blockchains, verify it"; code present on both (eth_getCode, 2026-10-20) |
| USDC | `0x3600000000000000000000000000000000000000` (6 decimals) | same (6) | [SC]; decimals() on-chain |
| EURC | `0xbEf5f6d51CB62b58e6A8f77868681825C6fe21c1` (6) | `0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a` (6) | mainnet [SC]; testnet from the example in [QS], symbol()/decimals() on-chain confirm EURC/6 |
| BRLA (Avenia) | `0x75700e137c05B2beb2b3A436cCB551652E3D8B11` (**18 decimals**) | not published | [SC]; decimals() on-chain = 18; nothing at that address on testnet |

The client knows only these four tokens. The other currencies in [SC] (AUDD, AUDF, CADD, CHFAU, EURAU, GBPA, JPYC, KRW1, MXNB, QCAD, SEKAU, TRYB, ZARU) are refused until someone verifies their decimals; BRLA is refused on the sandbox until Circle publishes its testnet address.

## Ambiguities (the client is fail-closed on each)

1. **Example addresses don't match FxEscrow.** Every example `spender` is `0xa8f94168…` or `0xffd21ca8…` [Q][QS][FP][F], neither of which is the published FxEscrow [CI]; the [FP] example even uses chain id 11155111 (Sepolia). Per [RS] the spender is the StableFX contract, so the client pins `spender` to FxEscrow and refuses anything else. If the sandbox returns a different spender, the pin must be reviewed against Circle, not loosened.
2. **`base`/`quote` in `Consideration`** are not defined in prose. In the [QS] example the taker sells USDC for EURC and `quote` = USDC (sell), `base` = EURC (buy), `quoteAmount` = sell amount, `baseAmount` = buy amount. The client requires exactly that mapping.
3. **`quoteId` in the witness** is typed `string` but the [QS] example carries the UUID as hex, left-padded to 32 bytes (`0x0000…c4d1da72111e4d52bdbf2e74a2d803d5`). The client requires that encoding of the quote's `id`.
4. **Fee units.** [TG] says a sell-side quote "separately adds the taker fee in the sell currency", and also that at settlement the taker receives "the buy currency minus the taker fee". The witness `fee` is a bare uint. The client assumes the worse case for the taker: it requires `baseAmount - fee` to still meet the caller's minimum.
5. **Number formats.** `rate`, `fee`, and the permit amounts are strings in some examples and numbers in others ([Q] vs [QS]); `fee` is a string in [Q] and `{ currency, amount }` in [QS]. The client accepts both and signs uints as bigint.
6. **Trade status.** [T]'s example says `"pending"`, [QS] says `"pending_settlement"`. The client accepts both as "created, awaiting funding".
7. **`authorizer`** in `TraderDetails` is undocumented beyond the zero-address example [QS]. The client accepts the zero address or the taker itself.
8. **Permit deadline.** Not specified. The client requires it in the future and within 2 days (the longest tenor is 1 day [TG]).

## Blocked on the API key

Everything that needs Circle's servers: a real quote, a real trade, confirming the spender pin, the fee semantics (4) and the status names (6) against the sandbox, BRLA's testnet address, and Circle's KYB. The client is tested only against the documented shapes with a fake `fetch`.
