import { kenneyNatureGlbUrl } from '../editor-catalog/editorKenneyCatalog.js';
import { KENNEY_NATURE_ASSETS } from '../editor-catalog/kenneyNatureKitManifest.generated.js';

const CLIFF_STONE_MATERIALS = Object.freeze({
  grass: 'nature:ground_grass',
  stone: 0xb8dce8,
});

/**
 * @param {string} glbName
 * @param {string[]} [tags]
 */
function cliffStoneEntry(glbName, tags = ['cliff', 'shore', 'editor']) {
  return {
    kind: 'terrain',
    glb: kenneyNatureGlbUrl(glbName),
    displayColor: 0xb8dce8,
    materialColors: CLIFF_STONE_MATERIALS,
    surfaceY: 0.02,
    tier: 0,
    tags,
    legacyIds: [],
  };
}

/**
 * @param {string} glbName
 * @param {number} displayColor
 * @param {string[]} [tags]
 */
function flatGroundEntry(glbName, displayColor = 0x2fe7c5, tags = ['grass', 'flat', 'editor']) {
  return {
    kind: 'terrain',
    glb: kenneyNatureGlbUrl(glbName),
    displayColor,
    surfaceY: 0.02,
    tier: 0,
    tags,
    legacyIds: [],
  };
}

/**
 * @param {string} glbName
 */
function buildKenneyTerrainCatalogEntry(glbName) {
  if (glbName.startsWith('cliff_')) {
    const tags = ['cliff', 'editor'];
    if (glbName.includes('corner') || glbName.includes('diagonal') || glbName.includes('half')) {
      tags.push('shore');
    }
    if (glbName.includes('steps')) tags.push('steps');
    return cliffStoneEntry(glbName, tags);
  }

  if (glbName === 'platform_beach') {
    return {
      kind: 'terrain',
      glb: kenneyNatureGlbUrl(glbName),
      displayColor: 0xf5d7bb,
      materialColors: { woodInner: 0xf5d7bb },
      surfaceY: 0.02,
      tier: 0,
      tags: ['beach', 'shore', 'editor'],
      legacyIds: [],
    };
  }

  if (glbName.includes('river') || glbName.startsWith('lily_')) {
    // Mount rules: editorKenneyAssetBehavior.js (surface + verticalFace on large cliffs).
    return flatGroundEntry(glbName, 0x5ec4e8, ['water', 'ground', 'editor']);
  }

  if (glbName.includes('path') || glbName.startsWith('path_')) {
    return flatGroundEntry(glbName, 0xc4a574, ['path', 'ground', 'editor']);
  }

  if (glbName === 'ground_grass' || glbName === 'platform_grass') {
    return {
      kind: 'terrain',
      glb: kenneyNatureGlbUrl(glbName),
      displayColor: 0x2fe7c5,
      surfaceY: 0.02,
      tier: 0,
      tags: ['grass', 'flat', 'editor'],
      legacyIds: glbName === 'ground_grass' ? ['grass'] : [],
    };
  }

  if (glbName === 'platform_stone') {
    return flatGroundEntry(glbName, 0xb8dce8, ['stone', 'platform', 'editor']);
  }

  return flatGroundEntry(glbName, 0x2fe7c5, ['ground', 'editor']);
}

/** Gameplay + shore autotile terrains that must be warm on boot. */
const CORE_TERRAIN_OVERRIDES = Object.freeze({
  'nature:ground_grass': {
    kind: 'terrain',
    glb: kenneyNatureGlbUrl('ground_grass'),
    displayColor: 0x2fe7c5,
    surfaceY: 0.02,
    tier: 0,
    tags: ['grass', 'flat', 'core'],
    legacyIds: ['grass'],
  },
  'nature:cliff_corner_stone': cliffStoneEntry('cliff_corner_stone', ['cliff', 'shore', 'corner', 'core']),
  'nature:cliff_half_stone': cliffStoneEntry('cliff_half_stone', ['cliff', 'shore', 'core']),
  'nature:cliff_diagonal_stone': cliffStoneEntry('cliff_diagonal_stone', ['cliff', 'shore', 'core']),
  'nature:cliff_cornerInner_stone': cliffStoneEntry('cliff_cornerInner_stone', [
    'cliff',
    'shore',
    'corner',
    'inner',
    'core',
  ]),
});

const manifestTerrainEntries = Object.fromEntries(
  KENNEY_NATURE_ASSETS
    .filter((asset) => asset.layer === 'terrain')
    .map((asset) => [asset.toolId, buildKenneyTerrainCatalogEntry(asset.glbName)])
);

export const TERRAIN_CATALOG = Object.freeze({
  ...manifestTerrainEntries,
  ...CORE_TERRAIN_OVERRIDES,
});

/** Terrains preloaded before the first frame (island shore + default grass). */
export const TERRAIN_PRELOAD_IDS = Object.freeze(
  Object.entries(TERRAIN_CATALOG)
    .filter(([, entry]) => entry.tags?.includes('core') || entry.legacyIds?.includes('grass'))
    .map(([terrainId]) => terrainId)
);

/**
 * @param {string} terrainId
 * @returns {typeof TERRAIN_CATALOG[string] | undefined}
 */
export function getTerrainCatalogEntry(terrainId) {
  return TERRAIN_CATALOG[terrainId];
}
