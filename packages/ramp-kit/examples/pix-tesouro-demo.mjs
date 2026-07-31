#!/usr/bin/env node
/**
 * E2E demo: BRL via Pix → TESOURO (Etherfuse stablebond on Stellar) → BRL via Pix.
 *
 * Runs against the Etherfuse sandbox by default. Needs:
 *   ETHERFUSE_API_KEY   — from devnet.etherfuse.com or the Etherfuse team
 *   DEMO_WALLET         — Stellar public key (G...) holding/receiving TESOURO
 *   DEMO_EMAIL          — customer email for the sandbox account
 * Optional:
 *   ETHERFUSE_BASE_URL  — default https://api.sand.etherfuse.com
 *   DEMO_BRL            — on-ramp amount in BRL (default 100)
 *
 * Usage: ETHERFUSE_API_KEY=... DEMO_WALLET=G... DEMO_EMAIL=you@x.com npm run demo
 */

import { EtherfuseClient, RampRouter, applyMargin } from '../dist/src/index.js';

const apiKey = process.env.ETHERFUSE_API_KEY;
const wallet = process.env.DEMO_WALLET;
const email = process.env.DEMO_EMAIL;
const brl = process.env.DEMO_BRL ?? '100';

if (!apiKey || !wallet || !email) {
    console.error('missing env — need ETHERFUSE_API_KEY, DEMO_WALLET (G...), DEMO_EMAIL');
    console.error('sandbox keys: https://devnet.etherfuse.com');
    process.exit(1);
}

const etherfuse = new EtherfuseClient({
    apiKey,
    baseUrl: process.env.ETHERFUSE_BASE_URL ?? 'https://api.sand.etherfuse.com',
});

// The router is overkill with one anchor — it's here to show the selection API
// other apps use when they register more providers (CriptoPix, Manteca, ...).
const router = new RampRouter([etherfuse]);
const anchor = router.resolve({ currency: 'BRL', rail: 'pix', token: 'TESOURO' });
console.log(`[1/6] router picked: ${anchor.displayName}`);

// ── customer + KYC ──────────────────────────────────────────────────────────
let customer = await anchor.getCustomer({ email });
if (!customer) {
    customer = await anchor.createCustomer({ email, publicKey: wallet });
    console.log(`[2/6] customer created: ${customer.id}`);
} else {
    console.log(`[2/6] customer found: ${customer.id}`);
}

const kyc = await anchor.getKycStatus(customer.id, wallet);
console.log(`      kyc status: ${kyc}`);
if (anchor.getKycUrl && kyc !== 'approved') {
    const url = await anchor.getKycUrl(customer.id, wallet);
    console.log(`      complete kyc here, then re-run: ${url}`);
    process.exit(0);
}

// ── on-ramp: BRL → TESOURO ──────────────────────────────────────────────────
const quote = await anchor.getQuote({
    fromCurrency: 'BRL',
    toCurrency: 'TESOURO',
    fromAmount: brl,
    customerId: customer.id,
    stellarAddress: wallet,
});
const priced = applyMargin(quote, 190); // Slippay's 1.9% spread, shown transparently
console.log(`[3/6] quote: R$${quote.fromAmount} -> ${priced.toAmount} TESOURO ` +
    `(gross ${priced.grossToAmount}, fee ${priced.platformFee})`);

const onramp = await anchor.createOnRamp({
    customerId: customer.id,
    quoteId: quote.id,
    stellarAddress: wallet,
    fromCurrency: 'BRL',
    toCurrency: 'TESOURO',
    amount: brl,
});
console.log(`[4/6] on-ramp created: ${onramp.id}`);
if (onramp.paymentInstructions) {
    console.log('      pay this Pix code:');
    console.log(JSON.stringify(onramp.paymentInstructions, null, 2));
}

// ── poll until the TESOURO lands on-chain ───────────────────────────────────
for (let i = 0; i < 60; i++) {
    const tx = await anchor.getOnRampTransaction(onramp.id);
    console.log(`[5/6] status: ${tx?.status}${tx?.stellarTxHash ? ` tx ${tx.stellarTxHash}` : ''}`);
    if (tx?.status === 'completed' || tx?.status === 'failed') break;
    await new Promise((r) => setTimeout(r, 10_000));
}

// ── off-ramp leg (TESOURO → BRL via Pix) — quote only in the demo ───────────
const back = await anchor.getQuote({
    fromCurrency: 'TESOURO',
    toCurrency: 'BRL',
    fromAmount: priced.toAmount,
    customerId: customer.id,
    stellarAddress: wallet,
});
console.log(`[6/6] off-ramp quote: ${back.fromAmount} TESOURO -> R$${back.toAmount}`);
console.log('done — full cycle BRL -> TESOURO -> BRL demonstrated.');
