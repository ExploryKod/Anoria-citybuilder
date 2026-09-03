// villageTown's BuildingSourceAdapter registration — everything specific to
// how this source creates, positions, and rotates a building lives here.
// No other file (resolveBuildingMesh.js, placementGhost.js) may know this
// source's name or behavior.

import { getPlacementYawAngle, setPlacementRotationStep } from '../../placementRotation.js';
import { registerBuildingSourceAdapter } from '../buildingSourceAdapterRegistry.js';

/**
 * @param {import('three').Object3D} mesh
 * @param {number} x
 * @param {number} y
 * @param {number} [gridSize]
 */
function setTilePosition(mesh, x, y, gridSize = 1) {
  const worldPlatformHeight = 0.2;
  const centerOffset = (gridSize - 1) / 2;
  mesh.position.set(x + centerOffset, worldPlatformHeight + 0.04, y + centerOffset);
  if (mesh.userData) {
    mesh.userData.x = x;
    mesh.userData.y = y;
    mesh.userData.gridSize = gridSize;
  }
}

registerBuildingSourceAdapter('villageTown', {
  createMesh(x, y, { catalogEntry, rotationStep, assetManager }) {
    const sourceKey = catalogEntry.geometry.sourceKey;
    if (!sourceKey) {
      throw new Error('[villageTownBuildingAdapter] catalog entry is villageTown-sourced but has no geometry.sourceKey');
    }
    // Synchronous by design: a village mesh is an already-loaded clone, no
    // network/GLB load involved — callers may rely on this being immediate.
    return assetManager.createAsset(sourceKey, x, y, { rotationStep });
  },
  repositionGhost(mesh, x, y, options = {}) {
    setTilePosition(mesh, x, y, options.gridSize ?? 1);
    // Falls back to the ghost controller's own rotation state when a hover
    // move doesn't carry an explicit rotationStep (unlike Kenney's adapter,
    // which defaults a missing rotationStep to 0 — see that adapter's note).
    const step = options.rotationStep ?? options.controllerRotationStep ?? 0;
    if (step) {
      setPlacementRotationStep(mesh, options.baseYawAngle ?? 0, step);
    }
  },
  // A single-tile mesh rotating in place — no footprint to recompute.
  rotationRequiresRespawn: false,
  // Village GLB meshes carry their own authored yaw (Z-up vs Y-up mesh
  // conventions) — read it off the mesh itself, not assumed to be 0.
  resolveBaseYawAngle: (mesh) => getPlacementYawAngle(mesh),
});
