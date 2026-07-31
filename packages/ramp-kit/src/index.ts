/**
 * @slippay/ramp-kit — LATAM fiat on/off-ramp kit for Stellar.
 *
 * One `Anchor` interface, multiple providers (Etherfuse, CriptoPix), and a
 * router that picks the best ramp per currency/rail with live quote fan-out.
 * Extracted from Slippay's production ramp surface.
 */

export type * from './types.js';
export { AnchorError } from './types.js';
export { EtherfuseClient } from './etherfuse/index.js';
export { CriptoPixClient } from './criptopix/index.js';
export type { CriptoPixConfig } from './criptopix/index.js';
export { RampRouter } from './router.js';
export type { RouteQuery, RoutedQuote, BestQuoteResult } from './router.js';
export { applyMargin, clampMarginBps } from './margin.js';
