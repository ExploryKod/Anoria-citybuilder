/**
 * Behavior tests — Supply: generic placement requirement gate. Replaces
 * the old windmill/market-only canPlaceMarketAt/pickOwningWindmillForMarket
 * (see windmillMarketLinkPolicy.test.js's former content) — same rules,
 * driven by catalog `placementRequires` instead of hardcoded windmill logic.
 */
import { describe, test, expect } from '@jest/globals';
import {
  canPlaceBuildingAt,
  pickRequirementOwner,
} from '../../../src/contexts/supply/domain/policies/PlacementRequirementPolicy.js';

describe('canPlaceBuildingAt', () => {
  const windmillA = { id: 'windmill-a', type: 'Windmill-001', x: 10, y: 10, roadCount: 1, linkedMarkets: [] };
  const windmillB = { id: 'windmill-b', type: 'Windmill-001', x: 12, y: 10, roadCount: 1, linkedMarkets: [] };

  test('a building with no placementRequires is always placeable', () => {
    expect(canPlaceBuildingAt({ x: 0, y: 0, buildingType: 'House-Blue', candidates: [] })).toEqual({ ok: true });
  });

  test('picks the closest hub with a free slot', () => {
    const result = canPlaceBuildingAt({
      x: 11,
      y: 10,
      buildingType: 'Market-Stall',
      candidates: [windmillA, windmillB],
    });
    expect(result).toEqual({ ok: true, ownerId: 'windmill-a', role: 'hub' });
  });

  test('rejects when no hub exists at all', () => {
    const result = canPlaceBuildingAt({ x: 5, y: 5, buildingType: 'Market-Stall', candidates: [] });
    expect(result).toEqual({ ok: false, reason: 'hub_missing' });
  });

  test('rejects when the only hub is out of range', () => {
    const result = canPlaceBuildingAt({ x: 30, y: 30, buildingType: 'Market-Stall', candidates: [windmillA] });
    expect(result).toEqual({ ok: false, reason: 'hub_too_far' });
  });

  test('rejects when nearby hubs are all at capacity', () => {
    const fullWindmill = {
      ...windmillA,
      linkedMarkets: [
        { marketId: 'm1', x: 1, y: 1, allocatedStocks: {} },
        { marketId: 'm2', x: 2, y: 2, allocatedStocks: {} },
      ],
    };

    const result = canPlaceBuildingAt({ x: 11, y: 10, buildingType: 'Market-Stall', candidates: [fullWindmill] });
    expect(result).toEqual({ ok: false, reason: 'hub_full' });
  });

  test('ignores candidates without road access', () => {
    const owner = pickRequirementOwner(
      { x: 0, y: 0 },
      [{ id: 'w1', type: 'Windmill-001', x: 1, y: 0, roadCount: 0, linkedMarkets: [] }],
      { role: 'hub', categories: ['wheat'], range: 5, requiresCapacity: true }
    );
    expect(owner).toBeNull();
  });
});
