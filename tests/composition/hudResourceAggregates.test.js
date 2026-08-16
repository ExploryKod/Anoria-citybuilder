import { describe, expect, test, beforeEach } from '@jest/globals';
import 'fake-indexeddb/auto';
import db from '../../src/core/persistence/dexie/db.js';
import { setActiveHamletId, DEFAULT_HAMLET_ID } from '../../src/core/persistence/hamlet/hamletSession.js';
import {
  getHudResourceScopeSnapshot,
  getHudNatureResourceScopeSnapshot,
  sumCityStocksFromRows,
  sumCommerceStocksFromRows,
  sumNatureStocksFromRows,
  countClayTiles,
} from '../../src/composition/hudResourceAggregates.js';
import { SUPPLY_FLOW } from '../../src/contexts/supply/domain/manufacturing/SupplyFlow.js';

describe('hudResourceAggregates', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
    setActiveHamletId(DEFAULT_HAMLET_ID);
  });

  test('city food + shared goods from city barns; commerce from commerce barns', () => {
    const rows = [
      {
        type: 'Windmill-001',
        stocks: { wheat: 10, carrot: 4, cabbage: 2, food: 16, wood: 3 },
      },
      {
        type: 'Barn-001',
        supplyFlow: SUPPLY_FLOW.CITY,
        stocks: { wheat: 5, carrot: 1, cabbage: 0, food: 6 },
        commerceStocks: { wood: 4, furniture: 2, figs: 1 },
      },
      {
        type: 'Barn-001',
        supplyFlow: SUPPLY_FLOW.COMMERCE,
        commerceStocks: { wood: 7, furniture: 3, figs: 1 },
      },
      {
        type: 'Barn-001',
        // legacy barn without supplyFlow → commerce hub
        commerceStocks: { wood: 2, furniture: 0, figs: 0 },
      },
      {
        type: 'House-Blue',
        stocks: { wheat: 99 },
        commerceStocks: { wood: 99 },
      },
    ];

    expect(sumCityStocksFromRows(rows)).toEqual({
      wheat: 15,
      carrot: 5,
      cabbage: 2,
      wood: 7,
      furniture: 2,
      figs: 1,
    });
    expect(sumCommerceStocksFromRows(rows)).toEqual({ wood: 9, furniture: 3, figs: 1 });
  });

  test('same shared goods stay split by barn supplyFlow', () => {
    const rows = [
      {
        type: 'Barn-001',
        supplyFlow: SUPPLY_FLOW.CITY,
        commerceStocks: { wood: 40, furniture: 10, figs: 5 },
      },
      {
        type: 'Barn-001',
        supplyFlow: SUPPLY_FLOW.COMMERCE,
        commerceStocks: { wood: 1, furniture: 2, figs: 3 },
      },
    ];
    expect(sumCityStocksFromRows(rows)).toEqual({
      wheat: 0,
      carrot: 0,
      cabbage: 0,
      wood: 40,
      furniture: 10,
      figs: 5,
    });
    expect(sumCommerceStocksFromRows(rows)).toEqual({ wood: 1, furniture: 2, figs: 3 });
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
      {
        instanceId: '33333333-3333-4333-8333-333333333333',
        hamletId: 'eraanurbs',
        type: 'Barn-001',
        x: 3,
        y: 3,
        commerceStocks: { wood: 2, furniture: 0, figs: 4 },
      },
      {
        instanceId: '44444444-4444-4444-8444-444444444444',
        hamletId: 'clairiere',
        type: 'Barn-001',
        x: 4,
        y: 4,
        commerceStocks: { wood: 8, furniture: 1, figs: 0 },
      },
      {
        instanceId: '55555555-5555-4555-8555-555555555555',
        hamletId: 'eraanurbs',
        type: 'Barn-001',
        supplyFlow: SUPPLY_FLOW.CITY,
        x: 5,
        y: 5,
        stocks: { wheat: 2, carrot: 0, cabbage: 1, food: 3 },
        commerceStocks: { wood: 50, furniture: 0, figs: 0 },
      },
    ]);

    const country = await getHudResourceScopeSnapshot('country');
    const active = await getHudResourceScopeSnapshot('active');

    expect(country.city).toEqual({
      wheat: 10,
      carrot: 1,
      cabbage: 1,
      wood: 50,
      furniture: 0,
      figs: 0,
    });
    expect(country.commerce).toEqual({ wood: 10, furniture: 1, figs: 4 });
    expect(country.cityTotal).toBe(62);
    expect(country.commerceTotal).toBe(15);

    expect(active.city).toEqual({
      wheat: 7,
      carrot: 0,
      cabbage: 1,
      wood: 50,
      furniture: 0,
      figs: 0,
    });
    expect(active.commerce).toEqual({ wood: 2, furniture: 0, figs: 4 });
    expect(active.cityTotal).toBe(58);
    expect(active.commerceTotal).toBe(6);
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
