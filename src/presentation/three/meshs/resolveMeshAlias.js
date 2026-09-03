import { BUILDING_ASSETS } from '../assets/buildingAssets.js';
import { NATURE_ASSETS } from '../assets/natureAssets.js';
import { TERRAIN_ASSETS } from '../assets/terrainAssets.js';
import { VILLAGE_NATURE_MESH_ALIASES } from '../../../shared/building-catalog/villageAssetSets.js';

/**
 * Same merge resolveBuildingMesh.js exposes as ASSET_CATALOG — duplicated
 * locally (not imported from there) to avoid pulling in that module's
 * adapter-registration side effect for what is just a plain id/alias read.
 */
const ASSET_CATALOG = { ...BUILDING_ASSETS, ...NATURE_ASSETS, ...TERRAIN_ASSETS };

/**
 * Resolves a raw GLB mesh name (or a logical placement id like Tree-Sapin)
 * to its canonical catalog id, reading straight off each entry's
 * geometry.aliases — no separate name→id table to keep in sync with the
 * catalog by hand.
 *
 * @param {string} rawName
 * @returns {string} the canonical id, or rawName unchanged if nothing matches
 */
export function resolveMeshAlias(rawName) {
  if (!rawName) return rawName;

  // Checked first: 'Tree-Sapin' etc. are ALSO their own catalog entries (editor
  // buttons), but VillageTownAssetManager's mesh factories are only registered
  // under the canonical mesh id (Tree-Pine-001) — the logical name must resolve
  // there, not short-circuit on having a catalog entry of its own.
  if (VILLAGE_NATURE_MESH_ALIASES[rawName]) return VILLAGE_NATURE_MESH_ALIASES[rawName];

  if (ASSET_CATALOG[rawName]) return rawName;

  for (const [id, entry] of Object.entries(ASSET_CATALOG)) {
    if (entry.geometry?.aliases?.includes(rawName)) {
      return id;
    }
  }

  // A numbered GLB variant not individually enumerated in an id's aliases
  // (e.g. a Tree_Pine043 the catalog doesn't list) still resolves off its
  // base alias (Tree_Pine) — same prefix rule the old table-based parser used.
  for (const [id, entry] of Object.entries(ASSET_CATALOG)) {
    for (const alias of entry.geometry?.aliases ?? []) {
      if (alias.length >= 4 && rawName.startsWith(alias)) {
        const next = rawName[alias.length];
        if (!next || /\d/.test(next) || next === '_') {
          return id;
        }
      }
    }
  }

  return rawName;
}
