/**
 * Behavior tests — Supply: household gathering (fruit + game).
 *
 * Gathering is no longer a special mechanism: it is a 'producer' entry on
 * every house in buildingEconomy.js (HOUSE_GATHERING), run by the same
 * ProduceResource command as a farm. Amounts, the per-house/per-inhabitant
 * `scale` and the road-free gate are all catalog facts — these tests read
 * the catalog rather than assuming any number.
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import { createSupplyBuildingSnapshot } from '../../../src/contexts/supply/domain/SupplyBuildingSnapshot.js';
import { createSupplyStock } from '../../../src/contexts/supply/domain/value-objects/SupplyStock.js';
import {
  hasResourceRole,
  getResourceRoles,
} from '../../../src/contexts/supply/domain/policies/ResourceRolePolicy.js';
import { ProduceResource } from '../../../src/contexts/supply/application/commands/harvest/ProduceResource.js';
import { RunResourceCommandForRole } from '../../../src/contexts/supply/application/commands/RunResourceCommandForRole.js';

const gathering = getResourceRoles('House-Blue').find(
  (entry) => entry.role === 'producer'
);
const perHouse = gathering.amount;

class InMemorySupplyBuildingRepository {
  constructor(buildings = []) {
    this.raw = new Map(
      buildings.map((b) => [
        b.id,
        {
          ...b,
          stocks: { ...b.stocks },
          lastSubsistenceMonth: b.lastSubsistenceMonth ?? null,
        },
      ])
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

  async findByResourceRole(role, categories) {
    return [...this.raw.values()]
      .filter((b) => hasResourceRole(b.type, role, categories))
      .map((b) => createSupplyBuildingSnapshot({ ...b, stocks: createSupplyStock(b.stocks) }));
  }
}

function house(id, extras = {}) {
  return createSupplyBuildingSnapshot({
    id,
    type: 'House-Blue',
    roadCount: 0,
    pop: 3,
    level: 1,
    stocks: { food: 0 },
    ...extras,
  });
}

const period = (monthIndex) => ({ season: 'Été', year: 0, monthIndex });

describe('Supply — household gathering declared in the catalog', () => {
  test('every house type declares the gathering entry, with the same categories as its diet', () => {
    for (const type of ['House-Blue', 'House-Red', 'House-Purple']) {
      const producer = getResourceRoles(type).find((entry) => entry.role === 'producer');
      expect(producer).toBeDefined();
      expect(producer.scale).toBe('building');
      expect(producer.requiresOperational).toBe(false);
      const diet = getResourceRoles(type).find(
        (entry) => entry.role === 'consumer' && (entry.consumption ?? 'quantity') === 'quantity'
      );
      for (const category of producer.categories) {
        expect(diet.categories).toContain(category);
      }
    }
  });

  describe('ProduceResource on a house', () => {
    let repo;
    let useCase;

    beforeEach(() => {
      repo = new InMemorySupplyBuildingRepository([house('House-Blue-1-2', { pop: 3 })]);
      useCase = new ProduceResource(repo);
    });

    test('credits every gathered category and the diet total, without a road', async () => {
      const outcome = await useCase.execute({ buildingId: 'House-Blue-1-2', period: period(4) });

      expect(outcome.produced).toBe(true);
      const updated = await repo.findById('House-Blue-1-2');
      for (const category of gathering.categories) {
        expect(updated.stocks[category]).toBe(perHouse);
      }
      expect(updated.stocks[gathering.totalKey]).toBe(perHouse * gathering.categories.length);
      expect(updated.lastSubsistenceMonth).toBe(4);
    });

    test('a fixed amount per house: population does not change it', async () => {
      const small = new InMemorySupplyBuildingRepository([house('A', { pop: 1 })]);
      const big = new InMemorySupplyBuildingRepository([house('B', { pop: 6 })]);
      await new ProduceResource(small).execute({ buildingId: 'A', period: period(1) });
      await new ProduceResource(big).execute({ buildingId: 'B', period: period(1) });

      expect((await small.findById('A')).stocks.food).toBe((await big.findById('B')).stocks.food);
    });

    test('leaves the other goods of the diet untouched', async () => {
      repo = new InMemorySupplyBuildingRepository([
        house('House-Blue-1-2', { stocks: { wheat: 7, food: 7 } }),
      ]);
      await new ProduceResource(repo).execute({ buildingId: 'House-Blue-1-2', period: period(2) });

      const updated = await repo.findById('House-Blue-1-2');
      expect(updated.stocks.wheat).toBe(7);
      expect(updated.stocks.food).toBe(7 + perHouse * gathering.categories.length);
    });

    test('refuses a second production in the same month, allows the next one', async () => {
      await useCase.execute({ buildingId: 'House-Blue-1-2', period: period(4) });
      const second = await useCase.execute({ buildingId: 'House-Blue-1-2', period: period(4) });
      expect(second.produced).toBe(false);
      expect(second.reason).toBe('already_produced_this_period');

      const next = await useCase.execute({ buildingId: 'House-Blue-1-2', period: period(5) });
      expect(next.produced).toBe(true);
    });

    test('also produces for level 2 houses — gathering is independent from the market cycle', async () => {
      repo = new InMemorySupplyBuildingRepository([house('House-Blue-1-2', { pop: 3, level: 2 })]);
      const outcome = await new ProduceResource(repo).execute({
        buildingId: 'House-Blue-1-2',
        period: period(4),
      });
      expect(outcome.produced).toBe(true);
    });

    test('skips houses with zero population', async () => {
      repo = new InMemorySupplyBuildingRepository([house('House-Blue-1-2', { pop: 0 })]);
      const outcome = await new ProduceResource(repo).execute({
        buildingId: 'House-Blue-1-2',
        period: period(4),
      });
      expect(outcome.produced).toBe(false);
      expect(outcome.reason).toBe('no_population');
    });
  });

  describe('RunResourceCommandForRole over producers', () => {
    test('produces for every inhabited house, skips uninhabited ones', async () => {
      const repo = new InMemorySupplyBuildingRepository([
        house('House-Blue-1-2', { pop: 2 }),
        house('House-Purple-3-4', { type: 'House-Purple', pop: 1 }),
        house('House-Red-5-6', { type: 'House-Red', pop: 3, level: 2 }),
        house('House-Blue-7-8', { pop: 0 }),
      ]);
      const run = new RunResourceCommandForRole(repo, new ProduceResource(repo));

      const { count } = await run.execute({
        role: 'producer',
        categories: gathering.categories,
        buildParams: (b) => ({ buildingId: b.id, period: period(2) }),
        successKey: 'produced',
      });

      expect(count).toBe(3);
      for (const id of ['House-Blue-1-2', 'House-Purple-3-4', 'House-Red-5-6']) {
        const stocks = (await repo.findById(id)).stocks;
        for (const category of gathering.categories) expect(stocks[category]).toBe(perHouse);
      }
      expect((await repo.findById('House-Blue-7-8')).stocks.food).toBe(0);
    });

    test('a farm-only category filter never selects a house', async () => {
      expect(hasResourceRole('House-Blue', 'producer', ['wheat'])).toBe(false);
    });
  });
});

describe('Supply — the `scale: "population"` option', () => {
  test('multiplies amount by the inhabitants (entry supplied through the catalog accessor)', async () => {
    const policyPath = '../../../src/contexts/supply/domain/policies/ResourceRolePolicy.js';
    const actual = await import(policyPath);
    jest.unstable_mockModule(policyPath, () => ({
      ...actual,
      getResourceRoles: (type) =>
        type === 'Test-Forager'
          ? [
              {
                role: 'producer',
                categories: ['fruit'],
                totalKey: 'food',
                amount: 2,
                scale: 'population',
                requiresOperational: false,
                schedule: { unit: 'always' },
                periodLock: { field: 'lastSubsistenceMonth', unit: 'month' },
              },
            ]
          : actual.getResourceRoles(type),
    }));
    const { ProduceResource: MockedProduce } = await import(
      '../../../src/contexts/supply/application/commands/harvest/ProduceResource.js?scaled'
    );

    const repo = new InMemorySupplyBuildingRepository([house('T', { type: 'Test-Forager', pop: 4 })]);
    await new MockedProduce(repo).execute({ buildingId: 'T', period: period(3) });

    expect((await repo.findById('T')).stocks.fruit).toBe(8);
  });
});
