import { describe, test, expect } from '@jest/globals';
import { PriceBook } from '../../../src/contexts/supply/application/services/PriceBook.js';
import { MARGIN_BY_STAGE, unitPriceAtStage } from '../../../src/shared/resource-catalog/ValueChainCatalog.js';
import { unsoldRiskDiscount } from '../../../src/shared/resource-catalog/ResourceCategoryCatalog.js';
import { shelfLifeMonthsAt } from '../../../src/contexts/supply/domain/policies/ResourceRolePolicy.js';

// The chain prices what it sells on what it cost: a warehouse and a market on the deliveries they received, a producer on its month's cost.
const warehouse = { id: 'warehouse-1', type: 'Warehouse' };
const market = { id: 'market-1', type: 'Market-Stall-Red' };
const farm = { id: 'farm-1', type: 'Farm-Wheat' };
const period = { year: 1, monthIndex: 4 };

// What a seller keeps of its price once it carries the risk of its stock going bad unsold.
const afterRisk = (seller, category, price) => price * (1 - unsoldRiskDiscount(shelfLifeMonthsAt(seller.type, category)));

const costing = { wageRateOf: () => 8, maintenanceCostOf: () => 2, employerContributionRate: 0 };
const bookWith = (inflows, producerCosting = costing) => new PriceBook({ sumInflowCosts: async () => inflows, loadProducerCosting: async () => producerCosting });
const ready = async (inflows, producerCosting) => {
  const book = bookWith(inflows, producerCosting);
  await book.ensure(period);
  return book;
};

describe('PriceBook — prices built on the cost of the stock', () => {
  test('with no delivery in the window, a warehouse values its stock at the reference chain (the opening cost)', async () => {
    const book = await ready([]);

    expect(book.sellingPrice(warehouse, 'wheat', period)).toBeCloseTo(afterRisk(warehouse, 'wheat', unitPriceAtStage('hub', 'wheat')), 2);
  });

  test('a seller whose stock keeps worse sells cheaper: the risk of an unsold stock comes from the shelf life, and a good that never goes bad carries none', async () => {
    const book = await ready([]);
    const cabbageFarm = { id: 'farm-2', type: 'Farm-Cabbage' };
    const granary = { id: 'granary-1', type: 'Windmill-001' };

    expect(unsoldRiskDiscount(Infinity)).toBe(0);
    expect(unsoldRiskDiscount(2)).toBeGreaterThan(unsoldRiskDiscount(6));
    expect(unsoldRiskDiscount(12)).toBe(0);
    // The cabbage keeps less than the wheat in the field; the granary keeps both longer than a stall would.
    expect(shelfLifeMonthsAt(cabbageFarm.type, 'cabbage')).toBeLessThan(shelfLifeMonthsAt(farm.type, 'wheat'));
    expect(book.sellingPrice(granary, 'wheat', period)).toBeCloseTo(afterRisk(granary, 'wheat', unitPriceAtStage('hub', 'wheat')), 2);
  });

  test('a dearer delivery reaches the price: the warehouse sells at its average cost plus its margin', async () => {
    // 10 units bought at 2.00 and 30 at 1.00: an average cost of 1.25.
    const book = await ready([{ buyerId: 'warehouse-1', category: 'coal', stage: 'hub', quantity: 40, amount: 10 * 2 + 30 * 1 }]);

    expect(book.sellingPrice(warehouse, 'coal', period)).toBeCloseTo(afterRisk(warehouse, 'coal', 1.25 * (1 + MARGIN_BY_STAGE.hub)), 2);
  });

  test('a market marks up what it paid the warehouse, so the duty is in the shelf price', async () => {
    const book = await ready([{ buyerId: 'market-1', category: 'coal', stage: 'distributor', quantity: 10, amount: 15 }]);

    expect(book.sellingPrice(market, 'coal', period)).toBeCloseTo(afterRisk(market, 'coal', 1.5 * (1 + MARGIN_BY_STAGE.distributor)), 2);
  });

  test('a producer sells at its standard cost plus its margin: its workers, its upkeep, over the units it makes', async () => {
    const book = await ready([]);

    // A wheat farm: 3 workers × 8 + 2 of upkeep = 26 a month, over 288 / 12 = 24 units: 1.0833 a unit, plus the producer's margin.
    expect(book.sellingPrice(farm, 'wheat', period)).toBeCloseTo(afterRisk(farm, 'wheat', (26 / 24) * (1 + MARGIN_BY_STAGE.producer)), 2);
  });

  test('a dearer wage makes the producer\'s unit dearer', async () => {
    const book = await ready([], { ...costing, wageRateOf: () => 16 });

    expect(book.sellingPrice(farm, 'wheat', period)).toBeCloseTo(afterRisk(farm, 'wheat', ((3 * 16 + 2) / 24) * (1 + MARGIN_BY_STAGE.producer)), 2);
  });

  test('the employer\'s social contribution is part of what a worker costs, so it reaches the price', async () => {
    const book = await ready([], { ...costing, employerContributionRate: 0.25 });

    expect(book.sellingPrice(farm, 'wheat', period)).toBeCloseTo(afterRisk(farm, 'wheat', ((3 * 8 * 1.25 + 2) / 24) * (1 + MARGIN_BY_STAGE.producer)), 2);
  });

  test('a plant\'s energy is priced on its cost, fuel included: a dearer delivery of coal reaches the energy it sells', async () => {
    const plant = { id: 'plant-1', type: 'CoalPlant' };
    const reference = await ready([]);
    const dearer = await ready([{ buyerId: 'warehouse-1', category: 'coal', stage: 'hub', quantity: 10, amount: 60 }]); // coal at 6.00 a unit

    expect(dearer.sellingPrice(plant, 'energy', period)).toBeGreaterThan(reference.sellingPrice(plant, 'energy', period));
  });

  test('a service no producer makes stays at its base value', async () => {
    const book = await ready([]);

    expect(book.sellingPrice({ id: 'school-1', type: 'School' }, 'school', period)).toBe(unitPriceAtStage('distributor', 'school'));
  });

  test('a producer with no workforce declared (a house\'s own business) keeps the reference chain', async () => {
    const book = await ready([]);

    expect(book.sellingPrice({ id: 'house-1', type: 'House-Red' }, 'decoratedPot', period)).toBe(unitPriceAtStage('producer', 'decoratedPot'));
  });

  test('a price asked for a month that was not prepared throws', async () => {
    const book = await ready([]);

    expect(() => book.sellingPrice(warehouse, 'wheat', { year: 9, monthIndex: 0 })).toThrow(/not prepared/);
  });
});
