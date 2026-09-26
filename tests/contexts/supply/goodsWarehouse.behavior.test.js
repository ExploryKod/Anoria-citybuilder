/**
 * Behavior tests — Supply: a goods warehouse is a hub like the windmill, but the catalog says what it
 * accepts, how far it reaches and when it collects. Real catalog (Warehouse, Lumberjack, Windmill-001,
 * Factory-Furniture); what is under test is that two hubs coexist and that a recipe draws from one.
 */

import { HubServing } from '../../../src/contexts/supply/application/services/HubServing.js';
import { describe, test, expect } from '@jest/globals';
import { createSupplyBuildingSnapshot } from '../../../src/contexts/supply/domain/SupplyBuildingSnapshot.js';
import { createSupplyStock } from '../../../src/contexts/supply/domain/value-objects/SupplyStock.js';
import { hasResourceRole } from '../../../src/contexts/supply/domain/policies/ResourceRolePolicy.js';
import { getMaxStockForBuilding } from '../../../src/shared/building-catalog/resourceRoleQueries.js';
import { CollectResourceToHub } from '../../../src/contexts/supply/application/commands/surplus/CollectResourceToHub.js';
import { SetHubCollectingFlag } from '../../../src/contexts/supply/application/commands/surplus/SetHubCollectingFlag.js';
import { MarkSourceCollectedByHub } from '../../../src/contexts/supply/application/commands/surplus/MarkSourceCollectedByHub.js';
import { MarkHubCollectingSchedule } from '../../../src/contexts/supply/application/commands/surplus/MarkHubCollectingSchedule.js';
import { ResetSourcesCollectedFlag } from '../../../src/contexts/supply/application/commands/surplus/ResetSourcesCollectedFlag.js';
import { ProcessHubCollection } from '../../../src/contexts/supply/application/commands/surplus/ProcessHubCollection.js';
import { RunHubSurplusCycle } from '../../../src/contexts/supply/application/commands/surplus/RunHubSurplusCycle.js';
import { EmptyHubGoods } from '../../../src/contexts/supply/application/commands/surplus/EmptyHubGoods.js';
import { createBuildingInstanceId } from '../../../src/shared/building-identity/index.js';
import { ProduceResource } from '../../../src/contexts/supply/application/commands/harvest/ProduceResource.js';

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

  async findSupplyView(id) {
    const b = this.raw.get(id);
    return b && { id, collectedByHub: b.flags.collectedByHub === true, isCollecting: b.flags.isCollecting === true };
  }

  async findByResourceRole(role, categories) {
    return [...this.raw.values()].filter((b) => hasResourceRole(b.type, role, categories)).map((b) => this.#snapshot(b));
  }

  async saveStocks(id, stocks) {
    this.raw.get(id).stocks = { ...createSupplyStock(stocks) };
  }

  async saveSupplyFlags(id, flags) {
    const b = this.raw.get(id);
    b.flags = { ...b.flags, ...flags };
  }

  async updateBuildingFields(id, fields) {
    Object.assign(this.raw.get(id), fields);
  }

  async saveHubLastCollection(id, lastCollection) {
    this.raw.get(id).lastCollection = lastCollection;
  }

  async recordSourceSaleToHub() {}

  async resetSourceSalesForYear() {}
}

function cycleOver(repo) {
  const process = new ProcessHubCollection(
    repo,
    new CollectResourceToHub(repo, new HubServing(repo)),
    new SetHubCollectingFlag(repo),
    new MarkSourceCollectedByHub(repo)
  );
  return new RunHubSurplusCycle(repo, new MarkHubCollectingSchedule(repo), new ResetSourcesCollectedFlag(repo), process);
}

const ids = (...names) => Object.fromEntries(names.map((name) => [name, createBuildingInstanceId()]));

