/**
 * Regression: a good's commercial satisfaction is the sum of the factors the catalog declares (the city's own and the common ones), rounded and clamped
 * to -100..100; each city's declared sales gain and loss are the ones applied; a city's figure is read from its goods, never stored.
 */

import { describe, test, expect } from '@jest/globals';
import { reviewSatisfaction } from '../../../src/contexts/geography/domain/policies/TradeSatisfactionPolicy.js';
import { COMMON_SATISFACTION_FACTORS, TRADE_CATALOG } from '../../../src/shared/trade-catalog/TradeCatalog.js';
import { openingGoodSatisfaction, relationSatisfaction, satisfactionTier } from '../../../src/shared/trade-catalog/satisfaction.js';

describe('trade satisfaction — declared factors, one number per good', () => {
  test('each catalog city applies its own declared gain when sold and loss when not', () => {
    for (const entry of TRADE_CATALOG) {
      const { gain, loss } = entry.satisfaction.find((spec) => spec.name === 'sales');
      expect(reviewSatisfaction(50, entry.satisfaction, { sold: true }).score).toBe(50 + gain);
      expect(reviewSatisfaction(50, entry.satisfaction, { sold: false }).score).toBe(50 - loss);
    }
  });

  test('the common factors read the stock waiting and our duty, and the review keeps what each gave', () => {
    const specs = [{ name: 'sales', gain: 2, loss: 5 }, ...COMMON_SATISFACTION_FACTORS];
    const full = reviewSatisfaction(0, specs, { sold: true, ready: 1, dutyRate: 0 });
    expect(full.contributions).toMatchObject({ sales: 2, availability: 1 });
    expect(full.contributions.barriers).toBeCloseTo(0);
    expect(full.score).toBe(3);
    const empty = reviewSatisfaction(0, specs, { sold: false, ready: 0, dutyRate: 0.5 });
    expect(empty.contributions.availability).toBe(-1);
    expect(empty.contributions.barriers).toBe(-5); // 50 % of the duty × 10
    expect(empty.score).toBe(-11);
  });

  test('clamps to -100..100 and refuses an unknown factor', () => {
    const sales = [{ name: 'sales', gain: 2, loss: 5 }];
    expect(reviewSatisfaction(99, sales, { sold: true }).score).toBe(100);
    expect(reviewSatisfaction(-99, sales, { sold: false }).score).toBe(-100);
    expect(() => reviewSatisfaction(50, [{ name: 'unknown' }], { sold: true })).toThrow(/unknown/);
  });

  test('a city\'s figure is read from its goods, weighted by the volume of an order, and a good it lacks throws', () => {
    const silvania = TRADE_CATALOG.find((entry) => entry.cityId === 'silvania');
    const relation = { cityId: 'silvania', goodSatisfaction: openingGoodSatisfaction(silvania) };
    expect(relationSatisfaction(relation, silvania)).toBe(0);
    relation.goodSatisfaction.import.exoticWood = 60; // 15 of the 15 + 5 × 20 = 115 units of its orders
    expect(relationSatisfaction(relation, silvania)).toBe(Math.round((60 * 15) / 115));
    delete relation.goodSatisfaction.export.book;
    expect(() => relationSatisfaction(relation, silvania)).toThrow(/no export satisfaction for "book"/);
  });

  test('the steps of the scale follow the plan', () => {
    expect([-100, -50, -49, -15, 15, 16, 49, 50, 100].map(satisfactionTier)).toEqual([
      'glaciale', 'glaciale', 'fraîche', 'normale', 'normale', 'chaude', 'chaude', 'florissante', 'florissante',
    ]);
  });
});
