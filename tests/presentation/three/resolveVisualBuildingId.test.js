/**
 * Unit tests — resolveVisualBuildingId: level-aware mesh id override.
 */
import { describe, test, expect } from '@jest/globals';
import { resolveVisualBuildingId, ASSET_CATALOG } from '../../../src/presentation/three/meshs/resolveBuildingMesh.js';
import { resolveFootprint } from '../../../src/shared/asset-footprint/resolveFootprint.js';

describe('resolveVisualBuildingId', () => {
  test('no level given — returns the base id unchanged', () => {
    expect(resolveVisualBuildingId('House-Red')).toBe('House-Red');
  });

  test('level 1 (no levelVariants entry for it) — returns the base id', () => {
    expect(resolveVisualBuildingId('House-Red', 1)).toBe('House-Red');
  });

  test('a house with declared levelVariants resolves to its tier mesh', () => {
    expect(resolveVisualBuildingId('House-Red', 2)).toBe('Kenney-Suburban-building-type-d');
    expect(resolveVisualBuildingId('House-Blue', 3)).toBe('Kenney-Suburban-building-type-g');
    expect(resolveVisualBuildingId('House-Purple', 4)).toBe('Kenney-Suburban-building-type-j');
  });

  test('a level with no declared variant falls back to the base id', () => {
    expect(resolveVisualBuildingId('House-Red', 99)).toBe('House-Red');
  });

  test('a building type with no levelVariants fact at all is unaffected by level', () => {
    expect(resolveVisualBuildingId('Chapel', 2)).toBe('Chapel');
  });

  test('every declared levelVariant keeps the same footprint as its base id — a mismatch shifts the mesh at evolution time (placement centering is footprint-size-driven)', () => {
    const mismatches = [];
    for (const [baseId, entry] of Object.entries(ASSET_CATALOG)) {
      if (!entry.levelVariants) continue;
      const baseFootprint = resolveFootprint(baseId);
      for (const [level, variantId] of Object.entries(entry.levelVariants)) {
        const variantFootprint = resolveFootprint(variantId);
        if (
          variantFootprint.width !== baseFootprint.width ||
          variantFootprint.depth !== baseFootprint.depth
        ) {
          mismatches.push(`${baseId} level ${level} -> ${variantId}: ${JSON.stringify(variantFootprint)} vs base ${JSON.stringify(baseFootprint)}`);
        }
      }
    }
    expect(mismatches).toEqual([]);
  });
});
