/**
 * Behavior tests — Supply cleanup: map/windmill lists + flag commands
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { createSupplyBuildingSnapshot } from '../../../src/contexts/supply/domain/SupplyBuildingSnapshot.js';
import { createSupplyBuildingView } from '../../../src/contexts/supply/domain/SupplyBuildingView.js';
import { createFoodStock } from '../../../src/contexts/supply/domain/value-objects/FoodStock.js';
import { ListSupplyMapBuildings } from '../../../src/contexts/supply/application/queries/ListSupplyMapBuildings.js';
import { ListWindmillSupplyViews } from '../../../src/contexts/supply/application/queries/ListWindmillSupplyViews.js';
import { ListSupplyStockSnapshots } from '../../../src/contexts/supply/application/queries/ListSupplyStockSnapshots.js';
import { MarkWindmillCollectingSeason } from '../../../src/contexts/supply/application/commands/surplus/MarkWindmillCollectingSeason.js';
import { ResetFarmsSoldToWindmill } from '../../../src/contexts/supply/application/commands/surplus/ResetFarmsSoldToWindmill.js';
import { UpdateMarketFarmProximity } from '../../../src/contexts/supply/application/commands/procurement/UpdateMarketFarmProximity.js';
import { isWithinMarketRange } from '../../../src/composition/facades/supply.js';

class InMemorySupplyBuildingRepository {
  constructor({ snapshots = [], views = [] } = {}) {
    this.snapshots = new Map(snapshots.map((b) => [b.id, { ...b, stocks: { ...b.stocks } }]));
    this.views = new Map(views.map((v) => [v.id, v]));
    this.flags = new Map();
  }

  async findById(id) {
    const b = this.snapshots.get(id);
    return b ? { ...b, stocks: createFoodStock(b.stocks) } : null;
  }

  async findSupplyView(id) {
    const v = this.views.get(id);
    if (!v) return null;
    const flags = this.flags.get(id) || {};
    return createSupplyBuildingView({
      ...v,
      ...flags,
      stocks: v.stocks,
    });
  }

  async listAllSupplyViews() {
    const out = [];
    for (const id of this.views.keys()) {
      out.push(await this.findSupplyView(id));
    }
    return out.filter(Boolean);
  }

  async saveStocks() {}

  async saveMarketFlags(id, flags) {
    this.flags.set(id, { ...(this.flags.get(id) || {}), ...flags });
    const v = this.views.get(id);
    if (v) {
      this.views.set(id, createSupplyBuildingView({ ...v, ...this.flags.get(id) }));
    }
  }

  async findMarkets() {
    return [...this.snapshots.values()].filter((b) => b.type.includes('Market'));
  }

  async findHouses() {
    return [...this.snapshots.values()].filter((b) => b.type.includes('House'));
  }

  async findWindmills() {
    return [...this.snapshots.values()].filter(
      (b) => b.type.includes('Windmill') || b.type.includes('windmill')
    );
  }

  async findFarms() {
    return [...this.snapshots.values()].filter(
      (b) => b.type.includes('Farm') || b.type.includes('farm')
    );
  }
}

describe('Supply — cleanup queries and flag commands', () => {
  test('ACL exports isWithinMarketRange', () => {
    expect(isWithinMarketRange({ x: 0, y: 0 }, { x: 2, y: 2 }, 5)).toBe(true);
    expect(isWithinMarketRange({ x: 0, y: 0 }, { x: 5, y: 1 }, 5)).toBe(false);
  });

  test('ListSupplyMapBuildings exposes hasFood and marketTooFar', async () => {
    const repo = new InMemorySupplyBuildingRepository({
      views: [
        createSupplyBuildingView({
          id: 'House-Blue-1-1',
          type: 'House-Blue',
          x: 1,
          y: 1,
          stocks: { wheat: 0, food: 0 },
          marketTooFar: true,
          pop: 3,
        }),
        createSupplyBuildingView({
          id: 'Market-Stall-2-2',
          type: 'Market-Stall',
          x: 2,
          y: 2,
          stocks: { wheat: 5, food: 5 },
        }),
      ],
    });

    const cells = await new ListSupplyMapBuildings(repo).execute();
    const house = cells.find((c) => c.id === 'House-Blue-1-1');
    const market = cells.find((c) => c.id === 'Market-Stall-2-2');

    expect(house.kind).toBe('house');
    expect(house.hasFood).toBe(false);
    expect(house.marketTooFar).toBe(true);
    expect(house.pop).toBe(3);
    expect(market.hasFood).toBe(true);
    expect(market.marketTooFar).toBe(false);
  });

  test('ListSupplyStockSnapshots returns stocks, kind, and pop for all buildings', async () => {
    const repo = new InMemorySupplyBuildingRepository({
      views: [
        createSupplyBuildingView({
          id: 'House-Blue-1-1',
          type: 'House-Blue',
          x: 1,
          y: 1,
          stocks: { wheat: 2, carrot: 1, cabbage: 0, food: 3 },
          pop: 4,
        }),
        createSupplyBuildingView({
          id: 'Market-Stall-2-2',
          type: 'Market-Stall',
          x: 2,
          y: 2,
          stocks: { wheat: 8, food: 8 },
        }),
      ],
    });

    const list = await new ListSupplyStockSnapshots(repo).execute();
    expect(list).toHaveLength(2);

    const house = list.find((b) => b.id === 'House-Blue-1-1');
    expect(house.kind).toBe('house');
    expect(house.stocks.wheat).toBe(2);
    expect(house.stocks.food).toBe(3);
    expect(house.pop).toBe(4);
    expect(house.name).toBe('House-Blue-1-1');

    const market = list.find((b) => b.id === 'Market-Stall-2-2');
    expect(market.kind).toBe('market');
    expect(market.stocks.wheat).toBe(8);
  });

  test('ListWindmillSupplyViews returns windmills only', async () => {
    const repo = new InMemorySupplyBuildingRepository({
      views: [
        createSupplyBuildingView({
          id: 'Windmill-001-5-5',
          type: 'Windmill-001',
          stocks: { wheat: 10, food: 10, wood: 1 },
          maxStock: 1000,
          isCollecting: true,
        }),
        createSupplyBuildingView({
          id: 'House-Blue-1-1',
          type: 'House-Blue',
          stocks: { food: 0 },
        }),
      ],
    });

    const list = await new ListWindmillSupplyViews(repo).execute();
    expect(list).toHaveLength(1);
    expect(list[0].buildingId).toBe('Windmill-001-5-5');
    expect(list[0].stocks.wheat).toBe(10);
    expect(list[0].isCollecting).toBe(true);
  });

  test('MarkWindmillCollectingSeason sets isCollecting in december only', async () => {
    const mill = createSupplyBuildingSnapshot({
      id: 'Windmill-001-5-5',
      type: 'Windmill-001',
      stocks: { food: 0 },
      maxStock: 1000,
    });
    const repo = new InMemorySupplyBuildingRepository({
      snapshots: [mill],
      views: [
        createSupplyBuildingView({
          id: 'Windmill-001-5-5',
          type: 'Windmill-001',
          stocks: { food: 0 },
          isCollecting: false,
        }),
      ],
    });

    const cmd = new MarkWindmillCollectingSeason(repo);
    await cmd.execute('december');
    expect(repo.flags.get('Windmill-001-5-5').isCollecting).toBe(true);

    await cmd.execute('january');
    expect(repo.flags.get('Windmill-001-5-5').isCollecting).toBe(false);
  });

  test('ResetFarmsSoldToWindmill clears flags', async () => {
    const farm = createSupplyBuildingSnapshot({
      id: 'Farm-Wheat-1-1',
      type: 'Farm-Wheat',
      stocks: { wheat: 1, food: 1 },
    });
    const repo = new InMemorySupplyBuildingRepository({
      snapshots: [farm],
      views: [
        createSupplyBuildingView({
          id: 'Farm-Wheat-1-1',
          type: 'Farm-Wheat',
          stocks: { wheat: 1, food: 1 },
          soldToWindmill: true,
        }),
      ],
    });

    const outcome = await new ResetFarmsSoldToWindmill(repo).execute();
    expect(outcome.cleared).toBe(1);
    expect(repo.flags.get('Farm-Wheat-1-1').soldToWindmill).toBe(false);
  });

  test('UpdateMarketFarmProximity persists noFarmsNearby', async () => {
    const repo = new InMemorySupplyBuildingRepository({
      views: [
        createSupplyBuildingView({
          id: 'Market-Stall-5-5',
          type: 'Market-Stall',
          stocks: { food: 0 },
        }),
      ],
    });

    await new UpdateMarketFarmProximity(repo).execute({
      marketId: 'Market-Stall-5-5',
      hasFarmsNearby: false,
    });
    expect(repo.flags.get('Market-Stall-5-5').noFarmsNearby).toBe(true);
  });
});
