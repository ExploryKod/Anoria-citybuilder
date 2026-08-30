import { kenneyNatureGlbUrl } from './editorKenneyCatalog.js';
import { KENNEY_NATURE_ASSETS } from './kenneyNatureKitManifest.generated.js';

const PROP_COLOR_BY_CATEGORY = Object.freeze({
  editorTrees: 0x2fe7c5,
  editorPlants: 0x6ecf8a,
  editorRocks: 0xb8dce8,
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
