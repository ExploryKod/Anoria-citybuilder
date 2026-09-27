/**
 * Behavior tests — Supply: a hub serves its clients in the order the producer type asks for, and an
 * unserved client is left out.
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { createSupplyBuildingSnapshot } from '../../../src/contexts/supply/domain/SupplyBuildingSnapshot.js';
import { createSupplyStock } from '../../../src/contexts/supply/domain/value-objects/SupplyStock.js';
import { HubServing } from '../../../src/contexts/supply/application/services/HubServing.js';
import { TransferHubToHub } from '../../../src/contexts/supply/application/commands/procurement/TransferHubToHub.js';
import { resolveClientPriorities } from '../../../src/shared/building-catalog/clientQueries.js';

class InMemoryRepository {
  constructor(rows) {
    this.rows = new Map(rows.map((row) => [row.id, { roadCount: 1, worker: 1, workerNeed: 1, linkedDistributors: [], ...row }]));
  }

  async findById(id) {
    const row = this.rows.get(id);
    return row ? createSupplyBuildingSnapshot({ ...row, stocks: createSupplyStock(row.stocks) }) : null;
  }

  async saveStocks(id, stocks) {
    const row = this.rows.get(id);
    row.stocks = { ...row.stocks, ...stocks };
  }

  async updateBuildingFields(id, fields) {
    Object.assign(this.rows.get(id), fields);
  }
}

describe('Supply — a hub serves its clients by priority', () => {
  let repo;
  let settings;

  beforeEach(() => {
    settings = {};
    repo = new InMemoryRepository([
      {
        id: 'warehouse', type: 'Warehouse', x: 8, y: 3,
        stocks: { plate: 10, goods: 10 },
        lots: { plate: { 'Factory-Plate': 10 } },
        linkedDistributors: [{ distributorId: 'first', x: 6, y: 3, allocatedStocks: {} }, { distributorId: 'second', x: 7, y: 3, allocatedStocks: {} }],
      },
      { id: 'first', type: 'Market-Stall-Red', x: 6, y: 3, stocks: {}, goodsHubId: 'warehouse' },
      { id: 'second', type: 'Market-Stall', x: 7, y: 3, stocks: {}, goodsHubId: 'warehouse' },
    ]);
  });

  const serving = () => new HubServing(repo, { loadSettings: () => settings });
  const pull = (targetId, demand, turn) =>
    new TransferHubToHub(repo, serving()).execute({ targetId, period: { turn }, demand, category: 'plate' });

  test('the catalog\'s default order is used until the player saves one', () => {
    expect(resolveClientPriorities('Factory-Plate').order.length).toBeGreaterThan(1);
    expect(resolveClientPriorities('Factory-Plate', { order: ['Market-Stall-Red'], disabled: [] }).order[0]).toBe('Market-Stall-Red');
  });

  test('a client ranked first keeps what it needs; the next one only gets the rest', async () => {
    settings = { 'Factory-Plate': { order: ['Market-Stall-Red', 'Market-Stall'], disabled: [] } };
    await serving().recordDemand({ hubId: 'warehouse', category: 'plate', client: 'Market-Stall-Red', turn: 6, wanted: 8, served: 0 });

    const outcome = await pull('second', 10, 6);

    expect(outcome.totalUnits).toBe(2);
    expect(repo.rows.get('warehouse').lots.plate['Factory-Plate']).toBe(8);
  });

  test('ranked first itself, the same client takes it all', async () => {
    settings = { 'Factory-Plate': { order: ['Market-Stall', 'Market-Stall-Red'], disabled: [] } };
    await serving().recordDemand({ hubId: 'warehouse', category: 'plate', client: 'Market-Stall-Red', turn: 6, wanted: 8, served: 0 });

    expect((await pull('second', 10, 6)).totalUnits).toBe(10);
  });

  test('a client the producer type does not serve gets nothing, however much is in stock', async () => {
    settings = { 'Factory-Plate': { order: ['Market-Stall-Red', 'Market-Stall'], disabled: ['Market-Stall'] } };

    const outcome = await pull('second', 10, 6);

    expect(outcome.transferred).toBe(false);
    expect(repo.rows.get('warehouse').stocks.plate).toBe(10);
  });

  test('the two lumberjacks serve the same clients in a different order, from the catalog alone', () => {
    const household = resolveClientPriorities('Lumberjack').order;
    const industrial = resolveClientPriorities('Lumberjack-Industry').order;
    expect([...household].sort()).toEqual([...industrial].sort());
    expect(household[0]).toBe('Market-Stall');
    expect(industrial[0]).toBe('Factory-Furniture');
    expect(household).toContain('Factory-Furniture');
  });

  test('a market draws wood for heat, and the warehouse files it under its own total', async () => {
    repo.rows.get('warehouse').stocks = { wood: 10, goods: 10 };
    repo.rows.get('warehouse').lots = { wood: { Lumberjack: 10 } };
    repo.rows.get('second').heatHubId = 'warehouse';

    const outcome = await new TransferHubToHub(repo, serving()).execute({ targetId: 'second', period: { turn: 1 }, demand: 4, category: 'wood' });

    expect(outcome.totalUnits).toBe(4);
    expect(repo.rows.get('second').stocks.heat).toBe(4);
    expect(repo.rows.get('warehouse').stocks.goods).toBe(6);
    expect(repo.rows.get('warehouse').stocks.heat ?? 0).toBe(0);
  });

  test('the olive grove is bought by the oil press alone; its oil by the markets — all read from the catalog', () => {
    expect(resolveClientPriorities('Farm-Olive').order).toEqual(['Factory-Oil']);
    expect(resolveClientPriorities('Factory-Oil').order).toEqual(expect.arrayContaining(['Market-Stall', 'Market-Stall-Blue', 'Market-Stall-Red']));
    expect(resolveClientPriorities('Factory-Oil').order).not.toContain('Factory-Oil');
  });

  test('goods moved through another hub are still served in the order of the producer type that made them', async () => {
    settings = { 'Factory-Plate': { order: ['Market-Stall-Red', 'Market-Stall'], disabled: ['Market-Stall'] } };
    repo.rows.get('warehouse').lots = { plate: { 'Factory-Plate|Warehouse': 10 } };

    expect((await pull('second', 10, 6)).transferred).toBe(false); // Market-Stall is not served plates from that producer, moved or not
    expect((await pull('first', 10, 6)).totalUnits).toBe(10);
  });
});
