import { kenneyNatureGlbUrl } from './editorKenneyCatalog.js';

/**
 * @param {string} glbName
 * @param {number} [displayColor=0x8fd4c4]
 */
function naturePropEntry(glbName, displayColor = 0x8fd4c4) {
  return {
    kind: 'nature-prop',
    glb: kenneyNatureGlbUrl(glbName),
    glbName,
    displayColor,
    surfaceY: 0.02,
    tags: ['nature', 'prop'],
  };
}

export const NATURE_PROP_CATALOG = Object.freeze({
  'nature-prop:tree_pineDefaultA': naturePropEntry('tree_pineDefaultA', 0x2fe7c5),
  'nature-prop:tree_simple': naturePropEntry('tree_simple', 0x2fe7c5),
  'nature-prop:rock_smallA': naturePropEntry('rock_smallA', 0xb8dce8),
  'nature-prop:rock_largeA': naturePropEntry('rock_largeA', 0xb8dce8),
});

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
