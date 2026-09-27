/**
 * Behavior tests — Supply: a house's own "Activité" business (decorating pots, baking cakes, writing books,
 * dealing goods) is a recipe like any workshop's, on the house itself. Real catalog (House-Red, House-Purple,
 * House-Blue, Warehouse); what is under test is the two things unique to these recipes: several simultaneous
 * inputs (the cake), and the "input-shortage" state a recipe shows while it cannot get what it needs.
 */

import { describe, test, expect } from '@jest/globals';
import { createSupplyBuildingSnapshot } from '../../../src/contexts/supply/domain/SupplyBuildingSnapshot.js';
import { createSupplyStock } from '../../../src/contexts/supply/domain/value-objects/SupplyStock.js';
import { hasResourceRole } from '../../../src/contexts/supply/domain/policies/ResourceRolePolicy.js';
import { getMaxStockForBuilding } from '../../../src/shared/building-catalog/resourceRoleQueries.js';
import { HubServing } from '../../../src/contexts/supply/application/services/HubServing.js';
import { ProduceResource } from '../../../src/contexts/supply/application/commands/harvest/ProduceResource.js';
import { resolveClientPriorities } from '../../../src/shared/building-catalog/clientQueries.js';
import { createBuildingInstanceId } from '../../../src/shared/building-identity/index.js';

class InMemoryRepository {
  constructor(buildings) {
    this.raw = new Map(buildings.map((b) => [b.id, { flags: {}, roadCount: 1, worker: 2, workerNeed: 2, ...b }]));
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
const month = (monthIndex) => ({ monthIndex, year: 1, dayInMonth: 1, month: 'x', season: 'spring', turn: monthIndex });

describe('Supply — a house running its own business', () => {
  test('the decorating business waits when the warehouse holds no pots, and resumes once one arrives', async () => {
    const id = ids('house', 'wh');
    const repo = new InMemoryRepository([
      { id: id.house, type: 'House-Red', x: 0, y: 0, pop: 4, stocks: {} },
      { id: id.wh, type: 'Warehouse', x: 3, y: 0, stocks: {} },
    ]);
    const produce = new ProduceResource(repo, { hubServing: new HubServing(repo) });

    await produce.execute({ buildingId: id.house, period: month(0) });
    expect((await repo.findById(id.house)).activityShortfall?.decoratedPot).toBe(true);

    repo.raw.get(id.wh).stocks = { pot: 10, goods: 10 };
    await produce.execute({ buildingId: id.house, period: month(1) });
    expect((await repo.findById(id.house)).stocks.decoratedPot).toBe(10);
    expect((await repo.findById(id.house)).activityShortfall?.decoratedPot).toBe(false);
  });

  test('the cake needs wheat, carrot and oil all at once: missing just the oil blocks the whole batch', async () => {
    // Wheat and carrot live at a windmill hub, oil at a warehouse — the SAME split as any citizen's meal and
    // lighting, and the recipe draws on both at once, each on its own.
    const id = ids('house', 'mill', 'wh');
    const repo = new InMemoryRepository([
      { id: id.house, type: 'House-Red', x: 0, y: 0, pop: 4, stocks: {} },
      { id: id.mill, type: 'Windmill-001', x: 3, y: 0, stocks: { wheat: 20, carrot: 20, food: 40 } },
      { id: id.wh, type: 'Warehouse', x: 6, y: 0, stocks: {} },
    ]);
    const produce = new ProduceResource(repo, { hubServing: new HubServing(repo) });

    await produce.execute({ buildingId: id.house, period: month(0) });
    expect((await repo.findById(id.mill)).stocks.wheat).toBe(20); // nothing taken: the oil was missing
    expect((await repo.findById(id.house)).activityShortfall?.carrotCake).toBe(true);

    repo.raw.get(id.wh).stocks = { oil: 10, goods: 10 };
    await produce.execute({ buildingId: id.house, period: month(1) });
    expect((await repo.findById(id.house)).stocks.carrotCake).toBe(10);
    expect((await repo.findById(id.mill)).stocks.wheat).toBe(16); // 4 wheat taken
    expect((await repo.findById(id.mill)).stocks.carrot).toBe(16); // 4 carrot taken
    expect((await repo.findById(id.wh)).stocks.oil).toBe(8); // 2 oil taken
  });

  test('households eat and light their homes first: the artisan business only ranks after the markets', () => {
    for (const producerType of ['Farm-Wheat', 'Farm-Carrot', 'Factory-Pot', 'Factory-Oil']) {
      const { order } = resolveClientPriorities(producerType);
      expect(order.indexOf('House-Red')).toBeGreaterThan(order.indexOf('Market-Stall'));
    }
  });

  test('only the merchants buy what the artisans and the savants make, straight from the catalog', () => {
    // Nobody references carrotCake anywhere yet: decoratedPot alone gives House-Red its one client.
    expect(resolveClientPriorities('House-Red').order).toEqual(['House-Blue']);
    expect(resolveClientPriorities('Factory-Network').order).toEqual(['House-Purple']);
  });
});
