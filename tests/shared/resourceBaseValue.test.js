/**
 * Regression guard for prices: every good that moves between buildings is an exchange, and each
 * exchange is logged at the catalog's price. A missing price must fail here, not as a stand-in value.
 */

import { describe, test, expect } from '@jest/globals';
import { buildingCatalog } from '../../src/shared/building-catalog/buildingCatalog.js';
import { getResourceBaseValue } from '../../src/shared/resource-catalog/ResourceCategoryCatalog.js';

const EXCHANGE_ROLES = new Set(['producer', 'collector', 'hub', 'distributor', 'consumer']);

describe('resource base value — every exchanged good is priced', () => {
  test('each good a building exchanges declares a price', () => {
    const exchanged = new Set();
    for (const definition of Object.values(buildingCatalog)) {
      for (const entry of definition.resourceRoles ?? []) {
        if (!EXCHANGE_ROLES.has(entry.role)) continue;
        for (const category of entry.categories ?? []) exchanged.add(category);
      }
    }
    expect(exchanged.size).toBeGreaterThan(0);
    for (const category of exchanged) {
      expect(() => getResourceBaseValue(category)).not.toThrow();
    }
  });

  test('a good with no declared price throws instead of returning a stand-in', () => {
    expect(() => getResourceBaseValue('unpricedGood')).toThrow(/unpricedGood/);
  });

  test('a merchant deal good is priced as the raw good it stands for', () => {
    expect(getResourceBaseValue('dealWood')).toBe(getResourceBaseValue('wood'));
  });
});
