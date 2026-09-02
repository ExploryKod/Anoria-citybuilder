/**
 * Behavior tests — Supply: farm annual harvest
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { createSupplyBuildingSnapshot } from '../../../src/contexts/supply/domain/SupplyBuildingSnapshot.js';
import { createFoodStock } from '../../../src/contexts/supply/domain/value-objects/FoodStock.js';
import { canFarmHarvest } from '../../../src/contexts/supply/domain/policies/HarvestSeasonPolicy.js';
import { annualFarmYield } from '../../../src/contexts/supply/domain/policies/FarmYieldPolicy.js';
import { FARM_HARVEST_CIRCUIT } from '../../../src/contexts/supply/domain/catalogs/FoodCircuits.js';
import { ProduceResource } from '../../../src/contexts/supply/application/commands/harvest/ProduceResource.js';
import { HarvestAllFarmCrops } from '../../../src/contexts/supply/application/commands/harvest/HarvestAllFarmCrops.js';

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
      stocks: createFoodStock(b.stocks),
    });
  }

  async saveStocks(id, stocks) {
    const b = this.raw.get(id);
    if (b) b.stocks = { ...createFoodStock(stocks) };
  }

  async updateBuildingFields(id, fields) {
    const b = this.raw.get(id);
    if (!b) return;
    for (const key of Object.keys(fields)) {
      if (fields[key] !== undefined) b[key] = fields[key];
    }
  }

  async findFarms() {
    return [...this.raw.values()]
      .filter((b) => b.type.includes('Farm'))
      .map((b) =>
        createSupplyBuildingSnapshot({
          ...b,
          stocks: createFoodStock(b.stocks),
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
      expect(canFarmHarvest('autumn')).toBe(true);
      expect(canFarmHarvest('summer')).toBe(false);
    });

    test('annual yield is 78 baskets', () => {
      expect(annualFarmYield()).toBe(78);
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
        circuit: FARM_HARVEST_CIRCUIT,
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
        circuit: FARM_HARVEST_CIRCUIT,
      });

      const second = await useCase.execute({
        buildingId: 'Farm-Wheat-2-3',
        period: { season: 'autumn', year: 3 },
        circuit: FARM_HARVEST_CIRCUIT,
      });

      expect(second.produced).toBe(false);
      expect(second.reason).toBe('already_produced_this_period');
      expect((await repo.findById('Farm-Wheat-2-3')).stocks.wheat).toBe(78);
    });

    test('allows harvest again next year', async () => {
      await useCase.execute({
        buildingId: 'Farm-Wheat-2-3',
        period: { season: 'autumn', year: 3 },
        circuit: FARM_HARVEST_CIRCUIT,
      });
      await useCase.execute({
        buildingId: 'Farm-Wheat-2-3',
        period: { season: 'autumn', year: 4 },
        circuit: FARM_HARVEST_CIRCUIT,
      });

      expect((await repo.findById('Farm-Wheat-2-3')).stocks.wheat).toBe(156);
    });

    test('refuses outside autumn', async () => {
      const outcome = await useCase.execute({
        buildingId: 'Farm-Wheat-2-3',
        period: { season: 'summer', year: 3 },
        circuit: FARM_HARVEST_CIRCUIT,
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
            circuit: FARM_HARVEST_CIRCUIT,
          })
        ).reason
      ).toBe('not_operational');
      expect(
        (
          await useCase.execute({
            buildingId: 'Farm-Carrot-4-5',
            period: { season: 'autumn', year: 1 },
            circuit: FARM_HARVEST_CIRCUIT,
          })
        ).reason
      ).toBe('not_operational');
    });
  });

  describe('HarvestAllFarmCrops', () => {
    test('harvests every operational farm in autumn', async () => {
      const repo = new InMemorySupplyBuildingRepository([
        farm('Farm-Wheat-2-3', 'Farm-Wheat'),
        farm('Farm-Carrot-4-5', 'Farm-Carrot'),
        farm('Farm-Cabbage-6-7', 'Farm-Cabbage', { worker: 0, workerNeed: 1 }),
      ]);
      const produceResource = new ProduceResource(repo);
      const harvestAll = new HarvestAllFarmCrops(repo, produceResource);

      const outcome = await harvestAll.execute({
        season: 'autumn',
        year: 2,
        monthIndex: 9,
      });

      expect(outcome.harvestedCount).toBe(2);
      expect(outcome.harvests).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ farmId: 'Farm-Wheat-2-3', crop: 'wheat', amount: 78 }),
          expect.objectContaining({ farmId: 'Farm-Carrot-4-5', crop: 'carrot', amount: 78 }),
        ])
      );
    });
  });
});
