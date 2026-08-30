const GLB_BASE = '/resources/kenney_nature-kit/Models/GLTF format';
const PREVIEW_BASE = '/resources/kenney_nature-kit/Isometric';

/**
 * @param {string} glbName
 * @returns {string}
 */
export function kenneyNaturePreviewUrl(glbName) {
  return `${PREVIEW_BASE}/${glbName}_NE.png`;
}

/**
 * @param {string} glbName
 * @returns {string}
 */
export function kenneyNatureGlbUrl(glbName) {
  return `${GLB_BASE}/${glbName}.glb`;
}

/** @typedef {{ glbName: string, shortLabel: string, tooltip?: string }} EditorToolMeta */

/** Terrain paint tools — replace `city.tiles[x][y].terrainId` on the terrain layer. */
export const EDITOR_TERRAIN_TOOL_IDS = Object.freeze([
  'nature:ground_grass',
  'nature:ground_pathStraight',
  'nature:ground_pathTile',
  'nature:ground_riverStraight',
  'nature:platform_beach',
  'nature:cliff_block_stone',
  'nature:cliff_steps_stone',
]);

/** Nature prop tools — sparse objects on the `nature` layer above terrain. */
export const EDITOR_NATURE_TOOL_IDS = Object.freeze([
  'nature-prop:tree_pineDefaultA',
  'nature-prop:tree_simple',
  'nature-prop:rock_smallA',
  'nature-prop:rock_largeA',
]);

/** @type {Record<string, EditorToolMeta>} */
export const EDITOR_TOOL_META = Object.freeze({
  'nature:ground_grass': { glbName: 'ground_grass', shortLabel: 'Herbe', tooltip: 'Plateforme herbe' },
  'nature:ground_pathStraight': { glbName: 'ground_pathStraight', shortLabel: 'Chemin', tooltip: 'Chemin droit' },
  'nature:ground_pathTile': { glbName: 'ground_pathTile', shortLabel: 'Dalle chemin', tooltip: 'Dalle de chemin' },
  'nature:ground_riverStraight': { glbName: 'ground_riverStraight', shortLabel: 'Rivière', tooltip: 'Rivière droite' },
  'nature:platform_beach': { glbName: 'platform_beach', shortLabel: 'Plage', tooltip: 'Plateforme plage' },
  'nature:cliff_block_stone': { glbName: 'cliff_block_stone', shortLabel: 'Falaise', tooltip: 'Bloc falaise' },
  'nature:cliff_steps_stone': { glbName: 'cliff_steps_stone', shortLabel: 'Escalier', tooltip: 'Falaise en escalier' },
  'nature-prop:tree_pineDefaultA': { glbName: 'tree_pineDefaultA', shortLabel: 'Pin', tooltip: 'Pin' },
  'nature-prop:tree_simple': { glbName: 'tree_simple', shortLabel: 'Arbre', tooltip: 'Arbre simple' },
  'nature-prop:rock_smallA': { glbName: 'rock_smallA', shortLabel: 'Rocher S', tooltip: 'Petit rocher' },
  'nature-prop:rock_largeA': { glbName: 'rock_largeA', shortLabel: 'Rocher L', tooltip: 'Grand rocher' },
});

/** @type {Record<string, string>} toolId → preview URL */
export const EDITOR_TOOL_PREVIEW_URLS = Object.freeze(
  Object.fromEntries(
    Object.entries(EDITOR_TOOL_META).map(([toolId, meta]) => [
      toolId,
      kenneyNaturePreviewUrl(meta.glbName),
    ])
  )
);

export const EDITOR_TOOLS_BY_CATEGORY = Object.freeze({
  editorTerrain: EDITOR_TERRAIN_TOOL_IDS,
  editorNature: EDITOR_NATURE_TOOL_IDS,
});
