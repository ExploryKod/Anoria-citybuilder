// Kenney city-kit's BuildingSourceAdapter registration — everything specific
// to how this source creates, positions, and rotates a building lives here.
// No other file (resolveBuildingMesh.js, placementGhost.js) may know this
// source's name or behavior.

import { getKenneyCityKitMeshAdapter } from './KenneyCityKitMeshAdapter.js';
import { KENNEY_CITY_KIT_PLATFORM_HEIGHT } from './kenneyCityKitConfig.js';
import { registerBuildingSourceAdapter } from '../buildingSourceAdapterRegistry.js';

/**
 * Reposition an already-created ghost mesh without recreating it. Kenney
 * buildings are footprint-based (can span multiple tiles, swap width/depth
 * on odd rotation steps) — a different math than a single-tile village mesh.
 * A missing rotationStep resets to 0 (not the ghost controller's current
 * rotation) — rotationRequiresRespawn means any real rotation change goes
 * through createMesh instead, so this path only ever sees 0 in practice.
 * @param {import('three').Object3D} mesh
 * @param {number} x
 * @param {number} y
 * @param {{ gridSize?: number, footprintWidth?: number, footprintHeight?: number, rotationStep?: number }} [options]
 */
function repositionGhost(mesh, x, y, options = {}) {
  const rotationStep = options.rotationStep ?? 0;
  let footprintWidth = options.footprintWidth ?? options.gridSize ?? 1;
  let footprintDepth = options.footprintHeight ?? options.gridSize ?? 1;
  if (rotationStep % 2 === 1) {
    [footprintWidth, footprintDepth] = [footprintDepth, footprintWidth];
  }

  const centerX = (footprintWidth - 1) / 2;
  const centerZ = (footprintDepth - 1) / 2;
  mesh.position.set(x + centerX, KENNEY_CITY_KIT_PLATFORM_HEIGHT + 0.04, y + centerZ);
  mesh.rotation.y = rotationStep * (Math.PI / 2);

  if (mesh.userData) {
    mesh.userData.x = x;
    mesh.userData.y = y;
    mesh.userData.gridSize = Math.max(footprintWidth, footprintDepth);
    mesh.userData.footprintWidth = footprintWidth;
    mesh.userData.footprintDepth = footprintDepth;
  }
}

registerBuildingSourceAdapter('kenneyCityKit', {
  // Not `async` — returns the adapter's own promise directly. Wrapping it in
  // an async function would add an extra microtask tick before callers see
  // it resolve, which the ghost-hover / rapid-move path can't afford.
  createMesh(x, y, { catalogEntry, rotationStep }) {
    return getKenneyCityKitMeshAdapter().createBuilding(x, y, {
      buildingId: catalogEntry.geometry.buildingId,
      rotationStep,
    });
  },
  repositionGhost,
  // Footprint can swap width/depth on odd rotation steps — a full respawn
  // recomputes the mesh at the new footprint, an in-place yaw update can't.
  rotationRequiresRespawn: true,
  // The adapter already applies group.rotation.y = rotationStep * (PI/2)
  // itself — no separate authored-frame baseline to track.
  resolveBaseYawAngle: () => 0,
});
