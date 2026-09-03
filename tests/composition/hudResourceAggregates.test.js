import { describe, expect, test, beforeEach } from '@jest/globals';
import 'fake-indexeddb/auto';
import db from '../../src/core/persistence/dexie/db.js';
import { setActiveHamletId, DEFAULT_HAMLET_ID } from '../../src/core/persistence/hamlet/hamletSession.js';
import {
  getHudResourceScopeSnapshot,
  getHudNatureResourceScopeSnapshot,
  sumCityStocksFromRows,
  sumNatureStocksFromRows,
  countClayTiles,
} from '../../src/composition/hudResourceAggregates.js';

describe('hudResourceAggregates', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
    setActiveHamletId(DEFAULT_HAMLET_ID);
  });

  test('city food comes from windmill stocks only', () => {
    const rows = [
      {
        type: 'Windmill-001',
        stocks: { wheat: 10, carrot: 4, cabbage: 2, food: 16, wood: 3 },
      },
      {
        type: 'House-Blue',
        stocks: { wheat: 99 },
      },
    ];

    expect(sumCityStocksFromRows(rows)).toEqual({
      wheat: 10,
      carrot: 4,
      cabbage: 2,
    });
  });

  test('country scope aggregates all hamlets; active scope only the visible one', async () => {
    await db.houses.bulkPut([
      {
        instanceId: '11111111-1111-4111-8111-111111111111',
        hamletId: 'eraanurbs',
        type: 'Windmill-001',
        x: 1,
        y: 1,
        stocks: { wheat: 5, carrot: 0, cabbage: 0, food: 5 },
      },
      {
        instanceId: '22222222-2222-4222-8222-222222222222',
        hamletId: 'clairiere',
        type: 'Windmill-001',
        x: 2,
        y: 2,
        stocks: { wheat: 3, carrot: 1, cabbage: 0, food: 4 },
      },
    ]);

    const country = await getHudResourceScopeSnapshot('country');
    const active = await getHudResourceScopeSnapshot('active');

    expect(country.city).toEqual({ wheat: 8, carrot: 1, cabbage: 0 });
    expect(country.cityTotal).toBe(9);

    expect(active.city).toEqual({ wheat: 5, carrot: 0, cabbage: 0 });
    expect(active.cityTotal).toBe(5);
  });

  test('nature deposits sum wood/rock/iron/gold; clay from tiles', () => {
    const rows = [
      { category: 'nature', type: 'Tree-Sapin', stocks: { wood: 100 } },
      { category: 'nature', type: 'Tree-Chene', stocks: { wood: 40 } },
      { category: 'nature', type: 'Boulder-001', stocks: { rock: 20, iron: 5, gold: 1 } },
      { category: 'nature', type: 'Boulder-001', stocks: { rock: 8, iron: 0, gold: 2 } },
      { category: 'house', type: 'House-Blue', stocks: { wood: 999 } },
    ];
    expect(sumNatureStocksFromRows(rows)).toEqual({
      wood: 140,
      rock: 28,
      clay: 0,
      iron: 5,
      gold: 3,
    });

    const city = {
      size: 2,
      tiles: [
        [{ hasClay: true }, { hasClay: false }],
        [{ hasClay: true }, { hasClay: true }],
      ],
    };
    expect(countClayTiles(city)).toBe(3);
  });

  test('nature scope splits tree/boulder stocks by hamlet; clay is map-global', async () => {
    await db.houses.bulkPut([
      {
        instanceId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        hamletId: 'eraanurbs',
        category: 'nature',
        type: 'Tree-Sapin',
        x: 1,
        y: 1,
        stocks: { wood: 50 },
      },
      {
        instanceId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        hamletId: 'clairiere',
        category: 'nature',
        type: 'Tree-Sapin',
        x: 2,
        y: 2,
        stocks: { wood: 30 },
      },
      {
        instanceId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
        hamletId: 'eraanurbs',
        category: 'nature',
        type: 'Boulder-001',
        x: 3,
        y: 3,
        stocks: { rock: 10, iron: 2, gold: 0 },
      },
    ]);

    const city = {
      size: 1,
      tiles: [[{ hasClay: true }]],
    };

    const country = await getHudNatureResourceScopeSnapshot('country', { city });
    const active = await getHudNatureResourceScopeSnapshot('active', { city });

    expect(country.nature).toEqual({ wood: 80, rock: 10, clay: 1, iron: 2, gold: 0 });
    expect(active.nature).toEqual({ wood: 50, rock: 10, clay: 1, iron: 2, gold: 0 });
  });
});
