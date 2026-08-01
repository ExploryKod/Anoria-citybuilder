/**
 * Behavior tests — Supply: market house range policy
 */

import { describe, test, expect } from '@jest/globals';
import {
  findHousesInMarketRange,
  manhattanDistance,
} from '../../../src/contexts/supply/domain/policies/MarketRangePolicy.js';

describe('Supply — findHousesInMarketRange', () => {
  const market = {
    id: 'Market-Stall-5-5',
    type: 'Market-Stall',
    x: 5,
    y: 5,
  };

  test('manhattanDistance matches legacy formula', () => {
    expect(manhattanDistance({ x: 5, y: 3 }, { x: 2, y: 1 })).toBe(5);
  });

  test('returns houses within range with road access', () => {
    const houses = findHousesInMarketRange(
      market,
      [
        { id: 'House-Blue-5-3', type: 'House-Blue', x: 5, y: 3, roads: 1 },
        { id: 'House-Red-7-5', type: 'House-Red', x: 7, y: 5, roads: 1 },
      ],
      5
    );

    expect(houses).toHaveLength(2);
  });

  test('excludes houses too far or without roads', () => {
    const houses = findHousesInMarketRange(
      market,
      [
        { id: 'House-Blue-5-3', type: 'House-Blue', x: 5, y: 3, roads: 1 },
        { id: 'House-Red-15-15', type: 'House-Red', x: 15, y: 15, roads: 1 },
        { id: 'House-Blue-6-5', type: 'House-Blue', x: 6, y: 5, roads: 0 },
        { id: 'Farm-Wheat-5-3', type: 'Farm-Wheat', x: 5, y: 3, roads: 1 },
      ],
      5
    );

    expect(houses).toHaveLength(1);
    expect(houses[0].id).toBe('House-Blue-5-3');
  });

  test('returns empty when market has no coordinates', () => {
    expect(findHousesInMarketRange({ type: 'Market-Stall' }, [], 5)).toEqual([]);
  });
});
