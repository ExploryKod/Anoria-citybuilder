import { describe, test, expect } from '@jest/globals';
import {
  computeHubAllocations,
  addHubLink,
  removeHubLink,
} from '../../../src/contexts/supply/domain/policies/HubLinkPolicy.js';
import { computeCarryOver, computeAutonomyMonths } from '../../../src/contexts/supply/domain/policies/HubCapacityPolicy.js';

describe('HubLinkPolicy', () => {
  test('splits stock evenly across linked distributors, remainder to earlier links', () => {
    const allocations = computeHubAllocations(
      { wheat: 10, carrot: 5, cabbage: 3 },
      [
        { distributorId: 'd1', x: 1, y: 1, allocatedStocks: {} },
        { distributorId: 'd2', x: 2, y: 2, allocatedStocks: {} },
      ],
      ['wheat', 'carrot', 'cabbage']
    );

    expect(allocations[0].allocatedStocks.wheat).toBe(5);
    expect(allocations[1].allocatedStocks.wheat).toBe(5);
    expect(allocations[0].allocatedStocks.carrot).toBe(3);
    expect(allocations[1].allocatedStocks.carrot).toBe(2);
  });

  test('works for a resource category set with a single category (e.g. a granary)', () => {
    const allocations = computeHubAllocations({ stone: 9 }, [
      { distributorId: 'd1', x: 0, y: 0, allocatedStocks: {} },
      { distributorId: 'd2', x: 1, y: 0, allocatedStocks: {} },
      { distributorId: 'd3', x: 2, y: 0, allocatedStocks: {} },
    ], ['stone']);

    expect(allocations.map((a) => a.allocatedStocks.stone)).toEqual([3, 3, 3]);
  });

  test('returns [] when there are no linked distributors', () => {
    expect(computeHubAllocations({ wheat: 5 }, [], ['wheat'])).toEqual([]);
  });

  test('addHubLink appends a zero-stock link, replacing any existing one for the same distributor', () => {
    const links = addHubLink([{ distributorId: 'd1', x: 0, y: 0, allocatedStocks: { wheat: 4 } }], 'd1', 1, 1, ['wheat']);
    expect(links).toEqual([{ distributorId: 'd1', x: 1, y: 1, allocatedStocks: { wheat: 0 } }]);
  });

  test('removeHubLink drops only the matching distributor', () => {
    const links = removeHubLink(
      [
        { distributorId: 'd1', x: 0, y: 0, allocatedStocks: {} },
        { distributorId: 'd2', x: 1, y: 0, allocatedStocks: {} },
      ],
      'd1'
    );
    expect(links).toEqual([{ distributorId: 'd2', x: 1, y: 0, allocatedStocks: {} }]);
  });
});

describe('hub stock — what is left from before the last harvest, and for how long it lasts', () => {
  const categories = ['wheat', 'carrot'];

  test('the carry-over is what the stock holds beyond the last harvest (oldest goods leave first)', () => {
    expect(computeCarryOver({ wheat: 1450, carrot: 0 }, { wheat: 1440, carrot: 0 }, categories)).toEqual({
      wheat: 10,
      carrot: 0,
    });
  });

  test('once the old stock is used up, the carry-over is nothing, not negative', () => {
    expect(computeCarryOver({ wheat: 1220 }, { wheat: 1440 }, ['wheat'])).toEqual({ wheat: 0 });
  });

  test('with no harvest recorded, everything held counts as carried over', () => {
    expect(computeCarryOver({ wheat: 40 }, null, ['wheat'])).toEqual({ wheat: 40 });
  });

  test('autonomy is the stock over the month\'s outflow, in whole months', () => {
    expect(computeAutonomyMonths(670, 110)).toBe(6);
    expect(computeAutonomyMonths(100, 110)).toBe(0);
  });

  test('autonomy is unknown while nothing has left the hub yet', () => {
    expect(computeAutonomyMonths(670, 0)).toBeNull();
    expect(computeAutonomyMonths(670, undefined)).toBeNull();
  });
});
