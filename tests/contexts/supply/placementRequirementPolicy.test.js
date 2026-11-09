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
  const windmillA = { id: 'windmill-a', type: 'Windmill-001', x: 10, y: 10, roadCount: 1, linkedDistributors: [] };
  const windmillB = { id: 'windmill-b', type: 'Windmill-001', x: 12, y: 10, roadCount: 1, linkedDistributors: [] };

  test('a building with no placementRequires is always placeable', () => {
    expect(canPlaceBuildingAt({ x: 0, y: 0, buildingType: 'House-Blue', candidates: [] })).toEqual({ ok: true });
  });

  test('picks the closest hub in reach, and among equally close ones the first orientation of the catalog\'s order', () => {
    const near = (x) => canPlaceBuildingAt({ x, y: 10, buildingType: 'Market-Stall-Red', candidates: [windmillA, windmillB], placedCount: 0 });
    expect(near(9)).toEqual({ ok: true, ownerId: 'windmill-a', role: 'hub' }); // 1 tile from A, 3 from B
    // At 11 both are 1 tile away: A lies to the west, B to the east, and the catalog ranks east before west.
    expect(near(11)).toEqual({ ok: true, ownerId: 'windmill-b', role: 'hub' });
  });

  test('rejects when no hub exists at all', () => {
    const result = canPlaceBuildingAt({ x: 5, y: 5, buildingType: 'Market-Stall-Red', candidates: [], placedCount: 0 });
    expect(result).toEqual({ ok: false, reason: 'hub_missing' });
  });

  test('a market has no reach limit to its granaries: a far one still owns it', () => {
    const result = canPlaceBuildingAt({ x: 300, y: 300, buildingType: 'Market-Stall-Red', candidates: [windmillA], placedCount: 0 });
    expect(result).toEqual({ ok: true, ownerId: 'windmill-a', role: 'hub' });
  });

  test('rejects when as many markets already stand as there are granaries, wherever they are', () => {
    const result = canPlaceBuildingAt({ x: 11, y: 10, buildingType: 'Market-Stall-Red', candidates: [windmillA], placedCount: 1 });
    expect(result).toEqual({ ok: false, reason: 'hub_full' });
  });

  test('many granaries and one market: another market may be placed while granaries outnumber the markets, in reach of just one of them', () => {
    const far = { id: 'windmill-far', type: 'Windmill-001', x: 90, y: 90, roadCount: 1, linkedDistributors: [] };
    const placed = (placedCount) => canPlaceBuildingAt({ x: 11, y: 10, buildingType: 'Market-Stall-Red', candidates: [windmillA, windmillB, far], placedCount });
    expect(placed(2)).toMatchObject({ ok: true });
    expect(placed(3)).toEqual({ ok: false, reason: 'hub_full' });
  });

  test('a limited placement must be told how many already stand', () => {
    expect(() => canPlaceBuildingAt({ x: 11, y: 10, buildingType: 'Market-Stall-Red', candidates: [windmillA] })).toThrow(/placedCount/);
  });

  test('ignores candidates without road access', () => {
    const owner = pickRequirementOwner(
      { x: 0, y: 0 },
      [{ id: 'w1', type: 'Windmill-001', x: 1, y: 0, roadCount: 0, linkedDistributors: [] }],
      { role: 'hub', categories: ['wheat'], range: 5, requiresCapacity: true }
    );
    expect(owner).toBeNull();
  });
});
