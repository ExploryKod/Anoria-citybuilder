import { describe, test, expect } from '@jest/globals';
import {
  getResourceRoles,
  hasResourceRole,
  getCategoriesForRole,
  getRangeForRole,
} from '../../../src/contexts/supply/domain/policies/ResourceRolePolicy.js';

describe('ResourceRolePolicy', () => {
  test('a farm is a producer of its own crop', () => {
    expect(hasResourceRole('Farm-Wheat', 'producer')).toBe(true);
    expect(hasResourceRole('Farm-Wheat', 'producer', 'wheat')).toBe(true);
    expect(hasResourceRole('Farm-Wheat', 'producer', 'carrot')).toBe(false);
    expect(getCategoriesForRole('Farm-Wheat', 'producer')).toEqual(['wheat']);
  });

  test('a market is a distributor with a range', () => {
    expect(hasResourceRole('Market-Stall', 'distributor', 'wheat')).toBe(true);
    expect(getRangeForRole('Market-Stall', 'distributor')).toBe(5);
  });

  test('a windmill holds both a collector and a hub role, with no range', () => {
    expect(hasResourceRole('Windmill-001', 'collector')).toBe(true);
    expect(hasResourceRole('Windmill-001', 'hub')).toBe(true);
    expect(getRangeForRole('Windmill-001', 'collector')).toBeUndefined();
  });

  test('a house is a consumer', () => {
    expect(hasResourceRole('House-Blue', 'consumer', 'fruit')).toBe(true);
  });

  test('a building with no resourceRoles fact has none', () => {
    expect(getResourceRoles('StonePath-001')).toEqual([]);
    expect(hasResourceRole('StonePath-001', 'producer')).toBe(false);
    expect(getRangeForRole('StonePath-001', 'distributor')).toBeUndefined();
  });
});
