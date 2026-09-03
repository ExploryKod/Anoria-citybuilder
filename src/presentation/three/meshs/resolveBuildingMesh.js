import { BUILDING_ASSETS } from '../assets/buildingAssets.js';
import { NATURE_ASSETS } from '../assets/natureAssets.js';
import { TERRAIN_ASSETS } from '../assets/terrainAssets.js';
import { getBuildingSourceAdapter } from '../adapters/buildingSourceAdapterRegistry.js';
// Side-effect only: populates the registry above. The only file in the
// codebase allowed to know every concrete adapter by name — everything else
// (this function, placementGhost.js) looks sources up through the registry.
import '../adapters/registerBuildingSourceAdapters.js';

/**
 * The tile-placement path this resolves for (scene.js's placeTileMeshIfNeeded)
 * is generic — it places buildings, trees, decoration, tombs, and terrain
 * tiles alike, so every placeable id, whichever of the three catalogs it
 * lives in, must resolve through here.
 */
export const ASSET_CATALOG = { ...BUILDING_ASSETS, ...NATURE_ASSETS, ...TERRAIN_ASSETS };

/**
 * Resolves and creates the mesh for a stable placeable id, via whichever
 * adapter its catalog entry names. Single source of truth for mesh
 * creation — used by the real game (scene.js) and by the /placement.html
 * tuning tool, so whatever you tune there is guaranteed to match what
 * actually renders in-game.
 *
 * An id's identity (game logic) is fully decoupled from which mesh renders
 * it: reassign `source`/`geometry` in buildingAssets.js / natureAssets.js /
 * terrainAssets.js and nothing else in the codebase needs to change —
 * including its carousel button, which reads from the same entry (see
 * ToolPanel.js resolveIcon). This function itself never names a source —
 * see adapters/buildingSourceAdapterRegistry.js.
 *
 * Throws on any missing catalog entry, unregistered source, or an adapter
 * producing no mesh — no silent fallback.
 *
 * @param {object} params
 * @param {string} params.buildingId
 * @param {number} params.x
 * @param {number} params.y
 * @param {number} [params.rotationStep]
 * @param {object} params.assetManager - the VillageTownAssetManager instance
 * @returns {Promise<import('three').Object3D>}
 */
export async function resolveAndCreateBuildingMesh({ buildingId, x, y, rotationStep = 0, assetManager }) {
  const catalogEntry = ASSET_CATALOG[buildingId];
  if (!catalogEntry) {
    throw new Error(`[buildingAssets] No catalog entry for "${buildingId}"`);
  }

  const adapter = getBuildingSourceAdapter(catalogEntry.source);
  if (!adapter) {
    throw new Error(`[buildingAssets] No adapter registered for source "${catalogEntry.source}" (id "${buildingId}")`);
  }

  const mesh = await adapter.createMesh(x, y, { catalogEntry, rotationStep, assetManager });
  if (!mesh) {
    throw new Error(`[buildingAssets] No mesh produced for "${buildingId}" (source "${catalogEntry.source}")`);
  }
  return mesh;
}
