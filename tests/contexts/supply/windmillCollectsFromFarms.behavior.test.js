/**
 * Behavior tests — Supply: windmill collects from all farms (UUID)
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { createSupplyBuildingSnapshot } from '../../../src/contexts/supply/domain/SupplyBuildingSnapshot.js';
import { createSupplyStock } from '../../../src/contexts/supply/domain/value-objects/SupplyStock.js';
import { matchesSchedule } from '../../../src/contexts/supply/domain/policies/ResourceSchedulePolicy.js';
import { getCollectionSchedule } from '../../../src/contexts/supply/domain/policies/ResourceRolePolicy.js';
import { CollectResourceToHub } from '../../../src/contexts/supply/application/commands/surplus/CollectResourceToHub.js';
import { toSupplyMonth } from '../../../src/composition/supplyOps.js';
import { createBuildingInstanceId } from '../../../src/shared/building-identity/index.js';
import { referencePriceBook } from '../../helpers/referencePriceBook.js';

class InMemorySupplyBuildingRepository {
  constructor(buildings = []) {
    this.raw = new Map(buildings.map((b) => [b.id, { ...b, stocks: { ...b.stocks } }]));
  }

  async findById(id) {
    const b = this.raw.get(id);
    return b ? { ...b, stocks: createSupplyStock(b.stocks) } : null;
  }

  async saveStocks(id, stocks) {
    const b = this.raw.get(id);
    if (b) b.stocks = { ...createSupplyStock(stocks) };
  }

  async saveSupplyFlags() {}

  async updateBuildingFields(id, fields) {
    const b = this.raw.get(id);
    if (b) Object.assign(b, fields);
  }
}

function windmill(id, stocks, extras = {}) {
  return createSupplyBuildingSnapshot({
    id,
    type: 'Windmill-001',
    roadCount: 1,
    worker: 1,
    workerNeed: 1,
    stocks,
    maxStock: 1000,
    ...extras,
  });
}

function farm(id, type, stocks, roadCount = 1) {
  return createSupplyBuildingSnapshot({
    id,
    type,
    roadCount,
    stocks,
    maxStock: 100,
  });
}

describe('Supply — windmill collection', () => {
  describe('domain policies', () => {
    test('the granary collects in the months its crops are sold in: october (the cabbage, which keeps two months) and december', () => {
      const schedule = getCollectionSchedule('Windmill-001');
      // Declared once, on each farm's sale window: the granary only follows them.
      expect(schedule).toEqual({ unit: 'month', values: ['october', 'december'] });
      expect(matchesSchedule(schedule, { month: 'december' })).toBe(true);
      expect(matchesSchedule(schedule, { month: 'october' })).toBe(true);
      expect(matchesSchedule(schedule, { month: 'november' })).toBe(false);
      expect(toSupplyMonth('Décembre')).toBe('december');
      expect(toSupplyMonth('Octobre')).toBe('october');
    });
  });

  describe('CollectResourceToHub (windmill collect circuit)', () => {
    let repo;
    let useCase;
    let windmillId;
    let wheatFarmId;
    let carrotFarmId;
    let cabbageFarmId;

    beforeEach(() => {
      windmillId = createBuildingInstanceId();
      wheatFarmId = createBuildingInstanceId();
      carrotFarmId = createBuildingInstanceId();
      cabbageFarmId = createBuildingInstanceId();
      repo = new InMemorySupplyBuildingRepository([
        windmill(windmillId, { wheat: 0, carrot: 0, cabbage: 0, food: 0 }),
        farm(wheatFarmId, 'Farm-Wheat', { wheat: 10, food: 10 }),
        farm(carrotFarmId, 'Farm-Carrot', { carrot: 5, food: 5 }),
        farm(cabbageFarmId, 'Farm-Cabbage', { cabbage: 3, food: 3 }),
      ]);
      useCase = new CollectResourceToHub(repo, null, { priceBook: referencePriceBook, purchasingPower: async () => Infinity });
    });

    test('collects the wheat and carrot farms in december: the cabbage was sold in october', async () => {
      const outcome = await useCase.execute({
        hubId: windmillId,
        period: { month: 'december', turn: 1 },
        sourceRefs: [
          { instanceId: wheatFarmId },
          { instanceId: carrotFarmId },
          { instanceId: cabbageFarmId },
        ],
      });

      expect(outcome.collected).toBe(true);
      expect(outcome.totalUnits).toBe(15);
      expect(outcome.transfers).toHaveLength(2);

      const mill = await repo.findById(windmillId);
      expect(mill.stocks.wheat).toBe(10);
      expect(mill.stocks.carrot).toBe(5);
      expect(mill.stocks.cabbage).toBe(0);
      expect(mill.stocks.food).toBe(15);
      expect((await repo.findById(cabbageFarmId)).stocks.cabbage).toBe(3);

      expect((await repo.findById(wheatFarmId)).stocks.wheat).toBe(0);
      expect((await repo.findById(carrotFarmId)).stocks.carrot).toBe(0);
    });

    test('collects the cabbage in october, before it spoils, and leaves the other crops for december', async () => {
      const outcome = await useCase.execute({
        hubId: windmillId,
        period: { month: 'october', turn: 1 },
        sourceRefs: [{ instanceId: wheatFarmId }, { instanceId: carrotFarmId }, { instanceId: cabbageFarmId }],
      });

      expect(outcome.totalUnits).toBe(3);
      expect(outcome.transfers).toHaveLength(1);
      expect((await repo.findById(windmillId)).stocks.cabbage).toBe(3);
      expect((await repo.findById(wheatFarmId)).stocks.wheat).toBe(10);
    });

    test('refuses outside the collecting months', async () => {
      const outcome = await useCase.execute({
        hubId: windmillId,
        period: { month: 'november' },
        sourceRefs: [{ instanceId: wheatFarmId }],
      });

      expect(outcome.collected).toBe(false);
      expect(outcome.reason).toBe('not_collection_period');
      expect((await repo.findById(wheatFarmId)).stocks.wheat).toBe(10);
    });

    test('collects from a farm without road access (the catalog says fields need none)', async () => {
      repo = new InMemorySupplyBuildingRepository([
        windmill(windmillId, { food: 0 }),
        farm(wheatFarmId, 'Farm-Wheat', { wheat: 10, food: 10 }, 0),
      ]);
      useCase = new CollectResourceToHub(repo, null, { priceBook: referencePriceBook, purchasingPower: async () => Infinity });

      const outcome = await useCase.execute({
        hubId: windmillId,
        period: { month: 'december', turn: 1 },
        sourceRefs: [{ instanceId: wheatFarmId }],
      });

      expect(outcome.collected).toBe(true);
      expect(outcome.totalUnits).toBe(10);
      expect((await repo.findById(wheatFarmId)).stocks.wheat).toBe(0);
    });

    test('refuses when windmill has no road access', async () => {
      repo = new InMemorySupplyBuildingRepository([
        windmill(windmillId, { food: 0 }, { roadCount: 0 }),
        farm(wheatFarmId, 'Farm-Wheat', { wheat: 10, food: 10 }),
      ]);
      useCase = new CollectResourceToHub(repo, null, { priceBook: referencePriceBook, purchasingPower: async () => Infinity });

      const outcome = await useCase.execute({
        hubId: windmillId,
        period: { month: 'december', turn: 1 },
        sourceRefs: [{ instanceId: wheatFarmId }],
      });

      expect(outcome.collected).toBe(false);
      expect(outcome.reason).toBe('hub_not_operational');
    });

    test('respects windmill capacity', async () => {
      repo = new InMemorySupplyBuildingRepository([
        windmill(windmillId, { wheat: 0, food: 0 }, { maxStock: 4, hubStorageOrders: { wheat: { mode: 'accept', maxPercent: 100 } } }),
        farm(wheatFarmId, 'Farm-Wheat', { wheat: 10, food: 10 }),
        farm(carrotFarmId, 'Farm-Carrot', { carrot: 5, food: 5 }),
      ]);
      useCase = new CollectResourceToHub(repo, null, { priceBook: referencePriceBook, purchasingPower: async () => Infinity });

      const outcome = await useCase.execute({
        hubId: windmillId,
        period: { month: 'december', turn: 1 },
        sourceRefs: [{ instanceId: wheatFarmId }, { instanceId: carrotFarmId }],
      });

      expect(outcome.collected).toBe(true);
      expect(outcome.totalUnits).toBe(4);
      expect((await repo.findById(windmillId)).stocks.food).toBe(4);
      expect((await repo.findById(wheatFarmId)).stocks.wheat).toBe(6);
      expect((await repo.findById(carrotFarmId)).stocks.carrot).toBe(5);
    });
  });
});
