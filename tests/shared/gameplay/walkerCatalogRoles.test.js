import { describe, expect, test } from '@jest/globals';
import {
  getWalkerRole,
  isWalkerOrigin,
  isWalkerDestination,
  walkerRequiresRoad,
} from '../../../src/shared/gameplay/walkerCatalogRoles.js';

describe('walkerCatalogRoles', () => {
  test('houses are walker origins', () => {
    expect(getWalkerRole('House-Blue')).toBe('origin');
    expect(isWalkerOrigin('House-Blue')).toBe(true);
    expect(isWalkerDestination('House-Blue')).toBe(false);
  });

  test('farms are walker destinations', () => {
    expect(getWalkerRole('Farm-Wheat')).toBe('destination');
    expect(isWalkerDestination('Farm-Wheat')).toBe(true);
    expect(isWalkerOrigin('Farm-Wheat')).toBe(false);
  });

  test('market stalls have no walker role', () => {
    expect(getWalkerRole('Market-Stall')).toBeUndefined();
  });

  test('buildings with no walker fact have no role', () => {
    expect(getWalkerRole('House-2Story')).toBeUndefined();
    expect(isWalkerOrigin('House-2Story')).toBe(false);
    expect(isWalkerDestination('House-2Story')).toBe(false);
  });

  test('unknown ids have no role', () => {
    expect(getWalkerRole('Not-A-Real-Building')).toBeUndefined();
    expect(getWalkerRole(undefined)).toBeUndefined();
  });

  test('walkerRequiresRoad defaults to true when the fact is omitted', () => {
    // House-Blue/Farm-Wheat declare a role but no `requiresRoad` — must
    // default to true (road access still required) rather than opting
    // every existing walker building out silently.
    expect(walkerRequiresRoad('House-Blue')).toBe(true);
    expect(walkerRequiresRoad('Farm-Wheat')).toBe(true);
    expect(walkerRequiresRoad('Not-A-Real-Building')).toBe(true);
  });
});
