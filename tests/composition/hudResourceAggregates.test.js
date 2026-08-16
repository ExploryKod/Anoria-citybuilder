import { describe, expect, test, beforeEach } from '@jest/globals';
import 'fake-indexeddb/auto';
import db from '../../src/core/persistence/dexie/db.js';
import { setActiveHamletId, DEFAULT_HAMLET_ID } from '../../src/core/persistence/hamlet/hamletSession.js';
import {
  getHudResourceScopeSnapshot,
  sumCityStocksFromRows,
  sumCommerceStocksFromRows,
} from '../../src/composition/hudResourceAggregates.js';
import { SUPPLY_FLOW } from '../../src/contexts/supply/domain/manufacturing/SupplyFlow.js';

describe('hudResourceAggregates', () => {
  beforeEach(async () => {
    await db.delete();
    await db.open();
    setActiveHamletId(DEFAULT_HAMLET_ID);
  });

  test('city = windmills + city barns food; commerce = commerce barns only', () => {
    const rows = [
      {
        type: 'Windmill-001',
        stocks: { wheat: 10, carrot: 4, cabbage: 2, food: 16 },
      },
      {
        type: 'Barn-001',
        supplyFlow: SUPPLY_FLOW.CITY,
        stocks: { wheat: 5, carrot: 1, cabbage: 0, food: 6 },
        commerceStocks: { wood: 99, furniture: 0, figs: 0 },
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

    expect(sumCityStocksFromRows(rows)).toEqual({ wheat: 15, carrot: 5, cabbage: 2 });
    expect(sumCommerceStocksFromRows(rows)).toEqual({ wood: 9, furniture: 3, figs: 1 });
  });

  test('city barn commerceStocks are ignored in commerce totals', () => {
    const rows = [
      {
        type: 'Barn-001',
        supplyFlow: SUPPLY_FLOW.CITY,
        commerceStocks: { wood: 40, furniture: 10, figs: 5 },
      },
    ];
    expect(sumCommerceStocksFromRows(rows)).toEqual({ wood: 0, furniture: 0, figs: 0 });
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

    expect(country.city).toEqual({ wheat: 10, carrot: 1, cabbage: 1 });
    expect(country.commerce).toEqual({ wood: 10, furniture: 1, figs: 4 });
    expect(country.cityTotal).toBe(12);
    expect(country.commerceTotal).toBe(15);

    expect(active.city).toEqual({ wheat: 7, carrot: 0, cabbage: 1 });
    expect(active.commerce).toEqual({ wood: 2, furniture: 0, figs: 4 });
    expect(active.cityTotal).toBe(8);
    expect(active.commerceTotal).toBe(6);
  });
});
