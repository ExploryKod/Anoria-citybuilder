/**
 * Minimal terrain catalog.
 * `surfaceY` is added to WORLD_PLATFORM_Y (walkable top ≈ 0.22, same as legacy grass cubes).
 */

const CLIFF_STONE_MATERIALS = Object.freeze({
  grass: 'nature:ground_grass',
  stone: 0xb8dce8,
});

/**
 * @param {string} glbName
 * @param {string[]} [tags]
 */
function cliffStoneEntry(glbName, tags = ['cliff', 'shore']) {
  return {
    kind: 'terrain',
    glb: `/resources/kenney_nature-kit/Models/GLTF format/${glbName}.glb`,
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
function flatGroundEntry(glbName, displayColor = 0x2fe7c5, tags = ['grass', 'flat']) {
  return {
    kind: 'terrain',
    glb: `/resources/kenney_nature-kit/Models/GLTF format/${glbName}.glb`,
    displayColor,
    surfaceY: 0.02,
    tier: 0,
    tags,
    legacyIds: [],
  };
}

export const TERRAIN_CATALOG = {
  'nature:ground_grass': {
    kind: 'terrain',
    glb: '/resources/kenney_nature-kit/Models/GLTF format/ground_grass.glb',
    /** Unlit scene color — shared by tiles, ground fill, fog, and CSS tokens. */
    displayColor: 0x2fe7c5,
    surfaceY: 0.02,
    tier: 0,
    tags: ['grass', 'flat'],
    legacyIds: ['grass'],
  },
  'nature:ground_pathStraight': flatGroundEntry('ground_pathStraight', 0xc4a574, ['path', 'ground']),
  'nature:ground_pathTile': flatGroundEntry('ground_pathTile', 0xc4a574, ['path', 'ground']),
  'nature:ground_riverStraight': flatGroundEntry('ground_riverStraight', 0x5ec4e8, ['water', 'ground']),
  'nature:platform_beach': {
    kind: 'terrain',
    glb: '/resources/kenney_nature-kit/Models/GLTF format/platform_beach.glb',
    displayColor: 0xf5d7bb,
    materialColors: {
      woodInner: 0xf5d7bb,
    },
    surfaceY: 0.02,
    tier: 0,
    tags: ['beach', 'shore'],
    legacyIds: [],
  },
  'nature:cliff_block_stone': cliffStoneEntry('cliff_block_stone'),
  'nature:cliff_corner_stone': cliffStoneEntry('cliff_corner_stone', ['cliff', 'shore', 'corner']),
  'nature:cliff_half_stone': cliffStoneEntry('cliff_half_stone'),
  'nature:cliff_steps_stone': cliffStoneEntry('cliff_steps_stone', ['cliff', 'shore', 'steps']),
  'nature:cliff_diagonal_stone': cliffStoneEntry('cliff_diagonal_stone'),
  'nature:cliff_cornerInner_stone': cliffStoneEntry('cliff_cornerInner_stone', [
    'cliff',
    'shore',
    'corner',
    'inner',
  ]),
};

/**
 * @param {string} terrainId
 * @returns {typeof TERRAIN_CATALOG[string] | undefined}
 */
export function getTerrainCatalogEntry(terrainId) {
  return TERRAIN_CATALOG[terrainId];
}
