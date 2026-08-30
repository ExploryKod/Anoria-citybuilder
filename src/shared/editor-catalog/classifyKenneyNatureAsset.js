/** @typedef {'terrain' | 'prop'} KenneyEditorLayer */

/**
 * @typedef {object} KenneyEditorCategoryDef
 * @property {string} id
 * @property {string} icon — emoji / ASCII shown on the pill (no text)
 * @property {string} tooltip — `title` + `aria-label` on the pill
 * @property {'terrain' | 'nature'} fabGroup
 */

/** Terrain paint tools — opened from the terrain FAB only. */
export const KENNEY_EDITOR_TERRAIN_CATEGORY_DEFS = Object.freeze([
  { id: 'editorGround', icon: '🟩', tooltip: 'Terrain', fabGroup: 'terrain' },
  { id: 'editorPath', icon: '🛤', tooltip: 'Chemins', fabGroup: 'terrain' },
  { id: 'editorRiver', icon: '💧', tooltip: 'Eau', fabGroup: 'terrain' },
  { id: 'editorPlatform', icon: '🏖', tooltip: 'Plateformes', fabGroup: 'terrain' },
  { id: 'editorCliff', icon: '⛰', tooltip: 'Falaises', fabGroup: 'terrain' },
]);

/** Nature prop tools — opened from the nature FAB only. */
export const KENNEY_EDITOR_NATURE_CATEGORY_DEFS = Object.freeze([
  { id: 'editorTrees', icon: '🌲', tooltip: 'Arbres', fabGroup: 'nature' },
  { id: 'editorPlants', icon: '🌿', tooltip: 'Plantes', fabGroup: 'nature' },
  { id: 'editorRocks', icon: '🪨', tooltip: 'Rochers', fabGroup: 'nature' },
  { id: 'editorStructures', icon: '🏗', tooltip: 'Structures', fabGroup: 'nature' },
  { id: 'editorDetails', icon: '🧺', tooltip: 'Détails', fabGroup: 'nature' },
]);

export const KENNEY_EDITOR_CATEGORY_DEFS = Object.freeze([
  ...KENNEY_EDITOR_TERRAIN_CATEGORY_DEFS,
  ...KENNEY_EDITOR_NATURE_CATEGORY_DEFS,
]);

/**
 * @param {string} glbName
 * @returns {{ categoryId: string, layer: KenneyEditorLayer }}
 */
export function classifyKenneyGlbName(glbName) {
  if (glbName.startsWith('cliff_')) {
    return { categoryId: 'editorCliff', layer: 'terrain' };
  }
  if (glbName.startsWith('platform_')) {
    return { categoryId: 'editorPlatform', layer: 'terrain' };
  }
  if (glbName.startsWith('ground_river')) {
    return { categoryId: 'editorRiver', layer: 'terrain' };
  }
  if (glbName.startsWith('ground_path')) {
    return { categoryId: 'editorPath', layer: 'terrain' };
  }
  if (glbName.startsWith('ground_')) {
    return { categoryId: 'editorGround', layer: 'terrain' };
  }
  if (glbName.startsWith('tree_')) {
    return { categoryId: 'editorTrees', layer: 'prop' };
  }
  if (
    glbName.startsWith('plant_')
    || glbName === 'grass'
    || glbName.startsWith('grass_')
    || glbName.startsWith('flower_')
    || glbName.startsWith('mushroom_')
    || glbName.startsWith('hanging_')
    || glbName.startsWith('lily_')
  ) {
    return { categoryId: 'editorPlants', layer: 'prop' };
  }
  if (
    glbName.startsWith('rock_')
    || glbName.startsWith('stone_')
    || glbName.startsWith('stump_')
  ) {
    return { categoryId: 'editorRocks', layer: 'prop' };
  }
  if (
    glbName.startsWith('bridge_')
    || glbName.startsWith('fence_')
    || glbName.startsWith('path_')
    || glbName.startsWith('tent_')
    || glbName.startsWith('campfire_')
    || glbName.startsWith('statue_')
    || glbName === 'sign'
  ) {
    return { categoryId: 'editorStructures', layer: 'prop' };
  }
  return { categoryId: 'editorDetails', layer: 'prop' };
}

/**
 * @param {KenneyEditorLayer} layer
 * @param {string} glbName
 * @returns {string}
 */
export function kenneyGlbToToolId(layer, glbName) {
  return layer === 'terrain' ? `nature:${glbName}` : `nature-prop:${glbName}`;
}

/**
 * @param {string} glbName
 * @returns {string}
 */
export function humanizeKenneyGlbName(glbName) {
  const spaced = glbName
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ');
  const words = spaced.split(' ').filter(Boolean);
  const label = words
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
  return label.length > 22 ? `${label.slice(0, 20)}…` : label;
}

/**
 * @param {string} categoryId
 * @returns {KenneyEditorCategoryDef | undefined}
 */
export function getKenneyEditorCategoryDef(categoryId) {
  return KENNEY_EDITOR_CATEGORY_DEFS.find((entry) => entry.id === categoryId);
}

/**
 * @param {'terrain' | 'nature'} fabGroup
 * @returns {readonly KenneyEditorCategoryDef[]}
 */
export function getKenneyEditorCategoriesForFabGroup(fabGroup) {
  return fabGroup === 'terrain'
    ? KENNEY_EDITOR_TERRAIN_CATEGORY_DEFS
    : KENNEY_EDITOR_NATURE_CATEGORY_DEFS;
}

/**
 * @param {'terrain' | 'nature'} fabGroup
 * @returns {string}
 */
export function getDefaultCategoryForFabGroup(fabGroup) {
  const categories = getKenneyEditorCategoriesForFabGroup(fabGroup);
  return categories[0]?.id ?? 'editorGround';
}
