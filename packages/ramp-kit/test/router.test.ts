import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RampRouter, applyMargin, clampMarginBps, AnchorError } from '../src/index.js';
import type { Anchor, Quote, GetQuoteInput } from '../src/index.js';

/** Minimal fake anchor: only the surface the router touches. */
function fakeAnchor(opts: {
    name: string;
    currencies: string[];
    rails: string[];
    tokens?: string[];
    rate?: number; // toAmount = fromAmount * rate
    fail?: boolean;
}): Anchor {
    return {
        name: opts.name,
        displayName: opts.name,
        capabilities: { kycUrl: false, requiresOffRampSigning: false, kycFlow: 'api' },
        supportedTokens: (opts.tokens ?? []).map((symbol) => ({ symbol, name: symbol, issuer: 'G'.padEnd(56, 'A') })),
        supportedCurrencies: opts.currencies,
        supportedRails: opts.rails,
        async getQuote(input: GetQuoteInput): Promise<Quote> {
            if (opts.fail) throw new AnchorError('provider down', 'DOWN', 502);
            const from = parseFloat(input.fromAmount ?? '0');
            return {
                id: `${opts.name}-q1`,
                fromCurrency: input.fromCurrency,
                toCurrency: input.toCurrency,
                fromAmount: String(from),
                toAmount: String(from * (opts.rate ?? 1)),
                exchangeRate: String(opts.rate ?? 1),
                fee: '0',
                expiresAt: new Date(0).toISOString(),
                createdAt: new Date(0).toISOString(),
            };
        },
        async createCustomer() { throw new Error('unused'); },
        async getCustomer() { return null; },
        async createOnRamp() { throw new Error('unused'); },
        async getOnRampTransaction() { return null; },
        async getFiatAccounts() { return []; },
        async createOffRamp() { throw new Error('unused'); },
        async getOffRampTransaction() { return null; },
        async getKycStatus() { return 'approved' as const; },
    } as unknown as Anchor;
}

const etherfuse = fakeAnchor({
    name: 'etherfuse', currencies: ['BRL', 'MXN'], rails: ['pix', 'spei'],
    tokens: ['TESOURO', 'CETES'], rate: 0.18,
});
const criptopix = fakeAnchor({
    name: 'criptopix', currencies: ['BRL'], rails: ['pix'], tokens: ['USDT'], rate: 0.17,
});
const koywe = fakeAnchor({
    name: 'koywe', currencies: ['CLP'], rails: ['spei'], rate: 0.001,
});

test('resolve picks first anchor matching currency+rail', () => {
    const router = new RampRouter([etherfuse, criptopix, koywe]);
    assert.equal(router.resolve({ currency: 'BRL', rail: 'pix' })?.name, 'etherfuse');
    assert.equal(router.resolve({ currency: 'CLP' })?.name, 'koywe');
    assert.equal(router.resolve({ currency: 'ARS' }), null);
});

test('resolve filters by token and provider pin', () => {
    const router = new RampRouter([criptopix, etherfuse]);
    assert.equal(router.resolve({ currency: 'BRL', token: 'TESOURO' })?.name, 'etherfuse');
    assert.equal(router.resolve({ provider: 'criptopix' })?.name, 'criptopix');
});

test('candidates is case-insensitive', () => {
    const router = new RampRouter([etherfuse]);
    assert.equal(router.candidates({ currency: 'brl', rail: 'PIX', token: 'tesouro' }).length, 1);
});

test('bestQuote fans out and picks highest toAmount', async () => {
    const router = new RampRouter([criptopix, etherfuse]);
    const r = await router.bestQuote({ fromCurrency: 'BRL', toCurrency: 'USDC', fromAmount: '100' });
    assert.equal(r.best.anchor.name, 'etherfuse'); // 0.18 > 0.17
    assert.equal(r.all.length, 2);
    assert.equal(r.failed.length, 0);
});

test('bestQuote survives a failing provider', async () => {
    const broken = fakeAnchor({ name: 'broken', currencies: ['BRL'], rails: ['pix'], fail: true });
    const router = new RampRouter([broken, criptopix]);
    const r = await router.bestQuote({ fromCurrency: 'BRL', toCurrency: 'USDC', fromAmount: '50' });
    assert.equal(r.best.anchor.name, 'criptopix');
    assert.equal(r.failed.length, 1);
    assert.equal(r.failed[0].anchor.name, 'broken');
});

test('bestQuote throws NO_ROUTE / NO_QUOTE', async () => {
    const broken = fakeAnchor({ name: 'broken', currencies: ['BRL'], rails: ['pix'], fail: true });
    const router = new RampRouter([broken]);
    await assert.rejects(
        router.bestQuote({ fromCurrency: 'CLP', toCurrency: 'USDC', fromAmount: '1' }),
        (e: AnchorError) => e.code === 'NO_ROUTE',
    );
    await assert.rejects(
        router.bestQuote({ fromCurrency: 'BRL', toCurrency: 'USDC', fromAmount: '1' }),
        (e: AnchorError) => e.code === 'NO_QUOTE',
    );
});

test('empty router is rejected at construction', () => {
    assert.throws(() => new RampRouter([]), (e: AnchorError) => e.code === 'NO_ANCHORS');
});

test('applyMargin reduces output and reports the fee', () => {
    const q = applyMargin({ toAmount: '100' }, 190);
    assert.equal(q.toAmount, '98.1');
    assert.equal(q.grossToAmount, '100');
    assert.equal(q.platformFee, '1.9');
    assert.equal(q.platformFeeBps, 190);
});

test('clampMarginBps guards the cap and garbage', () => {
    assert.equal(clampMarginBps(190), 190);
    assert.equal(clampMarginBps(5000, 190), 190);
    assert.equal(clampMarginBps(NaN, 190), 190);
    assert.equal(clampMarginBps(-1, 0), 0);
});
