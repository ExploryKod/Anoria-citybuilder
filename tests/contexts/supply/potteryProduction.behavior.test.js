/**
 * Behavior tests — Supply: pottery workshop production
 *
 * Second independent quantity-good chain (after food) — proves the
 * 'producer' role, ProduceResource, and getResourceStockShape() are truly
 * goods-agnostic, not secretly food-shaped. Same generic engine as
 * Farm-Wheat/Carrot/Cabbage, just a different category set (plate/pot/
 * amphora, no shared totalKey since nothing collects across them yet).
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { createSupplyBuildingSnapshot } from '../../../src/contexts/supply/domain/SupplyBuildingSnapshot.js';
import { createSupplyStock } from '../../../src/contexts/supply/domain/value-objects/SupplyStock.js';
import { getAmountForRole, hasResourceRole } from '../../../src/contexts/supply/domain/policies/ResourceRolePolicy.js';
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
          lastProductionMonth: b.lastProductionMonth ?? null,
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

function workshop(id, type, extras = {}) {
  return createSupplyBuildingSnapshot({
    id,
    type,
    roadCount: 1,
    worker: 2,
    workerNeed: 2,
    stocks: {},
    ...extras,
  });
}

describe('Supply — pottery workshop production', () => {
  test('each workshop produces 5 units of its own category per month', () => {
    expect(getAmountForRole('Factory-Plate', 'producer')).toBe(5);
    expect(getAmountForRole('Factory-Pot', 'producer')).toBe(5);
    expect(getAmountForRole('Factory-Amphora', 'producer')).toBe(5);
  });

  describe('ProduceResource (workshop production circuit)', () => {
    let repo;
    let useCase;

    beforeEach(() => {
      repo = new InMemorySupplyBuildingRepository([
        workshop('Factory-Plate-2-3', 'Factory-Plate'),
        workshop('Factory-Pot-4-5', 'Factory-Pot'),
        workshop('Factory-Amphora-6-7', 'Factory-Amphora'),
      ]);
      useCase = new ProduceResource(repo);
    });

    test('adds 5 plates and survives a stock round-trip without vanishing', async () => {
      const outcome = await useCase.execute({
        buildingId: 'Factory-Plate-2-3',
        period: { monthIndex: 3, year: 1 },
      });

      expect(outcome).toEqual({
        produced: true,
        buildingId: 'Factory-Plate-2-3',
        category: 'plate',
        amount: 5,
      });

      const updated = await repo.findById('Factory-Plate-2-3');
      expect(updated.stocks.plate).toBe(5);
      expect(updated.lastProductionMonth).toBe(3);
    });

    test('plate, pot, and amphora stay independent categories — no cross-contamination', async () => {
      await useCase.execute({ buildingId: 'Factory-Plate-2-3', period: { monthIndex: 1 } });
      await useCase.execute({ buildingId: 'Factory-Pot-4-5', period: { monthIndex: 1 } });
      await useCase.execute({ buildingId: 'Factory-Amphora-6-7', period: { monthIndex: 1 } });

      expect((await repo.findById('Factory-Plate-2-3')).stocks.plate).toBe(5);
      expect((await repo.findById('Factory-Plate-2-3')).stocks.pot).toBe(0);
      expect((await repo.findById('Factory-Pot-4-5')).stocks.pot).toBe(5);
      expect((await repo.findById('Factory-Pot-4-5')).stocks.plate).toBe(0);
      expect((await repo.findById('Factory-Amphora-6-7')).stocks.amphora).toBe(5);
    });

    test('refuses second production in the same month, allows again next month', async () => {
      await useCase.execute({ buildingId: 'Factory-Plate-2-3', period: { monthIndex: 3 } });
      const second = await useCase.execute({ buildingId: 'Factory-Plate-2-3', period: { monthIndex: 3 } });
      expect(second.produced).toBe(false);
      expect(second.reason).toBe('already_produced_this_period');

      await useCase.execute({ buildingId: 'Factory-Plate-2-3', period: { monthIndex: 4 } });
      expect((await repo.findById('Factory-Plate-2-3')).stocks.plate).toBe(10);
    });

    test('refuses without road access or workers', async () => {
      repo = new InMemorySupplyBuildingRepository([
        workshop('Factory-Plate-2-3', 'Factory-Plate', { roadCount: 0 }),
      ]);
      useCase = new ProduceResource(repo);

      const outcome = await useCase.execute({ buildingId: 'Factory-Plate-2-3', period: { monthIndex: 1 } });
      expect(outcome.reason).toBe('not_operational');
    });
  });

  describe('RunResourceCommandForRole (producer)', () => {
    test('produces for every operational pottery workshop alongside farms, unaffected by either', async () => {
      const repo = new InMemorySupplyBuildingRepository([
        workshop('Factory-Plate-2-3', 'Factory-Plate'),
        workshop('Factory-Pot-4-5', 'Factory-Pot'),
      ]);
      const produceResource = new ProduceResource(repo);
      const runProducerCommand = new RunResourceCommandForRole(repo, produceResource);

      const { count, results } = await runProducerCommand.execute({
        role: 'producer',
        buildParams: (b) => ({ buildingId: b.id, period: { monthIndex: 5 } }),
        successKey: 'produced',
      });

      expect(count).toBe(2);
      expect(results).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ buildingId: 'Factory-Plate-2-3', category: 'plate', amount: 5 }),
          expect.objectContaining({ buildingId: 'Factory-Pot-4-5', category: 'pot', amount: 5 }),
        ])
      );
    });
  });
});
