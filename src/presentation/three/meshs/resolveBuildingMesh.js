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
 * Resolves the catalog id that should actually render for a placed
 * building, given its own gameplay tier `level` — a declarative override,
 * not a naming convention: a catalog entry opts in via its own
 * `levelVariants: { [level]: otherId }` fact (see House-Red/Blue/Purple in
 * buildingAssets.js). No level, no `levelVariants` fact, or an unmapped
 * level all fall back to the base id unchanged — this is why every
 * existing (non-house) placeable id needs zero changes.
 *
 * @param {string} buildingId
 * @param {number} [level]
 * @returns {string}
 */
export function resolveVisualBuildingId(buildingId, level) {
  if (level == null) return buildingId;
  const variantId = ASSET_CATALOG[buildingId]?.levelVariants?.[level];
  return variantId && ASSET_CATALOG[variantId] ? variantId : buildingId;
}

/**
 * Catalog ids the S key cycles through for a tool, from its declarative
 * `selectableMeshes` fact — empty when the tool offers no choice.
 *
 * @param {string} toolId
 * @returns {readonly string[]}
 */
export function getSelectableMeshIds(toolId) {
  const ids = ASSET_CATALOG[toolId]?.selectableMeshes;
  return Array.isArray(ids) && ids.length > 1 ? ids : [];
}

/**
 * The catalog id actually placed/previewed for a tool once the player has
 * pressed S `selectionIndex` times (wraps around). No `selectableMeshes` fact
 * or an unknown entry falls back to the tool id unchanged.
 *
 * @param {string} toolId
 * @param {number} [selectionIndex]
 * @returns {string}
 */
export function resolveSelectedMeshId(toolId, selectionIndex = 0) {
  const ids = getSelectableMeshIds(toolId);
  if (ids.length === 0) return toolId;
  const id = ids[((selectionIndex % ids.length) + ids.length) % ids.length];
  return ASSET_CATALOG[id] ? id : toolId;
}

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
 * @param {number} [params.level] House tier — see `resolveVisualBuildingId`.
 * @param {object} params.assetManager - the SceneAssetManager instance
 * @returns {Promise<import('three').Object3D>}
 */
export async function resolveAndCreateBuildingMesh({ buildingId, x, y, rotationStep = 0, level, assetManager }) {
  const visualBuildingId = resolveVisualBuildingId(buildingId, level);
  const catalogEntry = ASSET_CATALOG[visualBuildingId];
  if (!catalogEntry) {
    throw new Error(`[buildingAssets] No catalog entry for "${visualBuildingId}"`);
  }

  const adapter = getBuildingSourceAdapter(catalogEntry.source);
  if (!adapter) {
    throw new Error(`[buildingAssets] No adapter registered for source "${catalogEntry.source}" (id "${visualBuildingId}")`);
  }

  const mesh = await adapter.createMesh(x, y, { catalogEntry, buildingId: visualBuildingId, rotationStep, assetManager });
  if (!mesh) {
    throw new Error(`[buildingAssets] No mesh produced for "${visualBuildingId}" (source "${catalogEntry.source}")`);
  }
  return mesh;
}
