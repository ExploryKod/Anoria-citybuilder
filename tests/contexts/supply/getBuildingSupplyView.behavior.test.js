/**
 * Behavior tests — Supply: GetBuildingSupplyView (info panel read model)
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { createSupplyBuildingView } from '../../../src/contexts/supply/domain/SupplyBuildingView.js';
import { GetBuildingSupplyView } from '../../../src/contexts/supply/application/queries/GetBuildingSupplyView.js';

class InMemorySupplyBuildingRepository {
  constructor(views = []) {
    this.views = new Map(views.map((v) => [v.id, v]));
  }

  async findById() {
    return null;
  }

  async findSupplyView(id) {
    return this.views.get(id) ?? null;
  }

  async saveStocks() {}
  async saveMarketFlags() {}
  async findMarkets() {
    return [];
  }
  async findHouses() {
    return [];
  }
}

describe('Supply — GetBuildingSupplyView', () => {
  let useCase;

  beforeEach(() => {
    const repo = new InMemorySupplyBuildingRepository([
      createSupplyBuildingView({
        id: 'Market-Stall-5-5',
        type: 'Market-Stall',
        stocks: { wheat: 10, food: 10 },
        maxStock: 500,
        isBuying: true,
        noFarmsNearby: false,
        neighbors: [
          { name: 'House-Blue', type: 'House-Blue', x: 5, y: 6 },
          { name: 'Farm-Wheat', type: 'Farm-Wheat', x: 4, y: 5 },
        ],
      }),
      createSupplyBuildingView({
        id: 'House-Blue-0-0',
        type: 'House-Blue',
        stocks: { wheat: 2, food: 2 },
        marketTooFar: true,
      }),
      createSupplyBuildingView({
        id: 'Farm-Wheat-3-3',
        type: 'Farm-Wheat',
        stocks: { wheat: 5, food: 5 },
        salesToMarket: [{ year: 1, productType: 'wheat', quantity: 3 }],
        salesToWindmill: [],
      }),
      createSupplyBuildingView({
        id: 'Windmill-001-8-8',
        type: 'Windmill-001',
        stocks: { wheat: 20, food: 20, wood: 1 },
        maxStock: 1000,
        isCollecting: true,
        lastCollection: { wheat: 20, total: 20 },
      }),
    ]);
    useCase = new GetBuildingSupplyView(repo);
  });

  test('returns null for missing building', async () => {
    expect(await useCase.execute('missing')).toBeNull();
    expect(await useCase.execute('')).toBeNull();
  });

  test('market view exposes buying flags and neighbor houses', async () => {
    const dto = await useCase.execute('Market-Stall-5-5');
    expect(dto.kind).toBe('market');
    expect(dto.isBuying).toBe(true);
    expect(dto.noFarmsNearby).toBe(false);
    expect(dto.hasHousesNearby).toBe(true);
    expect(dto.stocks.wheat).toBe(10);
    expect(dto.maxStock).toBe(500);
  });

  test('market without house neighbors has hasHousesNearby false', async () => {
    const repo = new InMemorySupplyBuildingRepository([
      createSupplyBuildingView({
        id: 'Market-Stall-1-1',
        type: 'Market-Stall',
        stocks: { food: 0 },
        neighbors: [{ name: 'Farm-Wheat', type: 'Farm-Wheat', x: 1, y: 2 }],
      }),
    ]);
    const dto = await new GetBuildingSupplyView(repo).execute('Market-Stall-1-1');
    expect(dto.hasHousesNearby).toBe(false);
  });

  test('house view exposes stocks and marketTooFar', async () => {
    const dto = await useCase.execute('House-Blue-0-0');
    expect(dto.kind).toBe('house');
    expect(dto.marketTooFar).toBe(true);
    expect(dto.stocks.food).toBe(2);
  });

  test('farm view exposes sales history', async () => {
    const dto = await useCase.execute('Farm-Wheat-3-3');
    expect(dto.kind).toBe('farm');
    expect(dto.salesToMarket).toHaveLength(1);
    expect(dto.salesToMarket[0].quantity).toBe(3);
  });

  test('windmill view exposes collecting state and lastCollection', async () => {
    const dto = await useCase.execute('Windmill-001-8-8');
    expect(dto.kind).toBe('windmill');
    expect(dto.isCollecting).toBe(true);
    expect(dto.lastCollection.wheat).toBe(20);
    expect(dto.stocks.wood).toBe(1);
    expect(dto.maxStock).toBe(1000);
  });
});
