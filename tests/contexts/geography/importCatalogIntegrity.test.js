/**
 * Guard: an import can only run if the catalog is whole. What a city offers must be storable (the good, and the deal
 * that stands for it), shippable (a weight, a known transport mode), and every reason a trade can stop for must have
 * its words. These were runtime errors in a player's game; now they fail here.
 */
import { describe, test, expect } from '@jest/globals';
import { TRADE_CATALOG, TRADE_IMPORT, TRADE_CEASE_WORDING } from '../../../src/shared/trade-catalog/TradeCatalog.js';
import { getImportGoodOfDeal, getTransportWeight } from '../../../src/shared/resource-catalog/ResourceCategoryCatalog.js';
import { buildingCatalog } from '../../../src/shared/building-catalog/buildingCatalog.js';
import { CEASE_REASONS } from '../../../src/contexts/geography/domain/policies/TradeCeasePolicy.js';

const hubCategories = Object.values(buildingCatalog)
  .flatMap((definition) => (definition.resourceRoles ?? []).filter((entry) => entry.role === 'hub'))
  .flatMap((entry) => entry.categories);
const producedCategories = Object.values(buildingCatalog)
  .flatMap((definition) => (definition.resourceRoles ?? []).filter((entry) => entry.role === 'producer'))
  .flatMap((entry) => entry.categories);

describe('import catalog', () => {
  const offers = TRADE_CATALOG.flatMap((entry) => entry.offers.map((offer) => ({ entry, offer })));

  test('every offer names a storable good and a deal that turns into it, made by a producer', () => {
    expect(offers.length).toBeGreaterThan(0);
    for (const { entry, offer } of offers) {
      expect({ city: entry.cityId, good: offer.good, stored: hubCategories.includes(offer.good) }).toEqual({ city: entry.cityId, good: offer.good, stored: true });
      expect(getImportGoodOfDeal(offer.merchantGood)).toBe(offer.good);
      expect({ deal: offer.merchantGood, stored: hubCategories.includes(offer.merchantGood) }).toEqual({ deal: offer.merchantGood, stored: true });
      expect({ deal: offer.merchantGood, made: producedCategories.includes(offer.merchantGood) }).toEqual({ deal: offer.merchantGood, made: true });
      expect(getTransportWeight(offer.good)).toBeGreaterThan(0);
    }
  });

  test('every city ships by a declared transport mode and breaks below a score it can reach', () => {
    for (const entry of TRADE_CATALOG) {
      expect(TRADE_IMPORT.transportModes[entry.transport.mode]).toBeDefined();
      expect(entry.transport.distanceMultiplier).toBeGreaterThan(0);
      expect(entry.relation.breakThreshold).toBeLessThan(entry.relation.renewalThreshold);
    }
  });

  test('every reason a trade can stop for is worded, with who ceases', () => {
    for (const [reason, definition] of Object.entries(CEASE_REASONS)) {
      expect({ reason, words: typeof TRADE_CEASE_WORDING.reasons[reason] }).toEqual({ reason, words: 'string' });
      expect(typeof TRADE_CEASE_WORDING.by[definition.by]).toBe('string');
    }
  });
});
