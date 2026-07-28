import { describe, test, expect } from '@jest/globals';
import { evaluateRoadAccess } from '../../../../src/contexts/urban/domain/policies/RoadAccessPolicy.js';
import { fromLegacyNeighbor } from '../../../../src/contexts/urban/domain/value-objects/NeighborRef.js';

describe('RoadAccessPolicy', () => {
  test('retourne hasAccess true si une route isRoad est présente', () => {
    const neighbors = [
      fromLegacyNeighbor({ name: 'House-Blue', isRoad: false }),
      fromLegacyNeighbor({ name: 'roads', isRoad: true }),
    ];
    const result = evaluateRoadAccess(neighbors);
    expect(result.hasAccess).toBe(true);
    expect(result.roadCount).toBe(1);
  });

  test('détecte userData.isRoad', () => {
    const neighbors = [
      fromLegacyNeighbor({ name: 'Farm-Wheat', userData: { isRoad: true } }),
    ];
    expect(evaluateRoadAccess(neighbors).roadCount).toBe(1);
  });

  test('détecte name === "roads" ou "Road"', () => {
    expect(evaluateRoadAccess([fromLegacyNeighbor({ name: 'roads' })]).roadCount).toBe(1);
    expect(evaluateRoadAccess([fromLegacyNeighbor({ name: 'Road' })]).roadCount).toBe(1);
  });

  test('détecte buildingId === "roads"', () => {
    const neighbors = [fromLegacyNeighbor({ buildingId: 'roads' })];
    expect(evaluateRoadAccess(neighbors).roadCount).toBe(1);
  });

  test('compte plusieurs routes', () => {
    const neighbors = [
      fromLegacyNeighbor({ isRoad: true }),
      fromLegacyNeighbor({ isRoad: true }),
      fromLegacyNeighbor({ name: 'House-Blue' }),
    ];
    expect(evaluateRoadAccess(neighbors).roadCount).toBe(2);
  });

  test('retourne 0 si aucune route', () => {
    const neighbors = [
      fromLegacyNeighbor({ name: 'House-Blue' }),
      fromLegacyNeighbor({ name: 'Farm-Wheat' }),
    ];
    const result = evaluateRoadAccess(neighbors);
    expect(result.hasAccess).toBe(false);
    expect(result.roadCount).toBe(0);
  });

  test('gère neighbors null, undefined, non-tableau', () => {
    expect(evaluateRoadAccess(null).roadCount).toBe(0);
    expect(evaluateRoadAccess(undefined).roadCount).toBe(0);
    expect(evaluateRoadAccess({}).roadCount).toBe(0);
    expect(evaluateRoadAccess([]).roadCount).toBe(0);
  });
});
