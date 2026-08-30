/**
 * Assembles playable asset metadata for the /assets reference page.
 */

import {
  KENNEY_CITY_KIT_TOOL_META,
  KENNEY_CITY_KIT_TOOLS_BY_CATEGORY,
  KENNEY_CITY_KIT_PREFAB_BY_BUILDING_ID,
} from '../../../shared/building-catalog/kenneyCityKitRegistry.generated.js';
import { VILLAGE_PLAYABLE_TOOL_IDS_BY_CATEGORY, VILLAGE_NATURE_GAME_IDS, VILLAGE_NATURE_MESH_ALIASES } from '../../../shared/building-catalog/villageAssetSets.js';
import { buildingCatalog } from '../../../shared/building-catalog/buildingCatalog.js';

/** @type {Readonly<Record<string, string>>} */
const KENNEY_KIT_RESOURCE_DIRS = Object.freeze({
  commercial: 'kenney_city-kit-commercial_2.1',
  industrial: 'kenney_city-kit-industrial_1.0',
  suburban: 'kenney_city-kit-suburban_20',
});

/** @type {Readonly<Record<string, string>>} */
export const ASSET_CATEGORY_LABELS = Object.freeze({
  houses: 'Habitations',
  farms: 'Agriculture',
  industry: 'Industrie',
  markets: 'Commerce',
  infrastructure: 'Infrastructure & routes',
  nature: 'Nature',
  zones: 'Zones',
});

/** @type {readonly string[]} */
export const ASSET_CATEGORY_ORDER = Object.freeze([
  'houses',
  'farms',
  'industry',
  'markets',
  'infrastructure',
  'nature',
  'zones',
]);

/**
 * @param {string} prefabKey
 * @returns {string | null}
 */
function resolveKenneyGlbPath(prefabKey) {
  const [kitId, fileStem] = prefabKey.split(':');
  if (!kitId || !fileStem) return null;
  const resourceDir = KENNEY_KIT_RESOURCE_DIRS[kitId];
  if (!resourceDir) return null;
  return `/resources/${resourceDir}/Models/GLB format/${fileStem}.glb`;
}

/**
 * @returns {ReadonlyArray<{
 *   category: string,
 *   label: string,
 *   items: ReadonlyArray<{
 *     id: string,
 *     category: string,
 *     source: 'kenney' | 'village',
 *     displayName?: string,
 *     previewUrl?: string,
 *     kenneyPrefabKey?: string,
 *     kenneyGlbPath?: string | null,
 *     kitId?: string,
 *   }>,
 * }>}
 */
export function buildAssetsPageSections() {
  /** @type {Array<{ category: string, label: string, items: object[] }>} */
  const sections = [];

  for (const category of ASSET_CATEGORY_ORDER) {
    /** @type {object[]} */
    const items = [];
    const seen = new Set();

    const kenneyIds = KENNEY_CITY_KIT_TOOLS_BY_CATEGORY[category] || [];
    for (const id of kenneyIds) {
      const meta = KENNEY_CITY_KIT_TOOL_META[id];
      const prefabKey = KENNEY_CITY_KIT_PREFAB_BY_BUILDING_ID[id];
      if (!meta || !prefabKey) continue;

      const kenneyFile = prefabKey.split(':')[1];
      items.push({
        id,
        category,
        source: 'kenney',
        displayName: buildingCatalog[id]?.displayName ?? meta.shortLabel,
        previewUrl: meta.previewUrl,
        kenneyPrefabKey: prefabKey,
        kenneyGlbPath: resolveKenneyGlbPath(prefabKey),
        kenneyGlbFile: kenneyFile ? `${kenneyFile}.glb` : null,
        kitId: meta.kitId,
      });
      seen.add(id);
    }

    const villageIds = category === 'nature'
      ? VILLAGE_NATURE_GAME_IDS
      : (VILLAGE_PLAYABLE_TOOL_IDS_BY_CATEGORY[category] || []);
    for (const id of villageIds) {
      if (seen.has(id)) continue;
      const meshAssetId = VILLAGE_NATURE_MESH_ALIASES[id] ?? null;
      items.push({
        id,
        category,
        source: 'village',
        displayName: buildingCatalog[id]?.displayName ?? id,
        ...(meshAssetId ? { meshAssetId } : {}),
        ...(category === 'nature' ? { proceduralOnly: true } : {}),
      });
      seen.add(id);
    }

    if (items.length > 0) {
      sections.push({
        category,
        label: ASSET_CATEGORY_LABELS[category] ?? category,
        items: Object.freeze(items),
      });
    }
  }

  return Object.freeze(sections);
}

/**
 * @param {ReadonlyArray<{ items: ReadonlyArray<unknown> }>} sections
 */
export function countAssetsInSections(sections) {
  return sections.reduce((sum, section) => sum + section.items.length, 0);
}
