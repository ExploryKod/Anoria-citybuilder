import { describe, test, expect } from '@jest/globals';
import {
  computeHubAllocations,
  addHubLink,
  removeHubLink,
} from '../../../src/contexts/supply/domain/policies/HubLinkPolicy.js';
import { computeCarryOver, computeAutonomyMonths, snapshotCarryOver } from '../../../src/contexts/supply/domain/policies/HubCapacityPolicy.js';

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

  test('the snapshot keeps what the hub held, per category, before a harvest came in', () => {
    expect(snapshotCarryOver({ wheat: 226, carrot: 0, food: 226 }, categories)).toEqual({ wheat: 226, carrot: 0 });
  });

  test('the first harvest of the game carries nothing over: the hub was empty', () => {
    expect(snapshotCarryOver({}, categories)).toEqual({ wheat: 0, carrot: 0 });
    expect(snapshotCarryOver(undefined, categories)).toEqual({ wheat: 0, carrot: 0 });
  });

  test('right after the harvest, the carry-over is the whole snapshot — not the harvest that came in', () => {
    // 226 held before, 1440 harvested: the stock is 1666, the carry-over 226.
    expect(computeCarryOver({ wheat: 1666 }, { wheat: 226 }, { wheat: 1440 }, ['wheat'])).toEqual({ wheat: 226 });
  });

  test('goods leave oldest first: the carry-over shrinks as the hub is drawn, while the harvest is untouched', () => {
    // 100 units left the hub: they came out of the old 226, which is now 126.
    expect(computeCarryOver({ wheat: 1566 }, { wheat: 226 }, { wheat: 1440 }, ['wheat'])).toEqual({ wheat: 126 });
    // 226 or more left: the old stock is gone, whatever was drawn beyond it came from the harvest.
    expect(computeCarryOver({ wheat: 1440 }, { wheat: 226 }, { wheat: 1440 }, ['wheat'])).toEqual({ wheat: 0 });
    expect(computeCarryOver({ wheat: 666 }, { wheat: 226 }, { wheat: 1440 }, ['wheat'])).toEqual({ wheat: 0 });
  });

  test('with no snapshot recorded, nothing is claimed as carried over', () => {
    expect(computeCarryOver({ wheat: 40 }, null, null, ['wheat'])).toEqual({ wheat: 0 });
    expect(computeCarryOver({ wheat: 40 }, undefined, undefined, ['wheat'])).toEqual({ wheat: 0 });
  });

  test('with no harvest recorded yet, the whole stock left of the snapshot is old', () => {
    expect(computeCarryOver({ wheat: 90 }, { wheat: 226 }, undefined, ['wheat'])).toEqual({ wheat: 90 });
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
