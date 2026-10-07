import { describe, test, expect } from '@jest/globals';
import { formatEuro, formatEuroAmount } from '../../../src/contexts/accounting/presentation/formatMoney.js';

// Regression: the HUD's "budget-box" displayed a raw JS float (funds.toString()) instead of going through this
// module, showing the full floating-point tail (e.g. "-116804.81999999999") instead of two decimals.
describe('formatMoney — every displayed amount rounds to the centime', () => {
  test('a value with a floating-point tail is rounded to two decimals, not shown raw', () => {
    const amount = formatEuroAmount(-116804.81999999999);
    expect(amount).toMatch(/^-116.804,82$/);
    expect(amount).not.toContain('999');
    expect(formatEuro(-116804.81999999999)).toBe(`${amount}€`);
  });

  test('formatEuroAmount is formatEuro without the currency sign, for a display with its own icon', () => {
    expect(formatEuro(1386.17)).toBe(`${formatEuroAmount(1386.17)}€`);
  });
});
