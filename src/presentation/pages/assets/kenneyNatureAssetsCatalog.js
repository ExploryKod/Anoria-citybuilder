/**
 * Kenney Nature Kit — full reference catalog for /assets (Isometric NE previews).
 */

import {
  KENNEY_NATURE_ASSETS,
  KENNEY_NATURE_EDITOR_CATEGORY_DEFS,
  KENNEY_NATURE_KIT_GLB_COUNT,
} from '../../../shared/editor-catalog/kenneyNatureKitManifest.generated.js';
import {
  KENNEY_EDITOR_TERRAIN_CATEGORY_DEFS,
  humanizeKenneyGlbName,
} from '../../../shared/editor-catalog/classifyKenneyNatureAsset.js';
import { kenneyNatureGlbUrl, kenneyNaturePreviewUrl } from '../../../shared/editor-catalog/editorKenneyCatalog.js';

/** @typedef {'terrains' | 'nature' | 'buildings' | 'decoration' | 'people'} AssetsPageFilterGroup */

export const KENNEY_NATURE_PACK_ID = 'kenney-nature-kit';
export const KENNEY_NATURE_PACK_LABEL = 'Kenney Nature Kit';

/** @type {ReadonlySet<string>} */
const TERRAIN_SECTION_IDS = new Set(
  KENNEY_EDITOR_TERRAIN_CATEGORY_DEFS.map((category) => category.id)
);

/** @type {ReadonlySet<string>} */
const NATURE_SECTION_IDS = new Set([
  'editorTrees',
  'editorPlants',
  'editorRockSmall',
  'editorRockLarge',
  'editorRockTall',
  'editorStoneSmall',
  'editorStoneLarge',
  'editorStoneTall',
  'editorStumps',
]);

/** @type {Readonly<Record<string, string>>} */
const SECTION_LABEL_BY_ID = Object.freeze(
  Object.fromEntries(
    KENNEY_NATURE_EDITOR_CATEGORY_DEFS.map((category) => [category.id, category.tooltip])
  )
);

/**
 * @param {{ categoryId: string, layer: string, glbName: string }} asset
 * @returns {AssetsPageFilterGroup}
 */
export function resolveKenneyNatureFilterGroup(asset) {
  if (TERRAIN_SECTION_IDS.has(asset.categoryId) || asset.layer === 'terrain') {
    return 'terrains';
  }
  if (NATURE_SECTION_IDS.has(asset.categoryId)) {
    return 'nature';
  }
  if (asset.categoryId === 'editorStructures') {
    return 'buildings';
  }
  if (/character|person|human|npc|villager|citizen/i.test(asset.glbName)) {
    return 'people';
  }
  return 'decoration';
}

/**
 * @returns {ReadonlyArray<{
 *   filterGroup: AssetsPageFilterGroup,
 *   packId: string,
 *   packLabel: string,
 *   sectionId: string,
 *   sectionLabel: string,
 *   items: ReadonlyArray<object>,
 * }>}
 */
export function buildKenneyNatureKitSections() {
  /** @type {Map<string, object[]>} */
  const itemsBySection = new Map();

  for (const asset of KENNEY_NATURE_ASSETS) {
    const bucket = itemsBySection.get(asset.categoryId) ?? [];
    bucket.push({
      id: asset.toolId,
      glbName: asset.glbName,
      displayName: humanizeKenneyGlbName(asset.glbName),
      shortLabel: asset.shortLabel,
      categoryId: asset.categoryId,
      layer: asset.layer,
      source: 'kenney-nature',
      filterGroup: resolveKenneyNatureFilterGroup(asset),
      packId: KENNEY_NATURE_PACK_ID,
      packLabel: KENNEY_NATURE_PACK_LABEL,
      previewUrl: kenneyNaturePreviewUrl(asset.glbName),
      kenneyGlbPath: kenneyNatureGlbUrl(asset.glbName),
      kenneyGlbFile: `${asset.glbName}.glb`,
    });
    itemsBySection.set(asset.categoryId, bucket);
  }

  return KENNEY_NATURE_EDITOR_CATEGORY_DEFS.flatMap((category) => {
    const items = itemsBySection.get(category.id);
    if (!items?.length) return [];

    items.sort((a, b) => a.glbName.localeCompare(b.glbName));

    return [{
      filterGroup: resolveKenneyNatureFilterGroup({
        categoryId: category.id,
        layer: TERRAIN_SECTION_IDS.has(category.id) ? 'terrain' : 'prop',
        glbName: items[0].glbName,
      }),
      packId: KENNEY_NATURE_PACK_ID,
      packLabel: KENNEY_NATURE_PACK_LABEL,
      sectionId: category.id,
      sectionLabel: SECTION_LABEL_BY_ID[category.id] ?? category.id,
      items: Object.freeze(items),
    }];
  });
}

export { KENNEY_NATURE_KIT_GLB_COUNT };
