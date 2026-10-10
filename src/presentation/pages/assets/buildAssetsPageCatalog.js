/**
 * Assembles asset metadata for the /assets reference page.
 */

import {
  KENNEY_BUILDING_CATALOG_ENTRIES,
  KENNEY_CITY_KIT_TOOL_META,
  KENNEY_CITY_KIT_TOOLS_BY_CATEGORY,
  KENNEY_CITY_KIT_PREFAB_BY_BUILDING_ID,
} from '../../../shared/building-catalog/kenneyCityKitRegistry.generated.js';
import {
  ASSET_IDS_BY_CATEGORY,
  HOUSE_MODEL_GROUPS,
  NATURE_GAME_IDS,
  NATURE_MESH_ALIASES,
} from '../../../shared/building-catalog/assetIdsByCategory.js';
import { buildingCatalog } from '../../../shared/building-catalog/buildingCatalog.js';
import { resolveFootprint } from '../../../shared/asset-footprint/resolveFootprint.js';
import { BUILDING_ASSETS } from '../../three/assets/buildingAssets.js';
import { resolveVisualBuildingId } from '../../three/meshs/resolveBuildingMesh.js';
import { SOCIAL_CATEGORY } from '../../../shared/population/socialCategoryCatalog.js';
import { buildingName } from '../../dom/shell/CatalogVocabulary.js';
import { NATURE_ASSETS } from '../../three/assets/natureAssets.js';
import {
  buildKenneyNatureKitSections,
  KENNEY_NATURE_PACK_ID,
  KENNEY_NATURE_PACK_LABEL,
} from './kenneyNatureAssetsCatalog.js';
import { PLAYABLE_CATEGORY_FILTER_GROUP } from './assetsPageFilters.js';

/** @type {Readonly<Record<string, string>>} */
const KENNEY_KIT_RESOURCE_DIRS = Object.freeze({
  commercial: 'kenney_city-kit-commercial_2.1',
  industrial: 'kenney_city-kit-industrial_1.0',
  suburban: 'kenney_city-kit-suburban_20',
});

export const KENNEY_CITY_PACK_ID = 'kenney-city-kits';
export const KENNEY_CITY_PACK_LABEL = 'Kenney City Kits';
export const KENNEY_ROAD_PACK_ID = 'kenney-city-roads';
export const KENNEY_ROAD_PACK_LABEL = 'Kenney City Kit Roads';
export const KENNEY_FARM_PACK_ID = 'kenney-farm-field';
export const KENNEY_FARM_PACK_LABEL = 'Kenney Nature Kit (champs)';
export const SCENE_TILE_PACK_ID = 'scene-tiles';
export const SCENE_TILE_PACK_LABEL = 'Sol procédural (tuiles de scène)';

/** Display order of the playable packs (nature kit sections stay first). */
const PLAYABLE_PACK_ORDER = Object.freeze([
  KENNEY_NATURE_PACK_ID,
  KENNEY_CITY_PACK_ID,
  KENNEY_ROAD_PACK_ID,
  KENNEY_FARM_PACK_ID,
  SCENE_TILE_PACK_ID,
]);

const PACK_LABELS = Object.freeze({
  [KENNEY_NATURE_PACK_ID]: KENNEY_NATURE_PACK_LABEL,
  [KENNEY_CITY_PACK_ID]: KENNEY_CITY_PACK_LABEL,
  [KENNEY_ROAD_PACK_ID]: KENNEY_ROAD_PACK_LABEL,
  [KENNEY_FARM_PACK_ID]: KENNEY_FARM_PACK_LABEL,
  [SCENE_TILE_PACK_ID]: SCENE_TILE_PACK_LABEL,
});

