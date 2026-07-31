/**
 * Multi-anchor ramp router.
 *
 * Abstracts N fiat on/off-ramp providers (Etherfuse, CriptoPix, ...) behind one
 * interface so an app can pick the best ramp per currency/rail — or let the
 * router pick by fanning out live quotes and returning the best one.
 *
 * The router itself holds no credentials: each {@link Anchor} is constructed by
 * the host app with its own config. This module is pure routing logic.
 *
 * @example
 * ```ts
 * const router = new RampRouter([etherfuse, criptopix]);
 * const anchor = router.resolve({ currency: 'BRL', rail: 'pix' });
 * const best = await router.bestQuote({
 *   fromCurrency: 'BRL', toCurrency: 'TESOURO', fromAmount: '100',
 * });
 * ```
 */

import type { Anchor, GetQuoteInput, Quote } from './types.js';
import { AnchorError } from './types.js';

/** Criteria for selecting an anchor. All fields optional; omitted = no filter. */
export interface RouteQuery {
    /** ISO 4217 fiat currency the user pays or receives (e.g. `"BRL"`, `"MXN"`). */
    currency?: string;
    /** Payment rail (e.g. `"pix"`, `"spei"`). */
    rail?: string;
    /** Token symbol the user ends up holding (e.g. `"TESOURO"`, `"USDC"`). */
    token?: string;
    /** Provider name to pin (e.g. `"etherfuse"`). Skips scoring. */
    provider?: string;
}

/** A quote annotated with the anchor that produced it. */
export interface RoutedQuote {
    anchor: Anchor;
    quote: Quote;
}

/** Result of {@link RampRouter.bestQuote}: the winner plus every quote received,
 * so a UI can show the comparison ("live quotes, multiple anchors"). */
export interface BestQuoteResult {
    best: RoutedQuote;
    all: RoutedQuote[];
    /** Providers that errored during fan-out, with the error preserved. */
    failed: { anchor: Anchor; error: unknown }[];
}

export class RampRouter {
    constructor(private readonly anchors: readonly Anchor[]) {
        if (anchors.length === 0) {
            throw new AnchorError('RampRouter needs at least one anchor', 'NO_ANCHORS', 500);
        }
    }

    /** All anchors matching the query, in registration order. */
    candidates(query: RouteQuery = {}): Anchor[] {
        return this.anchors.filter((a) => {
            if (query.provider && a.name !== query.provider) return false;
            if (
                query.currency &&
                !a.supportedCurrencies.some((c) => c.toUpperCase() === query.currency!.toUpperCase())
            ) return false;
            if (
                query.rail &&
                !a.supportedRails.some((r) => r.toLowerCase() === query.rail!.toLowerCase())
            ) return false;
            if (
                query.token &&
                !a.supportedTokens.some((t) => t.symbol.toUpperCase() === query.token!.toUpperCase())
            ) return false;
            return true;
        });
    }

    /** First anchor matching the query, or `null`. Registration order = priority. */
    resolve(query: RouteQuery = {}): Anchor | null {
        return this.candidates(query)[0] ?? null;
    }

    /**
     * Fan the quote request out to every capable anchor and return the quote
     * with the highest `toAmount` (most crypto per fiat on an on-ramp, most
     * fiat per crypto on an off-ramp). Anchors that error are collected in
     * `failed`, not thrown — one slow/broken provider must not kill the quote.
     *
     * @throws {AnchorError} `NO_QUOTE` when every candidate failed.
     */
    async bestQuote(input: GetQuoteInput, query: RouteQuery = {}): Promise<BestQuoteResult> {
        const candidates = this.candidates({
            ...query,
            // Filter by the fiat leg of the pair when no explicit currency given.
            currency: query.currency ?? fiatLeg(input),
        });
        if (candidates.length === 0) {
            throw new AnchorError('No anchor supports this route', 'NO_ROUTE', 400);
        }
        const settled = await Promise.allSettled(candidates.map((a) => a.getQuote(input)));
        const all: RoutedQuote[] = [];
        const failed: BestQuoteResult['failed'] = [];
        settled.forEach((s, i) => {
            if (s.status === 'fulfilled') all.push({ anchor: candidates[i], quote: s.value });
            else failed.push({ anchor: candidates[i], error: s.reason });
        });
        if (all.length === 0) {
            throw new AnchorError('All anchors failed to quote', 'NO_QUOTE', 502);
        }
        const best = all.reduce((a, b) =>
            parseFloat(b.quote.toAmount) > parseFloat(a.quote.toAmount) ? b : a
        );
        return { best, all, failed };
    }
}

/** The fiat side of a quote pair, guessed by ISO-4217 shape (3 alpha, no issuer). */
function fiatLeg(input: GetQuoteInput): string | undefined {
    const FIAT = /^[A-Z]{3}$/;
    const KNOWN_CRYPTO = new Set(['USDC', 'USDT', 'XLM', 'EURC']);
    for (const c of [input.fromCurrency, input.toCurrency]) {
        const code = c.split(':')[0].toUpperCase();
        if (FIAT.test(code) && !KNOWN_CRYPTO.has(code)) return code;
    }
    return undefined;
}
