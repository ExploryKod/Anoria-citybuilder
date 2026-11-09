/**
 * An import and the same good made here compete: the cheapest lot is served first whatever its origin; the harvest of the fields is never kept out by an import (the room it
 * needs is reserved); the fields that do not work reserve nothing.
 */
import { describe, test, expect } from '@jest/globals';
import { allocateToClient, availableToClient, orderedLotKeys } from '../../../src/contexts/supply/domain/policies/HubClientAllocationPolicy.js';
import { harvestReservePerHub, harvestToCome } from '../../../src/contexts/supply/domain/policies/HarvestReservePolicy.js';

const noPriority = () => ({ order: [], disabled: [] });
const lots = { 'farm-1': 20, 'city:frumenta': 20, 'farm-2': 10 };
const prices = { 'farm-1': 1.5, 'city:frumenta': 1.2, 'farm-2': 1.5 };
const priceOf = (key) => prices[key] ?? null;

describe('the cheapest lot is served first', () => {
  test('the lots are ordered by price, a lot whose price is unknown last, then by key', () => {
    expect(orderedLotKeys(lots, priceOf)).toEqual(['city:frumenta', 'farm-1', 'farm-2']);
    expect(orderedLotKeys({ b: 1, a: 1, c: 1 }, (key) => ({ a: 3, b: null, c: 2 })[key])).toEqual(['c', 'a', 'b']);
    expect(orderedLotKeys(lots, undefined)).toEqual(['city:frumenta', 'farm-1', 'farm-2']); // no pricing: by key, as before
  });

  test('a client takes the cheap import first, and only then the dearer goods made here', () => {
    const takes = allocateToClient({ lots, priorityOf: noPriority, othersWanted: {}, client: 'market', want: 30, priceOf });
    expect(takes).toEqual([{ key: 'city:frumenta', amount: 20 }, { key: 'farm-1', amount: 10 }]);
  });

  test('what is dearer than the import stays on the shelf of the hub, unsold, while the import lasts', () => {
    const takes = allocateToClient({ lots, priorityOf: noPriority, othersWanted: {}, client: 'market', want: 15, priceOf });
    expect(takes).toEqual([{ key: 'city:frumenta', amount: 15 }]);
    expect(availableToClient({ lots, priorityOf: noPriority, othersWanted: {}, client: 'market', priceOf })).toBe(50);
  });
});

describe('the harvest to come keeps its room', () => {
  const field = (fields) => ({ type: 'Farm-Wheat', roadCount: 1, worker: 3, workerNeed: 3, lastProductionYear: 0, ...fields });

  test('fields that have not yielded this year count, those that have do not', () => {
    expect(harvestToCome({ producers: [field({ lastProductionYear: 1 }), field({ lastProductionYear: 0 })], good: 'wheat', year: 1 })).toBe(288);
  });

  test('a field that does not work reserves nothing; one half staffed reserves its share', () => {
    expect(harvestToCome({ producers: [field({ worker: 0 })], good: 'wheat', year: 1 })).toBe(0);
    expect(harvestToCome({ producers: [field({ worker: 1 })], good: 'wheat', year: 1 })).toBe(96);
  });

  test('the reserve is shared among the hubs that hold the good', () => {
    expect(harvestReservePerHub({ toCome: 1728, hubCount: 2 })).toBe(864);
    expect(harvestReservePerHub({ toCome: 1728, hubCount: 0 })).toBe(1728);
  });
});