/** @type {Readonly<Record<string, string>>} */
export const ASSET_CATEGORY_LABELS = Object.freeze({
  houses: 'Habitations',
  farms: 'Agriculture',
  industry: 'Industrie',
  markets: 'Commerce',
  infrastructure: 'Infrastructure & routes',
  nature: 'Nature procédurale',
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
 * What a kit model covers on the ground: its own measured size and the grid it rounds up to, and the plot
 * the game reserves for `gameId` (the same thing for a raw kit id, a larger one for a house).
 *
 * @param {string} gameId
 * @param {string} kenneyBuildingId
 */
function describeKitFootprint(gameId, kenneyBuildingId) {
  const meta = KENNEY_CITY_KIT_TOOL_META[kenneyBuildingId];
  const grid = KENNEY_BUILDING_CATALOG_ENTRIES[kenneyBuildingId]?.construction;
  if (!meta?.meshSize || !grid) {
    throw new Error(`[assets page] no measured size for the Kenney model "${kenneyBuildingId}" (run pnpm run kenney:scan-city-kits)`);
  }
  const plot = resolveFootprint(gameId);
  return {
    meshSize: meta.meshSize,
    meshGrid: { width: grid.footprintWidth, depth: grid.footprintDepth },
    plot,
  };
}

/**
 * Builds a page item for an id from the mesh-source facts in BUILDING_ASSETS
 * (the single declarative source of truth), so the page follows whichever
 * pack an id is currently rendered from.
 *
 * @param {string} id
 * @param {string} category
 * @param {string} filterGroup
 * @returns {object}
 */
function buildItemFromCatalogEntry(id, category, filterGroup) {
  const entry = BUILDING_ASSETS[id] ?? NATURE_ASSETS[id];
  const displayName = buildingCatalog[id]?.displayName ?? id;

  if (entry?.source === 'kenneyCityKit') {
    const kenneyBuildingId = entry.geometry.buildingId;
    const prefabKey = KENNEY_CITY_KIT_PREFAB_BY_BUILDING_ID[kenneyBuildingId] ?? null;
    return {
      id,
      category,
      source: 'kenney-city',
      filterGroup,
      packId: KENNEY_CITY_PACK_ID,
      packLabel: KENNEY_CITY_PACK_LABEL,
      displayName,
      previewUrl: KENNEY_CITY_KIT_TOOL_META[kenneyBuildingId]?.previewUrl ?? null,
      kenneyPrefabKey: prefabKey,
      kenneyGlbPath: prefabKey ? resolveKenneyGlbPath(prefabKey) : null,
      kenneyGlbFile: prefabKey ? `${prefabKey.split(':')[1]}.glb` : null,
      kitId: entry.geometry.kit,
      usesKenneyId: kenneyBuildingId,
      ...describeKitFootprint(id, kenneyBuildingId),
    };
  }

  if (entry?.source === 'kenneyFarmField') {
    const groundGlb = entry.geometry.glb;
    return {
      id,
      category,
      source: 'kenney-farm',
      filterGroup,
      packId: KENNEY_FARM_PACK_ID,
      packLabel: KENNEY_FARM_PACK_LABEL,
      displayName,
      glbUrl: groundGlb,
      kenneyGlbPath: groundGlb,
      kenneyGlbFile: groundGlb.split('/').pop(),
      cropGlbFile: [
        ...new Set(
          Object.values(entry.crop?.stages ?? {})
            .map((stageConfig) => (stageConfig?.glb ?? entry.crop?.glb)?.split('/').pop())
            .filter(Boolean),
        ),
      ].join(', ') || null,
      kitId: 'farm-field',
    };
  }

  if (entry?.source === 'kenneyGlb') {
    const glbPath = entry.geometry.glb;
    const glbFile = glbPath.split('/').pop();
    const isNature = (entry.tags ?? []).includes('nature');
    return {
      id,
      category,
      source: isNature ? 'kenney-nature' : 'kenney-road',
      filterGroup,
      packId: isNature ? KENNEY_NATURE_PACK_ID : KENNEY_ROAD_PACK_ID,
      packLabel: isNature ? KENNEY_NATURE_PACK_LABEL : KENNEY_ROAD_PACK_LABEL,
      displayName,
      // Nature-kit pieces have Kenney's own Isometric previews; road pieces are
      // rendered from the GLB.
      ...(isNature
        ? { previewUrl: `/resources/kenney_nature-kit/Isometric/${glbFile.replace(/\.glb$/, '')}_NE.png` }
        : { glbUrl: glbPath }),
      ...(isNature && category === 'nature' ? { proceduralOnly: true } : {}),
      kenneyGlbPath: glbPath,
      kenneyGlbFile: glbFile,
      kitId: isNature ? 'nature' : 'roads',
    };
  }

  const meshAssetId = NATURE_MESH_ALIASES[id] ?? null;
  return {
    id,
    category,
    source: 'scene-tile',
    filterGroup,
    packId: SCENE_TILE_PACK_ID,
    packLabel: SCENE_TILE_PACK_LABEL,
    displayName,
    ...(meshAssetId ? { meshAssetId } : {}),
    ...(category === 'nature' ? { proceduralOnly: true } : {}),
  };
}

const UNCLASSIFIED_HOUSE_GROUP = Object.freeze({ id: 'unclassified', label: 'Modèles de maison non classés' });

/**
 * For each house model, the game's houses that wear it and at which levels: what `resolveVisualBuildingId`
 * answers for every level of every house (a level with no variant of its own wears the house's base model).
 *
 * @returns {Map<string, Array<{ houseName: string, levels: number[] }>>}
 */
function buildHouseModelUsage() {
  /** @type {Map<string, Map<string, number[]>>} */
  const levelsByModel = new Map();
  for (const [houseId, definition] of Object.entries(buildingCatalog)) {
    const group = definition.residentialGroup;
    if (!group) continue;
    const houseName = buildingName(houseId);
    for (const level of Object.keys(SOCIAL_CATEGORY[group].tiers).map(Number)) {
      const modelId = BUILDING_ASSETS[resolveVisualBuildingId(houseId, level)].geometry.buildingId;
      if (!levelsByModel.has(modelId)) levelsByModel.set(modelId, new Map());
      const byHouse = levelsByModel.get(modelId);
      byHouse.set(houseName, [...(byHouse.get(houseName) ?? []), level]);
    }
  }
  return new Map(
    [...levelsByModel].map(([modelId, byHouse]) => [
      modelId,
      [...byHouse].map(([houseName, levels]) => ({ houseName, levels })),
    ]),
  );
}

/**
 * Splits the houses of a pack by kind of house (`HOUSE_MODEL_GROUPS`). A
 * model in no group lands in a visibly named "unclassified" group so it gets classified, rather than hiding in one of the others.
 *
 * @param {ReadonlyArray<{ id: string }>} items
 * @returns {Array<{ sectionId: string, sectionLabel: string, items: object[] }>}
 */
function splitHousesByModelGroup(items) {
  const groupOfId = new Map();
  for (const group of HOUSE_MODEL_GROUPS) {
    for (const assetId of group.assetIds) groupOfId.set(assetId, group);
  }
  const usage = buildHouseModelUsage();
  const groupOf = (item) => groupOfId.get(item.id) ?? UNCLASSIFIED_HOUSE_GROUP;
  const groups = [...HOUSE_MODEL_GROUPS, UNCLASSIFIED_HOUSE_GROUP];
  return groups
    .map((group) => ({
      sectionId: `houses-${group.id}`,
      sectionLabel: group.label,
      items: items
        .filter((item) => groupOf(item) === group)
        .map((item) => ({ ...item, usedBy: usage.get(item.id) ?? [] })),
    }))
    .filter((section) => section.items.length > 0);
}

/**
 * @returns {ReadonlyArray<{
 *   filterGroup: import('./assetsPageFilters.js').AssetsPageFilterGroup,
 *   packId: string,
 *   packLabel: string,
 *   sectionId: string,
 *   sectionLabel: string,
 *   items: ReadonlyArray<object>,
 * }>}
 */
function buildPlayableAssetSections() {
  /** @type {Array<object>} */
  const sections = [];

  for (const category of ASSET_CATEGORY_ORDER) {
    /** @type {object[]} */
    const items = [];
    const seen = new Set();
    const filterGroup = PLAYABLE_CATEGORY_FILTER_GROUP[category] ?? 'buildings';

    const kenneyIds = KENNEY_CITY_KIT_TOOLS_BY_CATEGORY[category] || [];
    for (const id of kenneyIds) {
      const meta = KENNEY_CITY_KIT_TOOL_META[id];
      const prefabKey = KENNEY_CITY_KIT_PREFAB_BY_BUILDING_ID[id];
      if (!meta || !prefabKey) continue;

      const kenneyFile = prefabKey.split(':')[1];
      items.push({
        id,
        category,
        source: 'kenney-city',
        filterGroup,
        packId: KENNEY_CITY_PACK_ID,
        packLabel: KENNEY_CITY_PACK_LABEL,
        displayName: buildingCatalog[id]?.displayName ?? meta.shortLabel,
        previewUrl: meta.previewUrl,
        kenneyPrefabKey: prefabKey,
        kenneyGlbPath: resolveKenneyGlbPath(prefabKey),
        kenneyGlbFile: kenneyFile ? `${kenneyFile}.glb` : null,
        kitId: meta.kitId,
        ...describeKitFootprint(id, id),
      });
      seen.add(id);
    }

    const categoryIds = category === 'nature'
      ? NATURE_GAME_IDS
      : (ASSET_IDS_BY_CATEGORY[category] || []);
    for (const id of categoryIds) {
      if (seen.has(id)) continue;
      items.push(buildItemFromCatalogEntry(id, category, filterGroup));
      seen.add(id);
    }

    // One section per pack inside a category (e.g. infrastructure mixes Kenney
    // roads and the procedural ground tiles).
    for (const packId of PLAYABLE_PACK_ORDER) {
      const packItems = items.filter((item) => item.packId === packId);
      if (packItems.length === 0) continue;
      if (category === 'houses' && packId === KENNEY_CITY_PACK_ID) {
        // The game's own house ids (one per social category) are not cards of their own: each model's card says
        // which of them wear it, and at which levels.
        const modelItems = packItems.filter((item) => KENNEY_CITY_KIT_TOOLS_BY_CATEGORY.houses.includes(item.id));
        for (const houseSection of splitHousesByModelGroup(modelItems)) {
          sections.push({
            filterGroup,
            packId,
            packLabel: PACK_LABELS[packId],
            sectionId: houseSection.sectionId,
            sectionLabel: houseSection.sectionLabel,
            items: Object.freeze(houseSection.items),
          });
        }
        continue;
      }
      sections.push({
        filterGroup,
        packId,
        packLabel: PACK_LABELS[packId],
        sectionId: category,
        sectionLabel: ASSET_CATEGORY_LABELS[category] ?? category,
        items: Object.freeze(packItems),
      });
    }
  }

  // Group by pack (not just by category) so each pack header is printed once.
  sections.sort(
    (a, b) => PLAYABLE_PACK_ORDER.indexOf(a.packId) - PLAYABLE_PACK_ORDER.indexOf(b.packId),
  );

  return Object.freeze(sections);
}

/**
 * @returns {ReadonlyArray<{
 *   filterGroup: import('./assetsPageFilters.js').AssetsPageFilterGroup,
 *   packId: string,
 *   packLabel: string,
 *   sectionId: string,
 *   sectionLabel: string,
 *   items: ReadonlyArray<object>,
 * }>}
 */
export function buildAssetsPageSections() {
  return Object.freeze([
    ...buildKenneyNatureKitSections(),
    ...buildPlayableAssetSections(),
  ]);
}

/**
 * @param {ReadonlyArray<{ items: ReadonlyArray<unknown> }>} sections
 */
export function countAssetsInSections(sections) {
  return sections.reduce((sum, section) => sum + section.items.length, 0);
}
