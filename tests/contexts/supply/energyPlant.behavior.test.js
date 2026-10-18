/**
 * Behavior tests — Supply: the two power plants turn an imported fuel into the month's energy. The fuel is drawn from a trade
 * warehouse (where imports are held) and bought from it; with none, the plant makes nothing; the plant that burns coal does
 * not touch the petrol. Real catalog (CoalPlant, PetrolPlant, TradeWarehouse).
 */
import { describe, test, expect } from '@jest/globals';
import { HubServing } from '../../../src/contexts/supply/application/services/HubServing.js';
import { ProduceResource } from '../../../src/contexts/supply/application/commands/harvest/ProduceResource.js';
import { createSupplyBuildingSnapshot } from '../../../src/contexts/supply/domain/SupplyBuildingSnapshot.js';
import { createSupplyStock } from '../../../src/contexts/supply/domain/value-objects/SupplyStock.js';
import { hasResourceRole } from '../../../src/contexts/supply/domain/policies/ResourceRolePolicy.js';
import { getMaxStockForBuilding } from '../../../src/shared/building-catalog/resourceRoleQueries.js';
import { createBuildingInstanceId } from '../../../src/shared/building-identity/index.js';

class InMemoryRepository {
  constructor(buildings) {
    this.raw = new Map(buildings.map((b) => [b.id, { flags: {}, roadCount: 1, worker: 3, workerNeed: 3, ...b }]));
  }
  #snapshot(b) {
    return createSupplyBuildingSnapshot({ ...b, stocks: createSupplyStock(b.stocks ?? {}), maxStock: getMaxStockForBuilding(b.type) });
  }
  async findById(id) {
    const b = this.raw.get(id);
    return b ? this.#snapshot(b) : null;
  }
  async findByResourceRole(role, categories) {
    return [...this.raw.values()].filter((b) => hasResourceRole(b.type, role, categories)).map((b) => this.#snapshot(b));
  }
  async saveStocks(id, stocks) {
    this.raw.get(id).stocks = { ...createSupplyStock(stocks) };
  }
  async updateBuildingFields(id, fields) {
    Object.assign(this.raw.get(id), fields);
  }
}

const ids = (...names) => Object.fromEntries(names.map((name) => [name, createBuildingInstanceId()]));
const month = (monthIndex) => ({ season: 'spring', month: 'january', monthIndex, year: 1, dayInMonth: 1, turn: monthIndex });

function build(buildings) {
  const repo = new InMemoryRepository(buildings);
  const purchases = [];
  const produce = new ProduceResource(repo, {
    hubServing: new HubServing(repo),
    recordInputPurchase: async (purchase) => { purchases.push(purchase); },
  });
  return { repo, produce, purchases };
}

describe('Supply — power plants', () => {
  test('a coal plant burns the coal of a trade warehouse into a month of energy (120 MWh), and pays the warehouse for it', async () => {
    const id = ids('trade', 'plant');
    const { repo, produce, purchases } = build([
      { id: id.trade, type: 'TradeWarehouse', x: 40, y: 0, stocks: { coal: 10, goods: 10 } },
      { id: id.plant, type: 'CoalPlant', x: 0, y: 0, stocks: {} },
    ]);

    await produce.execute({ buildingId: id.plant, period: month(0) });

    expect(repo.raw.get(id.plant).stocks.energy).toBe(120);
    expect(repo.raw.get(id.trade).stocks.coal).toBe(6); // 4 burned
    expect(purchases).toEqual([expect.objectContaining({ buyerId: id.plant, hubId: id.trade, category: 'coal', quantity: 4 })]);
  });

  test('with no coal in any warehouse the plant makes no energy this month, and takes nothing', async () => {
    const id = ids('trade', 'plant');
    const { repo, produce, purchases } = build([
      { id: id.trade, type: 'TradeWarehouse', x: 40, y: 0, stocks: { petrol: 10, goods: 10 } },
      { id: id.plant, type: 'CoalPlant', x: 0, y: 0, stocks: {} },
    ]);

    await produce.execute({ buildingId: id.plant, period: month(0) });

    expect(repo.raw.get(id.plant).stocks.energy ?? 0).toBe(0);
    expect(repo.raw.get(id.trade).stocks.petrol).toBe(10); // a coal plant leaves the petrol alone
    expect(purchases).toHaveLength(0);
  });

  test('a petrol plant burns petrol, 2 a month for the same energy', async () => {
    const id = ids('trade', 'plant');
    const { repo, produce } = build([
      { id: id.trade, type: 'TradeWarehouse', x: 40, y: 0, stocks: { petrol: 5, goods: 5 } },
      { id: id.plant, type: 'PetrolPlant', x: 0, y: 0, stocks: {} },
    ]);

    await produce.execute({ buildingId: id.plant, period: month(0) });

    expect(repo.raw.get(id.plant).stocks.energy).toBe(120);
    expect(repo.raw.get(id.trade).stocks.petrol).toBe(3);
  });
});

describe('Supply — a reservoir cannot overflow', () => {
  test('a plant already holding most of its ceiling makes only what fits, and burns only that share of its fuel', async () => {
    const id = ids('trade', 'plant');
    const { repo, produce } = build([
      { id: id.trade, type: 'TradeWarehouse', x: 40, y: 0, stocks: { coal: 10, goods: 10 } },
      { id: id.plant, type: 'CoalPlant', x: 0, y: 0, stocks: { energy: 90 } },
    ]);

    await produce.execute({ buildingId: id.plant, period: month(0) });

    expect(repo.raw.get(id.plant).stocks.energy).toBe(120); // the 30 MWh that fit under the ceiling
    expect(repo.raw.get(id.trade).stocks.coal).toBe(9); // 1 of the 4 coal (a quarter, rounded up)
  });

  test('a full tank or plant makes nothing and takes nothing', async () => {
    const id = ids('trade', 'plant');
    const { repo, produce, purchases } = build([
      { id: id.trade, type: 'TradeWarehouse', x: 40, y: 0, stocks: { coal: 10, goods: 10 } },
      { id: id.plant, type: 'CoalPlant', x: 0, y: 0, stocks: { energy: 120 } },
    ]);

    await produce.execute({ buildingId: id.plant, period: month(0) });

    expect(repo.raw.get(id.plant).stocks.energy).toBe(120);
    expect(repo.raw.get(id.trade).stocks.coal).toBe(10);
    expect(purchases).toHaveLength(0);
  });
});
