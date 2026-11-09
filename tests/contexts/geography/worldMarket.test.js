import { describe, test, expect } from '@jest/globals';
import { nextWorldIndex, cropTargetOf } from '../../../src/contexts/geography/domain/policies/WorldMarketPolicy.js';
import { WorldMarket } from '../../../src/contexts/geography/application/services/WorldMarket.js';
import { priceImportDelivery } from '../../../src/contexts/geography/domain/policies/ImportPricePolicy.js';
import { getTradeCatalogEntry } from '../../../src/shared/trade-catalog/TradeCatalog.js';
import { referencePriceOf } from './importCapabilities.js';

// The world has a price for every traded good; it moves, it remembers, and it reaches what the cities pay and ask (docs/gameplay/PLAN_CRISES.md).
describe('the world market', () => {
  test('a price is pulled back to its target and shaken; a poor world harvest makes the crops\' target dearer', () => {
    expect(nextWorldIndex({ index: 2, target: 1, shock: 0 })).toBeLessThan(2);
    expect(nextWorldIndex({ index: 0.5, target: 1, shock: 0 })).toBeGreaterThan(0.5);
    expect(nextWorldIndex({ index: 1, target: 1, shock: 1 })).toBeGreaterThan(1);
    expect(cropTargetOf(0.6)).toBeGreaterThan(1.3);
    expect(cropTargetOf(1.2)).toBeLessThan(1);
  });

  test('the series is drawn once and kept: the same month reads the same, the past is not redrawn', async () => {
    let state = null;
    let draws = 0;
    const market = new WorldMarket({
      repository: { get: async () => state, save: async (next) => { state = next; } },
      goods: ['grain', 'iron'],
      isCrop: (good) => good === 'grain',
      worldClimateOfYear: async () => ({ harvestFactor: 0.6 }),
      random: () => { draws += 1; return 0.5; },
    });
    const first = await market.indicesAt({ year: 0, monthIndex: 5 });
    const drawnSoFar = draws;
    expect(await market.indicesAt({ year: 0, monthIndex: 5 })).toEqual(first);
    expect(draws).toBe(drawnSoFar);
    // A bad world harvest pulls the grain up month after month, while iron stays where it was.
    expect(first.grain).toBeGreaterThan(1);
    expect(first.iron).toBe(1);
    await expect(market.indicesAt({ year: 0, monthIndex: 2 })).rejects.toThrow(/past is not redrawn/);
  });

  test('the index reaches the price an import is paid at', () => {
    const offer = getTradeCatalogEntry('briga').offers.find((candidate) => candidate.good === 'coal');
    const referencePrice = referencePriceOf('coal');
    const calm = priceImportDelivery({ cityId: 'briga', offer, quantity: 40, dutyRate: 0, worldIndex: 1, referencePrice });
    const dear = priceImportDelivery({ cityId: 'briga', offer, quantity: 40, dutyRate: 0, worldIndex: 1.5, referencePrice });
    expect(dear.unit.foreign).toBeCloseTo(calm.unit.foreign * 1.5);
  });
});

describe('what the city makes itself is imported only when it is dearer at home', () => {
  test('the merchants deal in grain while the landed price is under the shelf price, not when the harvest is good or the world dear', async () => {
    const { importPaysAtHome } = await import('../../../src/contexts/geography/domain/policies/ImportPricePolicy.js');
    const offer = getTradeCatalogEntry('frumenta').offers.find((candidate) => candidate.good === 'wheat');
    const landed = (worldIndex) => priceImportDelivery({ cityId: 'frumenta', offer, quantity: 40, dutyRate: 0, worldIndex, referencePrice: referencePriceOf('wheat') }).unit.sale;
    // Normal year: the shelf price is the reference chain's (0.8 × 1.2 × 1.2 × 1.25 = 1.44); a famine triples it.
    expect(importPaysAtHome({ landedUnitSale: landed(1), localUnitPrice: 1.44 })).toBe(false);
    expect(importPaysAtHome({ landedUnitSale: landed(1), localUnitPrice: 2.8 })).toBe(true);
    // The world is short of grain too and its price has more than doubled: the same famine no longer pays to import.
    expect(importPaysAtHome({ landedUnitSale: landed(2.2), localUnitPrice: 2.8 })).toBe(false);
  });
});

describe('the ceiling an import must stay under', () => {
  test('for a good the city makes it is the home price, so a famine does not stop the grain; for any other it is a multiple of the good\'s world reference price', async () => {
    const { CEASE_REASONS } = await import('../../../src/contexts/geography/domain/policies/TradeCeasePolicy.js');
    // The reference price of wheat is 1.5: the ceiling of an import with no home price is 1.8 times it, 2.7.
    const dear = { pricing: { unit: { sale: 3.0 } }, referencePrice: 1.5 };
    expect(CEASE_REASONS.unprofitable.applies({ ...dear, homePrice: null })).toBe(true);
    expect(CEASE_REASONS.unprofitable.applies({ ...dear, homePrice: 3.2 })).toBe(false);
  });
});
