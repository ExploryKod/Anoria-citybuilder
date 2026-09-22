/**
 * Behavior tests — Supply: a producer entry that TRANSFORMS goods.
 *
 * `inputs` on a 'producer' entry makes it a recipe rather than a source: it
 * takes the goods it names from the building's own stock before crediting
 * its output, and produces nothing at all when any one of them is short (a
 * workshop idles without its raw material instead of half-producing).
 *
 * No building declares a recipe in the real catalog yet — the warehouse
 * chain is a later step — so these run against a fake catalog. What is under
 * test is the mechanism, which names no good; the goods here are only a
 * plausible shape for one.
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';

const FAKE_CATALOG = {
  'Fake-Woodcutter': {
    resourceRoles: [
      {
        role: 'producer',
        categories: ['wood'],
        schedule: { unit: 'always' },
        amount: 10,
        periodLock: { field: 'lastProductionMonth', unit: 'month' },
      },
    ],
  },
  'Fake-Furniture': {
    resourceRoles: [
      {
        role: 'producer',
        categories: ['furniture'],
        inputs: [{ category: 'wood', amount: 3 }],
        schedule: { unit: 'always' },
        amount: 1,
        periodLock: { field: 'lastProductionMonth', unit: 'month' },
      },
    ],
  },
  // Gathers two goods that share an aggregate, scaled by inhabitants — the
  // case that proves a recipe's ratio survives scaling.
  'Fake-Hut': {
    resourceRoles: [
      {
        role: 'producer',
        categories: ['stew'],
        totalKey: 'meals',
        inputs: [{ category: 'game', amount: 2 }],
        amount: 1,
        scale: 'population',
        schedule: { unit: 'always' },
        periodLock: { field: 'lastProductionMonth', unit: 'month' },
      },
      { role: 'consumer', categories: ['stew', 'game'], totalKey: 'meals', amount: 1 },
    ],
  },
};

jest.unstable_mockModule('../../../src/shared/building-catalog/buildingCatalog.js', () => ({
  buildingCatalog: FAKE_CATALOG,
  getBuildingDefinition: (type) => FAKE_CATALOG[type],
}));

const { createSupplyBuildingSnapshot } = await import(
  '../../../src/contexts/supply/domain/SupplyBuildingSnapshot.js'
);
const { createSupplyStock } = await import(
  '../../../src/contexts/supply/domain/value-objects/SupplyStock.js'
);
const { ProduceResource } = await import(
  '../../../src/contexts/supply/application/commands/harvest/ProduceResource.js'
);

class InMemorySupplyBuildingRepository {
  constructor(buildings = []) {
    this.raw = new Map(
      buildings.map((b) => [b.id, { ...b, stocks: { ...b.stocks }, lastProductionMonth: b.lastProductionMonth ?? null }])
    );
  }

  async findById(id) {
    const b = this.raw.get(id);
    if (!b) return null;
    return createSupplyBuildingSnapshot({ ...b, stocks: createSupplyStock(b.stocks) });
  }

  async saveStocks(id, stocks) {
    const b = this.raw.get(id);
    if (b) b.stocks = { ...createSupplyStock(stocks) };
  }

  async updateBuildingFields(id, fields) {
    const b = this.raw.get(id);
    if (!b) return;
    for (const key of Object.keys(fields)) {
      if (fields[key] !== undefined) b[key] = fields[key];
    }
  }
}

function workshop(id, type, stocks = {}, extras = {}) {
  return { id, type, roadCount: 1, worker: 2, workerNeed: 2, stocks, ...extras };
}

const PERIOD = { monthIndex: 4, year: 1 };

describe('Supply — a producer entry that transforms goods', () => {
  let repo;
  let produce;

  beforeEach(() => {
    repo = new InMemorySupplyBuildingRepository([
      workshop('furniture-1', 'Fake-Furniture', { wood: 7 }),
      workshop('furniture-empty', 'Fake-Furniture', { wood: 2 }),
      workshop('woodcutter-1', 'Fake-Woodcutter', {}),
      workshop('hut-1', 'Fake-Hut', { game: 10 }, { pop: 3 }),
    ]);
    produce = new ProduceResource(repo);
  });

  test('takes its inputs from its own stock and credits its output', async () => {
    const result = await produce.execute({ buildingId: 'furniture-1', period: PERIOD });

    expect(result.produced).toBe(true);
    const after = await repo.findById('furniture-1');
    expect(after.stocks.furniture).toBe(1);
    expect(after.stocks.wood).toBe(4); // 7 − 3
  });

  test('short of its input it produces nothing, and does not spend what it has', async () => {
    const result = await produce.execute({ buildingId: 'furniture-empty', period: PERIOD });

    expect(result.produced).toBe(false);
    expect(result.reason).toBe('missing_input');
    const after = await repo.findById('furniture-empty');
    expect(after.stocks.furniture).toBe(0);
    expect(after.stocks.wood).toBe(2);
  });

  test('a missing input leaves the period unlocked, so it runs as soon as it is supplied', async () => {
    await produce.execute({ buildingId: 'furniture-empty', period: PERIOD });
    expect((await repo.findById('furniture-empty')).lastProductionMonth).toBeNull();

    await repo.saveStocks('furniture-empty', { wood: 3 });
    const retry = await produce.execute({ buildingId: 'furniture-empty', period: PERIOD });

    expect(retry.produced).toBe(true);
    const after = await repo.findById('furniture-empty');
    expect(after.stocks.furniture).toBe(1);
    expect(after.stocks.wood).toBe(0);
  });

  test('a producer with no recipe is untouched by any of this', async () => {
    const result = await produce.execute({ buildingId: 'woodcutter-1', period: PERIOD });

    expect(result.produced).toBe(true);
    expect((await repo.findById('woodcutter-1')).stocks.wood).toBe(10);
  });

  test('the recipe scales with the output, so its ratio holds', async () => {
    // 3 inhabitants: 3 stew out, 2 × 3 = 6 game in — not 2.
    const result = await produce.execute({ buildingId: 'hut-1', period: PERIOD });

    expect(result.produced).toBe(true);
    const after = await repo.findById('hut-1');
    expect(after.stocks.stew).toBe(3);
    expect(after.stocks.game).toBe(4); // 10 − 6
  });

  test('a transformation keeps the aggregate its goods are filed under in sync', async () => {
    await produce.execute({ buildingId: 'hut-1', period: PERIOD });

    // Both goods sit under 'meals': 6 game left the total, 3 stew joined it.
    const after = await repo.findById('hut-1');
    expect(after.stocks.meals).toBe(after.stocks.stew + after.stocks.game);
  });
});
