import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EtherfuseClient, RampRouter } from '../src/index.js';

test('EtherfuseClient declares TESOURO over Pix on Stellar', () => {
    const c = new EtherfuseClient({ apiKey: 'test', baseUrl: 'https://api.sand.etherfuse.com' });
    assert.equal(c.name, 'etherfuse');
    assert.ok(c.supportedTokens.some((t) => t.symbol === 'TESOURO'));
    assert.ok(c.supportedCurrencies.includes('BRL'));
    assert.ok(c.supportedRails.includes('pix'));
});

test('router routes BRL/pix/TESOURO to the real EtherfuseClient', () => {
    const c = new EtherfuseClient({ apiKey: 'test', baseUrl: 'https://api.sand.etherfuse.com' });
    const router = new RampRouter([c]);
    assert.equal(router.resolve({ currency: 'BRL', rail: 'pix', token: 'TESOURO' }), c);
});
