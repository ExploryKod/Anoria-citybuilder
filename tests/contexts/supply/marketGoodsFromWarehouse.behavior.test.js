/**
 * Behavior tests — Supply: a market draws its diet from a windmill and its goods from a warehouse, purely
 * from the catalog's entries (a second 'distributor' entry with its own hub link).
 */

import { HubServing } from '../../../src/contexts/supply/application/services/HubServing.js';
import { describe, test, expect, beforeEach } from '@jest/globals';
import { createSupplyBuildingSnapshot } from '../../../src/contexts/supply/domain/SupplyBuildingSnapshot.js';
import { createSupplyStock } from '../../../src/contexts/supply/domain/value-objects/SupplyStock.js';
import { hasResourceRole, listRoleEntries } from '../../../src/contexts/supply/domain/policies/ResourceRolePolicy.js';
import { AssignDistributorToHub } from '../../../src/contexts/supply/application/commands/links/AssignDistributorToHub.js';
import { RebalanceHubAllocations } from '../../../src/contexts/supply/application/commands/links/RebalanceHubAllocations.js';
import { CascadeDestroyHubDistributors } from '../../../src/contexts/supply/application/commands/links/CascadeDestroyHubDistributors.js';
import { TransferHubToHub } from '../../../src/contexts/supply/application/commands/procurement/TransferHubToHub.js';

class InMemoryRepository {
  constructor(rows) {
    this.rows = new Map(rows.map((row) => [row.id, { roadCount: 1, worker: 1, workerNeed: 1, linkedDistributors: [], ...row }]));
  }

  async findById(id) {
    const row = this.rows.get(id);
    return row ? createSupplyBuildingSnapshot({ ...row, stocks: createSupplyStock(row.stocks) }) : null;
  }

  async findByResourceRole(role, categories) {
    return Promise.all([...this.rows.values()].filter((row) => hasResourceRole(row.type, role, categories)).map((row) => this.findById(row.id)));
  }

  async saveStocks(id, stocks) {
    const row = this.rows.get(id);
    row.stocks = { ...row.stocks, ...stocks };
  }

  async updateBuildingFields(id, fields) {
    Object.assign(this.rows.get(id), fields);
  }

  async saveHubLinkedDistributors(id, links) {
    this.rows.get(id).linkedDistributors = links;
  }

  async saveDistributorHubId(id, hubId, field) {
    this.rows.get(id)[field] = hubId;
  }
}

describe('Supply — a market with two distributor entries', () => {
  let repo;

  beforeEach(() => {
    repo = new InMemoryRepository([
      { id: 'mill', type: 'Windmill-001', x: 5, y: 3, stocks: { wheat: 40, food: 40 } },
      { id: 'warehouse', type: 'Warehouse', x: 8, y: 3, stocks: { plate: 10, pot: 10, wood: 10, goods: 30 } },
      { id: 'far-warehouse', type: 'Warehouse', x: 40, y: 40, stocks: {} },
      { id: 'stall', type: 'Market-Stall', x: 6, y: 3, stocks: { wheat: 5, food: 5 } },
    ]);
  });

  const assign = () => new AssignDistributorToHub(repo, new RebalanceHubAllocations(repo));

  test('each entry is linked to its own hub, in its own field, and only to a hub the catalog lets it use', async () => {
    const outcome = await assign().execute({ distributorId: 'stall', distributorType: 'Market-Stall', x: 6, y: 3 });

    expect(outcome.assigned).toBe(true);
    expect(repo.rows.get('stall').supplyHubId).toBe('mill');
    expect(repo.rows.get('stall').goodsHubId).toBe('warehouse'); // not the far one, not the windmill
  });

  test('a goods pull takes goods from the warehouse and leaves the diet of the stall untouched', async () => {
    await assign().execute({ distributorId: 'stall', distributorType: 'Market-Stall', x: 6, y: 3 });

    const outcome = await new TransferHubToHub(repo, new HubServing(repo)).execute({ targetId: 'stall', period: {}, demand: 8, category: 'plate' });

    expect(outcome.transferred).toBe(true);
    expect(outcome.totalUnits).toBe(8);
    expect(repo.rows.get('stall').stocks.goods).toBe(8);
    expect(repo.rows.get('stall').stocks.food).toBe(5);
    expect(repo.rows.get('stall').stocks.wood ?? 0).toBe(0); // the pull was for plates: wood is drawn separately, for heat
    expect(repo.rows.get('warehouse').stocks.goods).toBe(22);
  });

  test('a warehouse built after the market serves it too', async () => {
    repo.rows.get('warehouse').stocks = { plate: 10, goods: 10 };
    const late = new InMemoryRepository([...repo.rows.values()].filter((row) => row.id !== 'warehouse'));
    await new AssignDistributorToHub(late, new RebalanceHubAllocations(late)).execute({ distributorId: 'stall', distributorType: 'Market-Stall', x: 6, y: 3 });
    expect(late.rows.get('stall').goodsHubId ?? null).toBeNull();

    late.rows.set('warehouse', { id: 'warehouse', type: 'Warehouse', x: 8, y: 3, roadCount: 1, worker: 1, workerNeed: 1, linkedDistributors: [], stocks: { plate: 10, goods: 10 } });
    const { linked } = await new AssignDistributorToHub(late, new RebalanceHubAllocations(late)).linkWaitingDistributors({ hubId: 'warehouse' });

    // Every entry of the stall that may draw on a warehouse finds it, each in its own field.
    const drawsOnWarehouse = listRoleEntries('Market-Stall', 'distributor').filter((entry) => entry.hubLink?.hubTypes?.includes('Warehouse'));
    expect(drawsOnWarehouse.length).toBeGreaterThan(1);
    expect(linked).toBe(drawsOnWarehouse.length);
    for (const entry of drawsOnWarehouse) expect(late.rows.get('stall')[entry.hubLink.sourceLinkField]).toBe('warehouse');
  });

  test('only the hub a market cannot be placed without takes it down: demolishing the other just unlinks it', async () => {
    await assign().execute({ distributorId: 'stall', distributorType: 'Market-Stall', x: 6, y: 3 });
    const cascade = new CascadeDestroyHubDistributors(repo);

    expect((await cascade.findDependents({ hubId: 'mill' })).map((d) => d.distributorId)).toEqual(['stall']);
    expect(await cascade.findDependents({ hubId: 'warehouse' })).toEqual([]);

    const bulldozed = [];
    await cascade.execute({ hubId: 'warehouse', city: {}, bulldozeBuildingAtTile: async (at) => bulldozed.push(at) });
    expect(bulldozed).toEqual([]);
    expect(repo.rows.get('stall').goodsHubId).toBeNull();
    expect(repo.rows.get('stall').supplyHubId).toBe('mill');
  });
});
