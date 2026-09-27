/**
 * Behavior tests — Housing: food affluence query (H5)
 */

import { describe, test, expect } from '@jest/globals';
import { EvaluateHouseFoodAffluence } from '../../../src/contexts/housing/application/queries/EvaluateHouseFoodAffluence.js';

describe('EvaluateHouseFoodAffluence', () => {
  const query = new EvaluateHouseFoodAffluence();

  describe('total food', () => {
    test('sums gathering and market crop types', () => {
      expect(query.execute({ stocks: { wheat: 2, carrot: 3, cabbage: 1 }, population: 0 }).totalFood).toBe(6);
      expect(query.execute({ stocks: { fruit: 2, game: 3 }, population: 0 }).totalFood).toBe(5);
    });

    test('partial stocks', () => {
      expect(query.execute({ stocks: { wheat: 5, carrot: 0, cabbage: 0 }, population: 0 }).totalFood).toBe(5);
    });

    test('uses food field when set even if crop types differ', () => {
      expect(
        query.execute({ stocks: { food: 10, wheat: 8, carrot: 5, cabbage: 2 }, population: 0 }).totalFood
      ).toBe(10);
    });

    test('handles undefined crop fields', () => {
      expect(query.execute({ stocks: { wheat: 5, carrot: undefined, cabbage: null }, population: 0 }).totalFood).toBe(
        5
      );
    });

    test('empty stocks', () => {
      const result = query.execute({ stocks: { wheat: 0, carrot: 0, cabbage: 0 }, population: 0 });
      expect(result.totalFood).toBe(0);
      expect(result.hasFood).toBe(false);
    });

    test('null stocks', () => {
      const result = query.execute({ stocks: null, population: 0 });
      expect(result.totalFood).toBe(0);
      expect(result.hasFood).toBe(false);
    });
  });

  describe('hasFood', () => {
    test('true when at least one unit', () => {
      expect(query.execute({ stocks: { wheat: 1 }, population: 0 }).hasFood).toBe(true);
    });

    test('false when zero', () => {
      expect(query.execute({ stocks: { wheat: 0 }, population: 0 }).hasFood).toBe(false);
    });
  });

  describe('netFood', () => {
    test('surplus', () => {
      expect(query.execute({ stocks: { food: 10 }, population: 6 }).netFood).toBe(4);
    });

    test('deficit returns 0', () => {
      expect(query.execute({ stocks: { food: 2 }, population: 5 }).netFood).toBe(0);
    });

    test('balanced', () => {
      expect(query.execute({ stocks: { food: 6 }, population: 6 }).netFood).toBe(0);
    });

    test('returns total when population is 0', () => {
      expect(query.execute({ stocks: { food: 10 }, population: 0 }).netFood).toBe(10);
    });
  });

  describe('meetsFoodGoal', () => {
    test('true when pop > 5 and food > pop * 2', () => {
      expect(query.execute({ stocks: { food: 13 }, population: 6 }).meetsFoodGoal).toBe(true);
    });

    test('false when pop <= 5', () => {
      expect(query.execute({ stocks: { food: 20 }, population: 5 }).meetsFoodGoal).toBe(false);
    });

    test('false when food <= pop * 2', () => {
      expect(query.execute({ stocks: { food: 12 }, population: 6 }).meetsFoodGoal).toBe(false);
    });
  });

  describe('isInsufficient', () => {
    test('true when food < population', () => {
      expect(query.execute({ stocks: { wheat: 2 }, population: 5 }).isInsufficient).toBe(true);
    });

    test('false when population < 2', () => {
      expect(query.execute({ stocks: { food: 0 }, population: 1 }).isInsufficient).toBe(false);
    });

    test('false when food >= population', () => {
      expect(query.execute({ stocks: { wheat: 5 }, population: 5 }).isInsufficient).toBe(false);
    });
  });
});
