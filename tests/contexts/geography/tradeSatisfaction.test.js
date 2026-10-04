/**
 * Regression: a relation's satisfaction is the sum of the factors its catalog entry declares, clamped
 * to 0..100, and each city's declared sales gain and loss must be the ones applied.
 */

import { describe, test, expect } from '@jest/globals';
import { reviewSatisfaction } from '../../../src/contexts/geography/domain/policies/TradeSatisfactionPolicy.js';
import { TRADE_CATALOG } from '../../../src/shared/trade-catalog/TradeCatalog.js';

describe('trade satisfaction — declared factors, one number', () => {
  test('each catalog city applies its own declared gain when sold and loss when not', () => {
    for (const entry of TRADE_CATALOG) {
      const { gain, loss } = entry.satisfaction.find((spec) => spec.name === 'sales');
      expect(reviewSatisfaction(50, entry.satisfaction, { sold: true })).toBe(50 + gain);
      expect(reviewSatisfaction(50, entry.satisfaction, { sold: false })).toBe(50 - loss);
    }
  });

  test('clamps to 0..100 and refuses an unknown factor', () => {
    const sales = [{ name: 'sales', gain: 2, loss: 5 }];
    expect(reviewSatisfaction(99, sales, { sold: true })).toBe(100);
    expect(reviewSatisfaction(1, sales, { sold: false })).toBe(0);
    expect(() => reviewSatisfaction(50, [{ name: 'unknown' }], { sold: true })).toThrow(/unknown/);
  });
});
