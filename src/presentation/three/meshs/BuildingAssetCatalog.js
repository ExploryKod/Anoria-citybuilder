import { buildingCatalog } from '../../../shared/building-catalog/buildingCatalog.js';
import { KENNEY_BUILDING_CATALOG_ENTRIES } from '../../../shared/building-catalog/kenneyCityKitRegistry.generated.js';

/**
 * Stable game-logic building id -> which adapter/asset renders it.
 *
 * This is the single source of truth for building-mesh resolution: every
 * placeable id has exactly one entry here, and placement code must not fall
 * back to any other routing heuristic (string prefixes, etc.) when an entry
 * is missing — a missing/broken entry is a bug to surface loudly, not a case
 * to route around silently.
 *
 * Only "which asset" lives here — never size/scale. Tile footprint
 * (`gridSize`) is a separate, game-logic fact and lives in
 * `src/shared/building-catalog/buildingCatalog.js`, under
 * `<id>.construction.gridSize`. After changing an entry below, look at the
 * building in the running scene and hand-adjust that file's `gridSize` to
 * match what you actually see — there is no automatic resizing.
 *
 * `adapter` picks which renderer resolves `asset`:
 *  - 'villageTown'   -> `asset` is a mesh/tool name inside village_town_assets_v2.glb
 *  - 'kenneyCityKit' -> `asset` is a Kenney building id (e.g. 'Kenney-Suburban-building-type-a')
 *
 * Every id from `buildingCatalog.js` and every id from the generated Kenney
 * registry gets a default identity entry (its own id, on its own current
 * source) below — that's what makes coverage automatic as either source
 * catalog grows. Override an entry's `adapter`/`asset` to reassign a stable
 * id to a different glb; nothing else in the codebase needs to change.
 */

function identityEntries(ids, adapter) {
  return Object.fromEntries(ids.map((id) => [id, { adapter, asset: id }]));
}

export const BUILDING_ASSET_CATALOG = Object.freeze({
  ...identityEntries(Object.keys(buildingCatalog), 'villageTown'),
  ...identityEntries(Object.keys(KENNEY_BUILDING_CATALOG_ENTRIES), 'kenneyCityKit'),

  // Overrides — reassign a stable id to a different source/asset here.
  // 'House-Blue': { adapter: 'kenneyCityKit', asset: 'Kenney-Suburban-building-type-a' },
});
