import { describe, test, expect } from '@jest/globals';
import {
  computeHubAllocations,
  addHubLink,
  removeHubLink,
} from '../../../src/contexts/supply/domain/policies/HubLinkPolicy.js';

describe('HubLinkPolicy', () => {
  test('splits stock evenly across linked distributors, remainder to earlier links', () => {
    const allocations = computeHubAllocations(
      { wheat: 10, carrot: 5, cabbage: 3 },
      [
        { marketId: 'd1', x: 1, y: 1, allocatedStocks: {} },
        { marketId: 'd2', x: 2, y: 2, allocatedStocks: {} },
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
      { marketId: 'd1', x: 0, y: 0, allocatedStocks: {} },
      { marketId: 'd2', x: 1, y: 0, allocatedStocks: {} },
      { marketId: 'd3', x: 2, y: 0, allocatedStocks: {} },
    ], ['stone']);

    expect(allocations.map((a) => a.allocatedStocks.stone)).toEqual([3, 3, 3]);
  });

  test('returns [] when there are no linked distributors', () => {
    expect(computeHubAllocations({ wheat: 5 }, [], ['wheat'])).toEqual([]);
  });

  test('addHubLink appends a zero-stock link, replacing any existing one for the same distributor', () => {
    const links = addHubLink([{ marketId: 'd1', x: 0, y: 0, allocatedStocks: { wheat: 4 } }], 'd1', 1, 1, ['wheat']);
    expect(links).toEqual([{ marketId: 'd1', x: 1, y: 1, allocatedStocks: { wheat: 0 } }]);
  });

  test('removeHubLink drops only the matching distributor', () => {
    const links = removeHubLink(
      [
        { marketId: 'd1', x: 0, y: 0, allocatedStocks: {} },
        { marketId: 'd2', x: 1, y: 0, allocatedStocks: {} },
      ],
      'd1'
    );
    expect(links).toEqual([{ marketId: 'd2', x: 1, y: 0, allocatedStocks: {} }]);
  });
});
