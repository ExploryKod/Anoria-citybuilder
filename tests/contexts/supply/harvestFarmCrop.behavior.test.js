/**
 * Behavior tests — Supply: farm annual harvest
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { createSupplyBuildingSnapshot } from '../../../src/contexts/supply/domain/SupplyBuildingSnapshot.js';
import { createSupplyStock } from '../../../src/contexts/supply/domain/value-objects/SupplyStock.js';
import { matchesSchedule } from '../../../src/contexts/supply/domain/policies/ResourceSchedulePolicy.js';
import { getAmountForRole, getScheduleForRole, hasResourceRole } from '../../../src/contexts/supply/domain/policies/ResourceRolePolicy.js';
import { PRODUCER_BOOKKEEPING } from '../../../src/contexts/supply/domain/catalogs/ResourceBookkeepingCatalog.js';
import { ProduceResource } from '../../../src/contexts/supply/application/commands/harvest/ProduceResource.js';
import { RunResourceCommandForRole } from '../../../src/contexts/supply/application/commands/RunResourceCommandForRole.js';

class InMemorySupplyBuildingRepository {
  constructor(buildings = []) {
    this.raw = new Map(
      buildings.map((b) => [
        b.id,
        {
          ...b,
          stocks: { ...b.stocks },
          lastProductionYear: b.lastProductionYear ?? null,
        },
      ])
    );
  }

  async findById(id) {
    const b = this.raw.get(id);
    if (!b) return null;
    return createSupplyBuildingSnapshot({
      ...b,
      stocks: createSupplyStock(b.stocks),
    });
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
      .map((b) =>
        createSupplyBuildingSnapshot({
          ...b,
          stocks: createSupplyStock(b.stocks),
        })
      );
  }
}

function farm(id, type, extras = {}) {
  return createSupplyBuildingSnapshot({
    id,
    type,
    roadCount: 1,
    worker: 1,
    workerNeed: 1,
    stocks: { wheat: 0, carrot: 0, cabbage: 0, food: 0 },
    maxStock: 100,
    ...extras,
  });
}

describe('Supply — farm harvest', () => {
  describe('domain policies', () => {
    test('harvest season is autumn only', () => {
      const schedule = getScheduleForRole('Farm-Wheat', 'producer');
      expect(matchesSchedule(schedule, { season: 'autumn' })).toBe(true);
      expect(matchesSchedule(schedule, { season: 'summer' })).toBe(false);
    });

    test('annual yield is 78 baskets', () => {
      expect(getAmountForRole('Farm-Wheat', 'producer')).toBe(78);
    });
  });

  describe('ProduceResource (farm harvest circuit)', () => {
    let repo;
    let useCase;

    beforeEach(() => {
      repo = new InMemorySupplyBuildingRepository([
        farm('Farm-Wheat-2-3', 'Farm-Wheat'),
        farm('Farm-Carrot-4-5', 'Farm-Carrot'),
      ]);
      useCase = new ProduceResource(repo);
    });

    test('adds 78 baskets of crop in autumn once per year', async () => {
      const outcome = await useCase.execute({
        buildingId: 'Farm-Wheat-2-3',
        period: { season: 'autumn', year: 3, monthIndex: 9 },
        bookkeeping: PRODUCER_BOOKKEEPING,
      });

      expect(outcome).toEqual({
        produced: true,
        buildingId: 'Farm-Wheat-2-3',
        category: 'wheat',
        amount: 78,
      });

      const updated = await repo.findById('Farm-Wheat-2-3');
      expect(updated.stocks.wheat).toBe(78);
      expect(updated.stocks.food).toBe(78);
      expect(updated.lastProductionYear).toBe(3);
    });

    test('refuses second harvest in same year', async () => {
      await useCase.execute({
        buildingId: 'Farm-Wheat-2-3',
        period: { season: 'autumn', year: 3 },
        bookkeeping: PRODUCER_BOOKKEEPING,
      });

      const second = await useCase.execute({
        buildingId: 'Farm-Wheat-2-3',
        period: { season: 'autumn', year: 3 },
        bookkeeping: PRODUCER_BOOKKEEPING,
      });

      expect(second.produced).toBe(false);
      expect(second.reason).toBe('already_produced_this_period');
      expect((await repo.findById('Farm-Wheat-2-3')).stocks.wheat).toBe(78);
    });

    test('allows harvest again next year', async () => {
      await useCase.execute({
        buildingId: 'Farm-Wheat-2-3',
        period: { season: 'autumn', year: 3 },
        bookkeeping: PRODUCER_BOOKKEEPING,
      });
      await useCase.execute({
        buildingId: 'Farm-Wheat-2-3',
        period: { season: 'autumn', year: 4 },
        bookkeeping: PRODUCER_BOOKKEEPING,
      });

      expect((await repo.findById('Farm-Wheat-2-3')).stocks.wheat).toBe(156);
    });

    test('refuses outside autumn', async () => {
      const outcome = await useCase.execute({
        buildingId: 'Farm-Wheat-2-3',
        period: { season: 'summer', year: 3 },
        bookkeeping: PRODUCER_BOOKKEEPING,
      });
      expect(outcome.produced).toBe(false);
      expect(outcome.reason).toBe('not_production_period');
    });

    test('refuses farm without road access or workers', async () => {
      repo = new InMemorySupplyBuildingRepository([
        farm('Farm-Wheat-2-3', 'Farm-Wheat', { roadCount: 0 }),
        farm('Farm-Carrot-4-5', 'Farm-Carrot', { worker: 0, workerNeed: 1 }),
      ]);
      useCase = new ProduceResource(repo);

      expect(
        (
          await useCase.execute({
            buildingId: 'Farm-Wheat-2-3',
            period: { season: 'autumn', year: 1 },
            bookkeeping: PRODUCER_BOOKKEEPING,
          })
        ).reason
      ).toBe('not_operational');
      expect(
        (
          await useCase.execute({
            buildingId: 'Farm-Carrot-4-5',
            period: { season: 'autumn', year: 1 },
            bookkeeping: PRODUCER_BOOKKEEPING,
          })
        ).reason
      ).toBe('not_operational');
    });
  });

  describe('RunResourceCommandForRole (producer)', () => {
    test('harvests every operational farm in autumn', async () => {
      const repo = new InMemorySupplyBuildingRepository([
        farm('Farm-Wheat-2-3', 'Farm-Wheat'),
        farm('Farm-Carrot-4-5', 'Farm-Carrot'),
        farm('Farm-Cabbage-6-7', 'Farm-Cabbage', { worker: 0, workerNeed: 1 }),
      ]);
      const produceResource = new ProduceResource(repo);
      const runProducerCommand = new RunResourceCommandForRole(repo, produceResource);

      const { count, results } = await runProducerCommand.execute({
        role: 'producer',
        buildParams: (farm) => ({
          buildingId: farm.id,
          period: { season: 'autumn', year: 2, monthIndex: 9 },
          bookkeeping: PRODUCER_BOOKKEEPING,
        }),
        successKey: 'produced',
      });
      const harvests = results.map((r) => ({ ...r, farmId: r.buildingId, crop: r.category }));

      expect(count).toBe(2);
      expect(harvests).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ farmId: 'Farm-Wheat-2-3', crop: 'wheat', amount: 78 }),
          expect.objectContaining({ farmId: 'Farm-Carrot-4-5', crop: 'carrot', amount: 78 }),
        ])
      );
    });
  });
});
