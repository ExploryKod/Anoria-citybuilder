/**
 * Behavior tests — Supply: GetBuildingSupplyView (info panel read model)
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import { createSupplyBuildingView } from '../../../src/contexts/supply/domain/SupplyBuildingView.js';
import { createSupplyBuildingSnapshot } from '../../../src/contexts/supply/domain/SupplyBuildingSnapshot.js';
import { GetHubStorageInfoView } from '../../../src/contexts/supply/application/queries/GetHubStorageInfoView.js';
import { GetBuildingSupplyView, classifySupplyKind } from '../../../src/contexts/supply/application/queries/GetBuildingSupplyView.js';

class InMemorySupplyBuildingRepository {
  constructor(views = [], snapshots = {}) {
    this.views = new Map(views.map((v) => [v.id, v]));
    this.snapshots = new Map(Object.entries(snapshots));
  }

  async findById(id) {
    return this.snapshots.get(id) ?? null;
  }

  async findSupplyView(id) {
    return this.views.get(id) ?? null;
  }

  async saveStocks() {}
  async saveSupplyFlags() {}
}

describe('Supply — GetBuildingSupplyView', () => {
  let useCase;

  beforeEach(() => {
    const repo = new InMemorySupplyBuildingRepository(
      [
      createSupplyBuildingView({
        id: 'Market-Stall-5-5',
        type: 'Market-Stall',
        stocks: { wheat: 10, food: 10 },
        maxStock: 500,
        isBuying: true,
        noSourcesNearby: false,
        neighbors: [
          { name: 'House-Blue', type: 'House-Blue', x: 5, y: 6 },
          { name: 'Farm-Wheat', type: 'Farm-Wheat', x: 4, y: 5 },
        ],
      }),
      createSupplyBuildingView({
        id: 'House-Blue-0-0',
        type: 'House-Blue',
        stocks: { wheat: 2, food: 2 },
        distributorTooFar: true,
      }),
      createSupplyBuildingView({
        id: 'Farm-Wheat-3-3',
        type: 'Farm-Wheat',
        stocks: { wheat: 5, food: 5 },
        salesToDistributor: [{ year: 1, productType: 'wheat', quantity: 3 }],
        salesToHub: [],
      }),
      createSupplyBuildingView({
        id: 'Windmill-001-8-8',
        type: 'Windmill-001',
        stocks: { wheat: 20, food: 20, wood: 1 },
        maxStock: 1000,
        isCollecting: true,
        lastCollection: { wheat: 20, total: 20 },
      }),
      ],
      {
        'Market-Stall-5-5': createSupplyBuildingSnapshot({
          id: 'Market-Stall-5-5',
          type: 'Market-Stall',
          roadCount: 1,
          worker: 2,
          workerNeed: 2,
        }),
        'Windmill-001-8-8': createSupplyBuildingSnapshot({
          id: 'Windmill-001-8-8',
          type: 'Windmill-001',
          roadCount: 1,
          worker: 4,
          workerNeed: 4,
        }),
      }
    );
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
    // A good the catalog does not declare is not carried through the view.
    expect(dto.stocks.wood).toBeUndefined();
    expect(dto.maxStock).toBe(1000);
  });

  test('isBuying and isCollecting hidden when building is not operational', async () => {
    const repo = new InMemorySupplyBuildingRepository(
      [
        createSupplyBuildingView({
          id: 'Market-Stall-1-1',
          type: 'Market-Stall',
          stocks: { food: 0 },
          isBuying: true,
        }),
        createSupplyBuildingView({
          id: 'Windmill-001-1-1',
          type: 'Windmill-001',
          stocks: { food: 0 },
          isCollecting: true,
        }),
      ],
      {
        'Market-Stall-1-1': createSupplyBuildingSnapshot({
          id: 'Market-Stall-1-1',
          type: 'Market-Stall',
          roadCount: 1,
          worker: 0,
          workerNeed: 2,
        }),
        'Windmill-001-1-1': createSupplyBuildingSnapshot({
          id: 'Windmill-001-1-1',
          type: 'Windmill-001',
          roadCount: 1,
          worker: 0,
          workerNeed: 4,
        }),
      }
    );
    const query = new GetBuildingSupplyView(repo);
    expect((await query.execute('Market-Stall-1-1')).isBuying).toBe(false);
    expect((await query.execute('Windmill-001-1-1')).isCollecting).toBe(false);
  });

  describe('classifySupplyKind — flag-distributor services vs quantity-distributor markets', () => {
    test('a quantity distributor (sells a depleting stock) classifies as market', () => {
      expect(classifySupplyKind('Market-Stall')).toBe('market');
      expect(classifySupplyKind('Market-Stall-Red')).toBe('market');
    });

    test('a flag distributor (marks houses "served", no stock) classifies as service, not market', () => {
      // The bug this pins: Chapel and every other flag-mode public service
      // building used to fall into 'market' (any 'distributor' role, no
      // consumption-mode check) and rendered Market-Stall's copy/tabs.
      expect(classifySupplyKind('Chapel')).toBe('service');
      expect(classifySupplyKind('School')).toBe('service');
      expect(classifySupplyKind('Library')).toBe('service');
      expect(classifySupplyKind('Doctor')).toBe('service');
      expect(classifySupplyKind('Hospital')).toBe('service');
      expect(classifySupplyKind('PublicBath')).toBe('service');
      expect(classifySupplyKind('Theatre')).toBe('service');
      expect(classifySupplyKind('Cinema')).toBe('service');
      expect(classifySupplyKind('Pub')).toBe('service');
    });
  });

  test('Chapel view classifies as service (not market) via the real repository path', async () => {
    const repo = new InMemorySupplyBuildingRepository(
      [
        createSupplyBuildingView({
          id: 'Chapel-1-1',
          type: 'Chapel',
          stocks: {},
        }),
      ],
      {
        'Chapel-1-1': createSupplyBuildingSnapshot({
          id: 'Chapel-1-1',
          type: 'Chapel',
          roadCount: 1,
          worker: 2,
          workerNeed: 2,
        }),
      },
    );
    const dto = await new GetBuildingSupplyView(repo).execute('Chapel-1-1');
    expect(dto.kind).toBe('service');
    expect(dto.isBuying).toBeUndefined();
  });
});

describe('Supply — GetHubStorageInfoView: report and autonomy of a hub', () => {
  const hubRow = (extra) => ({
    type: 'Windmill-001',
    stocks: { wheat: 1450, food: 1450 },
    employees: { worker: 4, worker_need: 4 },
    ...extra,
  });
  const view = (row, options = {}) => new GetHubStorageInfoView().execute({ hubKind: 'windmill', buildingRow: row, ...options });

  test('exposes what is left from before the last harvest', () => {
    // 10 held before the harvest; the hub holds 1450 now, the harvest (1440) is not carry-over.
    const dto = view(hubRow({ carryOver: { year: 1, stocks: { wheat: 10 }, harvested: { wheat: 1440 } } }));
    expect(dto.carryOverTotal).toBe(10);
    expect(dto.lines.find((line) => line.productId === 'wheat').carryOver).toBe(10);
  });

  test('a stock with no recorded carry-over reports none — the whole stock is not carry-over', () => {
    const dto = view(hubRow({ lastCollection: { wheat: 0, food: 0 } }));
    expect(dto.carryOverTotal).toBe(0);
  });

  test('exposes how many months the stock lasts at last month\'s pace', () => {
    const dto = view(hubRow({ lastOutflow: { year: 1, monthIndex: 4, units: 110 } }));
    expect(dto.autonomyMonths).toBe(13);
  });

  test('has no autonomy while nothing has left the hub', () => {
    expect(view(hubRow({})).autonomyMonths).toBeNull();
  });

  test('says in how many months the hub next collects, from the calendar it is given', () => {
    const contextAhead = (monthsAhead) => ({ month: ['october', 'november', 'december'][monthsAhead] ?? 'january' });
    expect(view(hubRow({}), { timeContextAhead: contextAhead }).harvestInMonths).toBe(2);
  });

  test('has no harvest date when no calendar is given', () => {
    expect(view(hubRow({})).harvestInMonths).toBeNull();
  });
});

