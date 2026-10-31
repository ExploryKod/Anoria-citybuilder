import { kenneyNatureGlbUrl } from './editorKenneyCatalog.js';
import { KENNEY_NATURE_ASSETS } from './kenneyNatureKitManifest.generated.js';

const PROP_COLOR_BY_CATEGORY = Object.freeze({
  editorTrees: 0x2fe7c5,
  editorPlants: 0x6ecf8a,
  editorRockSmall: 0xb8dce8,
  editorRockLarge: 0xb8dce8,
  editorRockTall: 0xb8dce8,
  editorStoneSmall: 0xc8ccd0,
  editorStoneLarge: 0xc8ccd0,
  editorStoneTall: 0xc8ccd0,
  editorStumps: 0xa08060,
  editorStructures: 0xd4c4a8,
  editorDetails: 0xc9b896,
});

/**
 * @param {string} glbName
 * @param {string} categoryId
 */
function naturePropEntry(glbName, categoryId) {
  return {
    kind: 'nature-prop',
    glb: kenneyNatureGlbUrl(glbName),
    glbName,
    displayColor: PROP_COLOR_BY_CATEGORY[categoryId] ?? 0x8fd4c4,
    surfaceY: 0.02,
    tags: ['nature', 'prop', categoryId],
  };
}

/** @type {Record<string, ReturnType<typeof naturePropEntry>>} */
export const NATURE_PROP_CATALOG = Object.freeze(
  Object.fromEntries(
    KENNEY_NATURE_ASSETS
      .filter((asset) => asset.layer === 'prop')
      .map((asset) => [
        asset.toolId,
        naturePropEntry(asset.glbName, asset.categoryId),
      ])
  )
);

/**
 * What stands on a tile and stops a building from being placed there (it is not removed: the player is told the way is blocked): the trees, the rocks and
 * stones, the stumps, the structures (bridges, fences...) and the details (a bed, a canoe, a cactus). The plants (flowers, grass, mushrooms, moss) do not
 * stop anything, but the bushes (`plant_bush*`) do.
 */
const BLOCKING_PROP_CATEGORIES = Object.freeze(new Set([
  'editorTrees',
  'editorRockSmall',
  'editorRockLarge',
  'editorRockTall',
  'editorStoneSmall',
  'editorStoneLarge',
  'editorStoneTall',
  'editorStumps',
  'editorStructures',
  'editorDetails',
]));
const BLOCKING_PROP_GLB_PREFIXES = Object.freeze(['plant_bush']);

/**
 * @param {string} propId — e.g. `nature-prop:tree_simple`
 * @returns {boolean} whether this prop stops a building from being placed on its tile
 */
export function isBlockingNatureProp(propId) {
  const entry = NATURE_PROP_CATALOG[propId];
  if (!entry) {
    throw new Error(`[naturePropCatalog] "${propId}" is not a nature prop of the catalog`);
  }
  return entry.tags.some((tag) => BLOCKING_PROP_CATEGORIES.has(tag))
    || BLOCKING_PROP_GLB_PREFIXES.some((prefix) => entry.glbName.startsWith(prefix));
}

/**
 * @param {string} propId
 * @returns {typeof NATURE_PROP_CATALOG[string] | undefined}
 */
export function getNaturePropCatalogEntry(propId) {
  return NATURE_PROP_CATALOG[propId];
}

/**
 * @param {string} propId — e.g. `nature-prop:tree_simple`
 * @returns {string}
 */
export function resolveNaturePropGlbName(propId) {
  const entry = getNaturePropCatalogEntry(propId);
  if (entry?.glbName) return entry.glbName;
  return propId.replace(/^nature-prop:/, '');
}
