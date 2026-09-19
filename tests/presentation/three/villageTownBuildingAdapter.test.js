/**
 * Unit tests — villageTownBuildingAdapter.createMesh: per
 * buildingSourceAdapterRegistry.js's contract, createMesh must return a
 * FULLY positioned mesh (footprint centering included), same as the Kenney
 * adapter already does internally. Regression guard for the bug where
 * scene.js used to add its own external centering on top — correct for
 * villageTown (which didn't self-center) but double-applied for Kenney
 * (which does), causing houses to visibly shift on evolution and the
 * placement ghost (which already trusted adapters to self-center) to look
 * "uncentered" relative to where the real building landed.
 */
import { describe, test, expect } from '@jest/globals';
import { getBuildingSourceAdapter } from '../../../src/presentation/three/adapters/buildingSourceAdapterRegistry.js';
import '../../../src/presentation/three/adapters/registerBuildingSourceAdapters.js';
import { ASSET_CATALOG } from '../../../src/presentation/three/meshs/resolveBuildingMesh.js';

function fakeMesh() {
  return { position: { x: 0, y: 0, z: 0, set(x, y, z) { this.x = x; this.y = y; this.z = z; } }, userData: {} };
}

describe('villageTownBuildingAdapter.createMesh', () => {
  const adapter = getBuildingSourceAdapter('villageTown');

  test('is registered', () => {
    expect(adapter).toBeTruthy();
  });

  test('a 1x1 villageTown mesh (the procedural grass tile) is left at whatever position assetManager.createAsset set — no spurious extra offset added', () => {
    // Mirrors VillageTownAssetManager#createBuilding's own real positioning
    // (object3D.position.set(placerPos.x, yOffset, placerPos.y)).
    const assetManager = {
      createAsset: (id, x, y) => {
        const mesh = fakeMesh();
        mesh.position.set(x, 0.2, y);
        return mesh;
      },
    };
    const catalogEntry = ASSET_CATALOG['grass'];
    expect(catalogEntry.source).toBe('villageTown');

    const result = adapter.createMesh(3, 5, {
      catalogEntry,
      rotationStep: 0,
      assetManager,
    });

    expect(result.position.x).toBe(3);
    expect(result.position.z).toBe(5);
  });

  test('returns null/undefined untouched when assetManager.createAsset fails to resolve a mesh', () => {
    const assetManager = { createAsset: () => undefined };
    const result = adapter.createMesh(0, 0, {
      catalogEntry: ASSET_CATALOG['grass'],
      rotationStep: 0,
      assetManager,
    });
    expect(result).toBeUndefined();
  });
});
