/**
 * Behavior tests — Supply: pottery workshop production
 *
 * Second independent quantity-good chain (after food), declared as a production CYCLE
 * (see ProduceResource `cycle`): 2 in the first month, x5 in the second, credited when complete.
 */

import { describe, test, expect } from '@jest/globals';
import { createSupplyBuildingSnapshot } from '../../../src/contexts/supply/domain/SupplyBuildingSnapshot.js';
import { createSupplyStock } from '../../../src/contexts/supply/domain/value-objects/SupplyStock.js';
import { hasResourceRole } from '../../../src/contexts/supply/domain/policies/ResourceRolePolicy.js';
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

const day = (monthIndex) => ({ season: 'spring', month: 'january', monthIndex, year: 1, dayInMonth: 1 });

describe('Supply — a workshop is a cycle: a base, then a multiplier, credited when complete', () => {
  test('pottery makes 2 in the first month, x5 in the second, and credits 10 only then', async () => {
    const repo = new InMemorySupplyBuildingRepository([workshop('plate', 'Factory-Plate')]);
    const produce = new ProduceResource(repo);

    const first = await produce.execute({ buildingId: 'plate', period: day(0) });
    expect(first.produced).toBe(false);
    expect((await repo.findById('plate')).stocks.plate).toBe(0);

    // Same month, later tick: the second step is not open yet — no shortcut through the cycle.
    await produce.execute({ buildingId: 'plate', period: day(0) });
    expect((await repo.findById('plate')).stocks.plate).toBe(0);

    const second = await produce.execute({ buildingId: 'plate', period: day(1) });
    expect(second).toEqual({ produced: true, buildingId: 'plate', category: 'plate', amount: 10 });
    expect((await repo.findById('plate')).stocks.plate).toBe(10);

    // The next cycle starts by itself the month after: 10 more two months on.
    await produce.execute({ buildingId: 'plate', period: day(2) });
    await produce.execute({ buildingId: 'plate', period: day(3) });
    expect((await repo.findById('plate')).stocks.plate).toBe(20);
  });

  test('goods stay independent, and an unstaffed workshop makes no progress', async () => {
    const repo = new InMemorySupplyBuildingRepository([
      workshop('pot', 'Factory-Pot'),
      workshop('idle', 'Factory-Amphora', { worker: 0 }),
    ]);
    const produce = new ProduceResource(repo);
    const runProducers = new RunResourceCommandForRole(repo, produce);

    for (const monthIndex of [0, 1]) {
      await runProducers.execute({
        role: 'producer',
        buildParams: (b) => ({ buildingId: b.id, period: day(monthIndex) }),
        successKey: 'produced',
      });
    }

    expect((await repo.findById('pot')).stocks.pot).toBe(10);
    expect((await repo.findById('pot')).stocks.plate).toBe(0);
    expect((await repo.findById('idle')).stocks.amphora).toBe(0);
  });

  test('a first step that comes late is still done (wait), and the cycle goes on', async () => {
    const repo = new InMemorySupplyBuildingRepository([workshop('plate', 'Factory-Plate')]);
    const produce = new ProduceResource(repo);

    // Unstaffed while its first window is open...
    await repo.updateBuildingFields('plate', { worker: 0 });
    await produce.execute({ buildingId: 'plate', period: day(0) });
    // ...staffed only in the next month: the first step is done late, the second is open right away.
    await repo.updateBuildingFields('plate', { worker: 2 });
    const done = await produce.execute({ buildingId: 'plate', period: day(1) });

    expect(done.amount).toBe(10);
  });
});
