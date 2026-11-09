/**
 * The bread and the cabbage soup the cooperative makes are food: they enter the distribution chain (the granaries keep them, the markets sell them to the citizens, so they add
 * to the variety of what a house eats), although a house also produces them. Guards the two rules that make it hold.
 */
import { describe, test, expect } from '@jest/globals';
import { getSelfProducedCategories, getSuppliedCategories } from '../../src/shared/building-catalog/resourceRoleQueries.js';
import { getResourceRoles } from '../../src/shared/building-catalog/resourceRoleQueries.js';
import { HEALTH_FACTORS, maxPointsOfFactor } from '../../src/shared/population/HealthFactorCatalog.js';
import { getCollectionSchedule } from '../../src/contexts/supply/domain/policies/ResourceRolePolicy.js';

describe('the food chain with the cooperative\'s bread and soup', () => {
  // The cooperative is a legal person apart from the household: its products are never the household's to take, only its money (shares) is.
  test('what a house\'s cooperative makes is not what the household makes for itself: bread and soup stay in the supplied (distributed) food', () => {
    expect(getSelfProducedCategories()).not.toContain('bread');
    expect(getSuppliedCategories()).toEqual(expect.arrayContaining(['wheat', 'carrot', 'cabbage', 'bread', 'cabbageSoup']));
  });

  test('the citizens are served first: the market ranks before the merchants for the bread and the soup', () => {
    for (const good of ['bread', 'cabbageSoup']) {
      const entry = getResourceRoles('House-Red').find((role) => role.role === 'producer' && role.categories.includes(good));
      expect(entry.clients).toEqual(['Market-Stall-Red', 'House-Blue']);
    }
  });

  test('the variety of food counts up to every kind the citizens can eat', () => {
    const variety = HEALTH_FACTORS.find((factor) => factor.id === 'foodVariety');
    expect(variety.maxUnits).toBe(getSuppliedCategories().length);
    expect(maxPointsOfFactor(variety)).toBe(30);
  });

  test('the granary collects the cooperative\'s goods in the months they are sold in', () => {
    expect(getCollectionSchedule('Windmill-001').values).toEqual(expect.arrayContaining(['february', 'december']));
  });
});
