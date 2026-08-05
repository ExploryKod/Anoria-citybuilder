import { describe, test, expect } from '@jest/globals';
import {
  canPlaceMarketAt,
  computeMarketAllocations,
  pickOwningWindmillForMarket,
  MAX_MARKETS_PER_WINDMILL,
} from '../../../src/contexts/supply/domain/policies/WindmillMarketLinkPolicy.js';

describe('WindmillMarketLinkPolicy', () => {
  const windmillA = {
    id: 'windmill-a',
    x: 10,
    y: 10,
    roadCount: 1,
    linkedMarkets: [],
  };

  const windmillB = {
    id: 'windmill-b',
    x: 12,
    y: 10,
    roadCount: 1,
    linkedMarkets: [],
  };

  test('picks closest windmill with free slot', () => {
    const owner = pickOwningWindmillForMarket({ x: 11, y: 10 }, [windmillA, windmillB]);
    expect(owner?.id).toBe('windmill-a');
  });

  test('rejects market when no windmill exists', () => {
    const result = canPlaceMarketAt({ x: 5, y: 5, windmills: [] });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('no_windmill');
  });

  test('rejects market when windmill is too far', () => {
    const result = canPlaceMarketAt({ x: 30, y: 30, windmills: [windmillA] });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('windmill_too_far');
  });

  test('rejects market when nearby windmills are full', () => {
    const fullWindmill = {
      ...windmillA,
      linkedMarkets: [
        { marketId: 'm1', x: 1, y: 1, allocatedStocks: { wheat: 0, carrot: 0, cabbage: 0 } },
        { marketId: 'm2', x: 2, y: 2, allocatedStocks: { wheat: 0, carrot: 0, cabbage: 0 } },
      ],
    };

    const result = canPlaceMarketAt({ x: 11, y: 10, windmills: [fullWindmill] });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('windmill_full');
    expect(MAX_MARKETS_PER_WINDMILL).toBe(2);
  });

  test('splits stocks evenly across linked markets', () => {
    const allocations = computeMarketAllocations(
      { wheat: 10, carrot: 5, cabbage: 3 },
      [
        { marketId: 'm1', x: 1, y: 1, allocatedStocks: { wheat: 0, carrot: 0, cabbage: 0 } },
        { marketId: 'm2', x: 2, y: 2, allocatedStocks: { wheat: 0, carrot: 0, cabbage: 0 } },
      ]
    );

    expect(allocations[0].allocatedStocks.wheat).toBe(5);
    expect(allocations[1].allocatedStocks.wheat).toBe(5);
    expect(allocations[0].allocatedStocks.carrot).toBe(3);
    expect(allocations[1].allocatedStocks.carrot).toBe(2);
  });
});
