import { describe, test, expect } from '@jest/globals';
import { RunMonthlyResourceCycle } from '../../../src/contexts/supply/application/workflows/RunMonthlyResourceCycle.js';
import { hasResourceRole } from '../../../src/contexts/supply/domain/policies/ResourceRolePolicy.js';
import { createSupplyBuildingSnapshot } from '../../../src/contexts/supply/domain/SupplyBuildingSnapshot.js';
import { useDaysPerMonthForTests } from '../../../src/config/events.js';

// A good lives its own months, a granary keeps the food four times as long, and a good that never goes bad is not aged at all.
const MONTH = 3;
useDaysPerMonthForTests(MONTH);

class InMemoryRepository {
  constructor(rows) {
    this.raw = new Map(rows.map((row) => [row.id, { ...row }]));
  }

  async findByResourceRole(role) {
    return [...this.raw.values()].filter((row) => hasResourceRole(row.type, role)).map((row) => createSupplyBuildingSnapshot({ ...row, stocks: { ...row.stocks } }));
  }

  async saveStocks(id, stocks) {
    this.raw.get(id).stocks = { ...stocks };
  }

  async updateBuildingFields(id, fields) {
    Object.assign(this.raw.get(id), fields);
  }
}

const cycleOver = (repo, losses) => {
  const step = { execute: async () => ({ hubs: [], results: [] }) };
  const traceability = new Proxy({}, { get: () => async () => {} });
  return new RunMonthlyResourceCycle(step, step, step, step, step, traceability, { supplyBuildingRepository: repo, recordSpoilage: async (loss) => { losses.push(loss); } }, { categories: [] });
};

const tickAt = (turn) => ({ season: null, month: null, timeInfo: { monthIndex: 0, year: 1, dayInMonth: 1, turn } });

describe('stock aging', () => {
  const rows = () => [
    { id: 'field', type: 'Farm-Carrot', x: 0, y: 0, stocks: { carrot: 10, food: 10 }, stockAges: { carrot: [[0, 10]] } },
    { id: 'granary', type: 'Windmill-001', x: 5, y: 0, stocks: { carrot: 10, food: 10 }, stockAges: { carrot: [[0, 10]] } },
  ];

  test('a carrot left in the field goes bad after its months, the same carrot in a granary lasts four times as long', async () => {
    const repo = new InMemoryRepository(rows());
    const losses = [];
    await cycleOver(repo, losses).execute(tickAt(3 * MONTH));

    expect(repo.raw.get('field').stocks.carrot).toBe(0);
    // What spoils leaves the total the harvest put it in: a farm does not keep food that no longer exists.
    expect(repo.raw.get('field').stocks.food).toBe(0);
    expect(repo.raw.get('granary').stocks.carrot).toBe(10);
    expect(losses).toHaveLength(1);
    expect(losses[0]).toMatchObject({ category: 'carrot', quantity: 10, building: { id: 'field' } });

    await cycleOver(repo, losses).execute(tickAt(12 * MONTH));
    expect(repo.raw.get('granary').stocks.carrot).toBe(0);
    expect(repo.raw.get('granary').stocks.food).toBe(0);
    expect(losses.map((loss) => loss.building.id)).toEqual(['field', 'granary']);
  });

  test('a stock that arrived without an age is born on the tick that sees it', async () => {
    const repo = new InMemoryRepository([{ id: 'field', type: 'Farm-Carrot', x: 0, y: 0, stocks: { carrot: 4 } }]);
    await cycleOver(repo, []).execute(tickAt(5));
    expect(repo.raw.get('field').stockAges).toEqual({ carrot: [[5, 4]] });
  });
});
