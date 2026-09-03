// Generic per-source building-mesh adapter registry.
//
// No file that consumes this registry (resolveBuildingMesh.js, placementGhost.js)
// may hardcode a source name ('kenneyCityKit', 'villageTown', or any future one) —
// every source registers its own adapter here instead. Adding a new GLB pack means
// writing one adapter file that calls registerBuildingSourceAdapter once; nothing
// in the generic mesh-resolution or ghost-placement code changes.

/** @type {Map<string, BuildingSourceAdapter>} */
const adapters = new Map();

/**
 * @typedef {object} BuildingSourceAdapter
 * @property {(x: number, y: number, options: { catalogEntry: object, rotationStep: number, assetManager: object }) => (import('three').Object3D | null | Promise<import('three').Object3D | null>)} createMesh
 *   Builds a fully positioned/rotated mesh for one catalog entry at tile (x,y).
 *   May return synchronously or a Promise — callers must handle both, since
 *   sources genuinely differ here (a local mesh clone vs. a GLB/network load).
 * @property {(mesh: import('three').Object3D, x: number, y: number, options: object) => void} repositionGhost
 *   Repositions/rotates an ALREADY-BUILT ghost mesh in place, without calling
 *   createMesh again — perf-sensitive, called every hover frame. Ghost use only.
 * @property {boolean} rotationRequiresRespawn
 *   Whether changing the ghost's rotation step needs createMesh called again
 *   (true when footprint can swap on odd steps) instead of an in-place yaw
 *   update via repositionGhost. Ghost use only.
 * @property {(mesh: import('three').Object3D) => number} resolveBaseYawAngle
 *   The baseline yaw this source's meshes are authored at (0 if the source's
 *   adapter already normalizes rotation itself). Ghost use only.
 */

/**
 * @param {string} source
 * @param {BuildingSourceAdapter} adapter
 */
export function registerBuildingSourceAdapter(source, adapter) {
  adapters.set(source, adapter);
}

/**
 * @param {string | undefined | null} source
 * @returns {BuildingSourceAdapter | null}
 */
export function getBuildingSourceAdapter(source) {
  return adapters.get(source) ?? null;
}
