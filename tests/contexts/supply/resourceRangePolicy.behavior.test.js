/**
 * Behavior tests — Supply: resource range policy (replaces the old
 * market/house-specific MarketRangePolicy — role/category driven now).
 */

import { describe, test, expect } from '@jest/globals';
import {
  findBuildingsWithRoleInRange,
  manhattanDistance,
} from '../../../src/contexts/supply/domain/policies/ResourceRangePolicy.js';

describe('Supply — findBuildingsWithRoleInRange', () => {
  const market = { id: 'Market-Stall-5-5', type: 'Market-Stall', x: 5, y: 5 };

  test('manhattanDistance matches legacy formula', () => {
    expect(manhattanDistance({ x: 5, y: 3 }, { x: 2, y: 1 })).toBe(5);
  });

  test('returns consumer-role buildings within range with road access', () => {
    const found = findBuildingsWithRoleInRange(
      market,
      [
        { id: 'House-Blue-5-3', type: 'House-Blue', x: 5, y: 3, roads: 1 },
        { id: 'House-Red-7-5', type: 'House-Red', x: 7, y: 5, roads: 1 },
      ],
      { role: 'consumer', maxDistance: 5 }
    );

    expect(found).toHaveLength(2);
  });

  test('excludes buildings too far, without roads, or without the role', () => {
    const found = findBuildingsWithRoleInRange(
      market,
      [
        { id: 'House-Blue-5-3', type: 'House-Blue', x: 5, y: 3, roads: 1 },
        { id: 'House-Red-15-15', type: 'House-Red', x: 15, y: 15, roads: 1 },
        { id: 'House-Blue-6-5', type: 'House-Blue', x: 6, y: 5, roads: 0 },
        { id: 'Farm-Wheat-5-3', type: 'Farm-Wheat', x: 5, y: 3, roads: 1 },
      ],
      { role: 'consumer', maxDistance: 5 }
    );

    expect(found).toHaveLength(1);
    expect(found[0].id).toBe('House-Blue-5-3');
  });

  test('an optional category further restricts the role match', () => {
    const found = findBuildingsWithRoleInRange(
      { x: 0, y: 0 },
      [{ id: 'Farm-Wheat-1-0', type: 'Farm-Wheat', x: 1, y: 0, roads: 1 }],
      { role: 'producer', category: 'carrot', maxDistance: 5 }
    );

    expect(found).toEqual([]);
  });

  test('returns empty when the origin has no coordinates', () => {
    expect(findBuildingsWithRoleInRange({ type: 'Market-Stall' }, [], { role: 'consumer', maxDistance: 5 })).toEqual([]);
  });
});
