/**
 * The production command no longer knows the climate: a producer entry declares `yieldFactor: 'climate'`. Guard: every producer entry of a crop declares it
 * (or the climate would silently stop moving its yield), and no other entry does.
 */
import { describe, test, expect } from '@jest/globals';
import { BUILDING_ECONOMY } from '../../src/shared/asset-economy/buildingEconomy.js';
import { isClimateCrop } from '../../src/shared/climate/ClimatePolicy.js';

describe('yield factor — declared by the catalog', () => {
  test('a producer entry declares the climate exactly when it grows a crop', () => {
    for (const [type, economy] of Object.entries(BUILDING_ECONOMY)) {
      for (const entry of (economy.resourceRoles ?? []).filter((role) => role.role === 'producer')) {
        const growsCrop = isClimateCrop(entry.categories[0]);
        expect([type, entry.categories[0], entry.yieldFactor === 'climate']).toEqual([type, entry.categories[0], growsCrop]);
      }
    }
  });
});
