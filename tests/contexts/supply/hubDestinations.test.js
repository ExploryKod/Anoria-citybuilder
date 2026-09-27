import { describe, test, expect } from '@jest/globals';
import { rankHubDestinations } from '../../../src/contexts/supply/domain/policies/HubDestinationPolicy.js';

const warehouse = (id, x, y, over = {}) => ({
  id, type: 'Warehouse', x, y, roadCount: 1, worker: 1, workerNeed: 1, maxStock: 500, stocks: { plate: 0, goods: 0 }, ...over,
});
const ranked = (hubs, extra = {}) =>
  rankHubDestinations({ hubs, category: 'plate', from: { x: 0, y: 0 }, ...extra }).map(({ hub }) => hub.id);

describe('hub destinations — one ranking for whoever has goods to place', () => {
  test('the nearest first, by Manhattan distance', () => {
    expect(ranked([warehouse('far', 20, 0), warehouse('near', 3, 2), warehouse('mid', 6, 6)])).toEqual(['near', 'mid', 'far']);
  });

  test('"fetch" hubs come before any nearer one', () => {
    const hubs = [warehouse('near', 1, 0), warehouse('far', 30, 0, { hubStorageOrders: { plate: { mode: 'fetch', maxPercent: 100 } } })];
    expect(ranked(hubs)).toEqual(['far', 'near']);
  });

  test('on a tie the hub with more room wins, then the identifier', () => {
    const hubs = [
      warehouse('b', 5, 0, { stocks: { plate: 100, goods: 100 } }),
      warehouse('a', 0, 5, { stocks: { plate: 100, goods: 100 } }),
      warehouse('c', 5, 0, { stocks: { plate: 0, goods: 0 } }),
    ];
    expect(ranked(hubs)).toEqual(['c', 'a', 'b']);
  });

  test('a hub that refuses, empties, is full, is not working or is the one being emptied is left out', () => {
    const hubs = [
      warehouse('refuses', 1, 0, { hubStorageOrders: { plate: { mode: 'refuse', maxPercent: 100 } } }),
      warehouse('empties', 2, 0, { hubStorageOrders: { plate: { mode: 'empty', maxPercent: 100 } } }),
      warehouse('full', 3, 0, { stocks: { plate: 500, goods: 500 } }),
      warehouse('idle', 4, 0, { worker: 0 }),
      warehouse('self', 5, 0),
      warehouse('ok', 9, 0),
    ];
    expect(ranked(hubs, { excludeId: 'self' })).toEqual(['ok']);
  });

  test('a hub whose ceiling for that good is reached takes no more of it', () => {
    const hubs = [warehouse('capped', 1, 0, { stocks: { plate: 100, goods: 100 }, hubStorageOrders: { plate: { mode: 'accept', maxPercent: 20 } } })];
    expect(ranked(hubs)).toEqual([]);
  });
});