describe('Supply — goods warehouse', () => {
  test('collects the goods of producers in range all year, while the windmill waits for its own month', async () => {
    const id = ids('wh', 'near', 'far', 'mill', 'farm');
    const repo = new InMemoryRepository([
      { id: id.wh, type: 'Warehouse', x: 0, y: 0, stocks: {} },
      { id: id.near, type: 'Lumberjack', x: 5, y: 0, stocks: { wood: 10 } },
      { id: id.far, type: 'Lumberjack', x: 40, y: 0, stocks: { wood: 10 } },
      { id: id.mill, type: 'Windmill-001', x: 20, y: 20, stocks: {} },
      { id: id.farm, type: 'Farm-Wheat', x: 21, y: 20, stocks: { wheat: 50, food: 50 } },
    ]);

    // July: not the windmill's month.
    await cycleOver(repo).execute({ month: 'july', monthIndex: 6, dayInMonth: 5, year: 1 });

    expect(repo.raw.get(id.wh).stocks.wood).toBe(10);
    expect(repo.raw.get(id.near).stocks.wood).toBe(0);
    expect(repo.raw.get(id.far).stocks.wood).toBe(10); // beyond the warehouse's range
    expect(repo.raw.get(id.mill).stocks.wheat ?? 0).toBe(0);
    expect(repo.raw.get(id.farm).stocks.wheat).toBe(50);
    expect(repo.raw.get(id.mill).flags.isCollecting).toBe(false);
  });

  test('a workshop draws its wood from a warehouse in range for its first step, and idles when there is none', async () => {
    const id = ids('wh', 'shop', 'lonely');
    const repo = new InMemoryRepository([
      { id: id.wh, type: 'Warehouse', x: 0, y: 0, stocks: { wood: 25, goods: 25 } },
      { id: id.shop, type: 'Factory-Furniture', x: 3, y: 3, stocks: {} },
      { id: id.lonely, type: 'Factory-Furniture', x: 50, y: 50, stocks: {} },
    ]);
    const produce = new ProduceResource(repo, { hubServing: new HubServing(repo) });
    const day = (monthIndex) => ({ season: 'spring', month: 'january', monthIndex, year: 1, dayInMonth: 1 });

    await produce.execute({ buildingId: id.shop, period: day(0) });
    expect(repo.raw.get(id.wh).stocks.wood).toBe(15);

    const made = await produce.execute({ buildingId: id.shop, period: day(1) });
    expect(made.produced).toBe(true);
    expect(repo.raw.get(id.shop).stocks.furniture).toBe(10);

    // Too far from any warehouse: nothing to cut, so nothing moves and nothing is taken.
    await produce.execute({ buildingId: id.lonely, period: day(0) });
    const out = await produce.execute({ buildingId: id.lonely, period: day(1) });
    expect(out.produced).toBe(false);
    expect(repo.raw.get(id.wh).stocks.wood).toBe(15);
  });

  test('a producer with a sale window is only collected inside it', async () => {
    const id = ids('wh', 'pots');
    const repo = new InMemoryRepository([
      { id: id.wh, type: 'Warehouse', x: 0, y: 0, stocks: {} },
      { id: id.pots, type: 'Factory-Pot', x: 4, y: 0, stocks: { pot: 10 } },
    ]);

    // Even month: the workshop's cycle is not complete, its window is closed.
    await cycleOver(repo).execute({ month: 'january', monthIndex: 0, dayInMonth: 5, year: 1 });
    expect(repo.raw.get(id.wh).stocks.pot ?? 0).toBe(0);

    // Odd month: window open, the hub takes it and the producer shows it was collected.
    await cycleOver(repo).execute({ month: 'february', monthIndex: 1, dayInMonth: 5, year: 1 });
    expect(repo.raw.get(id.wh).stocks.pot).toBe(10);
    expect(repo.raw.get(id.pots).flags.collectedByHub).toBe(true);

    // The window closes: the flag goes with it.
    await cycleOver(repo).execute({ month: 'march', monthIndex: 2, dayInMonth: 5, year: 1 });
    expect(repo.raw.get(id.pots).flags.collectedByHub).toBe(false);
  });

  test('an oil press lives off the olives sold in one go: it presses while they last, then stops until more arrive', async () => {
    const id = ids('wh', 'press');
    const repo = new InMemoryRepository([
      { id: id.wh, type: 'Warehouse', x: 0, y: 0, stocks: { olive: 20, goods: 20 } },
      { id: id.press, type: 'Factory-Oil', x: 3, y: 3, stocks: {} },
    ]);
    const produce = new ProduceResource(repo, { hubServing: new HubServing(repo) });
    const month = (monthIndex) => ({ season: 'spring', month: 'january', monthIndex, year: 1, dayInMonth: 1 });
    const run = async (from, to) => {
      for (let monthIndex = from; monthIndex <= to; monthIndex += 1) {
        await produce.execute({ buildingId: id.press, period: month(monthIndex) });
      }
    };

    await run(0, 3); // two cycles: 10 olives each
    expect(repo.raw.get(id.press).stocks.oil).toBe(20);
    expect(repo.raw.get(id.wh).stocks.olive).toBe(0);

    await run(4, 5); // no olives left: nothing is pressed, nothing is made
    expect(repo.raw.get(id.press).stocks.oil).toBe(20);

    repo.raw.get(id.wh).stocks = { olive: 10, goods: 10 }; // a new harvest is sold
    await run(6, 7);
    expect(repo.raw.get(id.press).stocks.oil).toBe(30);
  });

  describe('storage orders decide where goods go', () => {
    const inOddMonth = { month: 'february', monthIndex: 1, dayInMonth: 5, year: 1 };
    const fetchPots = { pot: { mode: 'fetch', maxPercent: 100 } };
    const orderFor = (mode) => ({ pot: { mode, maxPercent: 100 } });

    test('a producer sells to the hub ordered to "fetch" its goods, not to the nearer one', async () => {
      const id = ids('near', 'far', 'pots');
      const repo = new InMemoryRepository([
        { id: id.near, type: 'Warehouse', x: 0, y: 0, stocks: {} },
        { id: id.far, type: 'Warehouse', x: 16, y: 0, stocks: {}, hubStorageOrders: fetchPots },
        { id: id.pots, type: 'Factory-Pot', x: 5, y: 0, stocks: { pot: 10 } },
      ]);
      await cycleOver(repo).execute(inOddMonth);
      expect(repo.raw.get(id.far).stocks.pot).toBe(10);
      expect(repo.raw.get(id.near).stocks.pot ?? 0).toBe(0);
    });

    test('a hub that refuses a good is not sold it: the goods go to the next hub', async () => {
      const id = ids('near', 'far', 'pots');
      const repo = new InMemoryRepository([
        { id: id.near, type: 'Warehouse', x: 0, y: 0, stocks: {}, hubStorageOrders: orderFor('refuse') },
        { id: id.far, type: 'Warehouse', x: 16, y: 0, stocks: {} },
        { id: id.pots, type: 'Factory-Pot', x: 5, y: 0, stocks: { pot: 10 } },
      ]);
      await cycleOver(repo).execute(inOddMonth);
      expect(repo.raw.get(id.near).stocks.pot ?? 0).toBe(0);
      expect(repo.raw.get(id.far).stocks.pot).toBe(10);
    });

    test('what a nearly full hub cannot take goes to the next hub in the same pass', async () => {
      const id = ids('near', 'far', 'pots');
      const repo = new InMemoryRepository([
        { id: id.near, type: 'Warehouse', x: 0, y: 0, stocks: { goods: 496, wood: 496 } },
        { id: id.far, type: 'Warehouse', x: 16, y: 0, stocks: {} },
        { id: id.pots, type: 'Factory-Pot', x: 5, y: 0, stocks: { pot: 10 } },
      ]);
      await cycleOver(repo).execute(inOddMonth);
      expect(repo.raw.get(id.near).stocks.pot).toBe(4);
      expect(repo.raw.get(id.far).stocks.pot).toBe(6);
    });

    test('a hub ordered to empty a good gives it away a little each tick, with where it came from, and says when it cannot', async () => {
      const id = ids('source', 'target');
      const repo = new InMemoryRepository([
        { id: id.source, type: 'Warehouse', x: 0, y: 0, stocks: { pot: 50, goods: 50 }, lots: { pot: { 'Factory-Pot': 50 } }, hubStorageOrders: orderFor('empty') },
        { id: id.target, type: 'Warehouse', x: 4, y: 0, stocks: {} },
      ]);
      const empty = new EmptyHubGoods(repo, new HubServing(repo));

      await empty.execute();
      expect(repo.raw.get(id.source).stocks.pot).toBe(30); // one tick's worth: the catalog's emptyRate
      expect(repo.raw.get(id.target).stocks.pot).toBe(20);
      expect(repo.raw.get(id.target).stocks.goods).toBe(20);
      expect(repo.raw.get(id.target).lots.pot).toEqual({ 'Factory-Pot': 20 });
      expect(repo.raw.get(id.source).hubEmptying).toEqual({ pot: 'moving' });

      repo.raw.get(id.target).hubStorageOrders = orderFor('refuse'); // nobody can take it any more
      await empty.execute();
      expect(repo.raw.get(id.source).stocks.pot).toBe(30); // nothing lost, nothing moved
      expect(repo.raw.get(id.source).hubEmptying).toEqual({ pot: 'blocked' });
    });
  });
});
