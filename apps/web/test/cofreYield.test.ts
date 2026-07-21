import { describe, it, expect } from "vitest";
import { earnedStroops, basisAfterWithdraw } from "../src/lib/cofreYield.ts";

const USDC = 10_000_000;

describe("earnedStroops", () => {
  it("is zero right after depositing (value == basis)", () => {
    expect(earnedStroops(100 * USDC, 100 * USDC)).toBe(0);
  });
  it("shows the gain when value grew above basis", () => {
    expect(earnedStroops(105 * USDC, 100 * USDC)).toBe(5 * USDC);
  });
  it("never goes negative on rounding dust or a dip below basis", () => {
    expect(earnedStroops(100 * USDC - 1, 100 * USDC)).toBe(0);
    expect(earnedStroops(99 * USDC, 100 * USDC)).toBe(0);
  });
});

describe("basisAfterWithdraw", () => {
  it("removes basis proportionally so remaining earnings stay honest", () => {
    // deposited 100 (basis 100), grew to 105, withdraw 52.5 (half the value):
    // remaining value ~52.5, basis should halve to 50, earned = 52.5 - 50 = 2.5
    const basis = basisAfterWithdraw(100 * USDC, 105 * USDC, 52.5 * USDC);
    expect(basis).toBe(50 * USDC);
    expect(earnedStroops(52.5 * USDC, basis)).toBe(2.5 * USDC);
  });
  it("full withdrawal zeroes the basis", () => {
    expect(basisAfterWithdraw(100 * USDC, 105 * USDC, 105 * USDC)).toBe(0);
  });
  it("never overstates: after withdrawing pure yield, earned drops too", () => {
    // deposit 100, grow to 105, withdraw exactly the 5 of yield.
    // remaining value 100, basis scales by 100/105 ~= 95.238, earned ~= 4.76.
    // (conservative: slightly under the 'true' 5, never over.)
    const basis = basisAfterWithdraw(100 * USDC, 105 * USDC, 5 * USDC);
    const earned = earnedStroops(100 * USDC, basis);
    expect(earned).toBeLessThanOrEqual(5 * USDC);
    expect(earned).toBeGreaterThan(0);
  });
  it("guards a zero/负 value-before (no division blowup)", () => {
    expect(basisAfterWithdraw(100 * USDC, 0, 10 * USDC)).toBe(0);
  });
});
