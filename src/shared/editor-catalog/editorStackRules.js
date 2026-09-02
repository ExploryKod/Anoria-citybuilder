import { EDITOR_TOOL_META } from './editorKenneyCatalog.js';
import { isEditorSeaTerrain } from '../terrain-catalog/editorSeaTerrain.js';

/** @typedef {import('./classifyKenneyNatureAsset.js').KenneyEditorCategoryDef['id'] | 'editorSea'} EditorStackParentCategory */

/** All stackable editor categories (terrain + nature tool groups). */
export const EDITOR_STACK_CATEGORY_IDS = Object.freeze([
  'editorGround',
  'editorRiver',
  'editorPlatform',
  'editorCliffQuarterRock',
  'editorCliffQuarterStone',
  'editorCliffHalfRock',
  'editorCliffHalfStone',
  'editorCliffRock',
  'editorCliffStone',
  'editorTrees',
  'editorPlants',
  'editorRockSmall',
  'editorRockLarge',
  'editorRockTall',
  'editorStoneSmall',
  'editorStoneLarge',
  'editorStoneTall',
  'editorStumps',
  'editorStructures',
  'editorDetails',
]);

/**
 * Parent categories that refuse most stacking (trees, small props, etc.).
 * Everything else accepts `*` — any editor category may be placed on top.
 *
 * @type {Readonly<Record<string, readonly string[]>>}
 */
export const CATEGORY_ACCEPTS_ON_TOP_RESTRICTED = Object.freeze({
  editorSea: ['*'],
  editorTrees: ['editorPlants', 'editorDetails'],
  editorPlants: ['editorDetails'],
  editorDetails: [],
});

/**
 * @param {string | null | undefined} toolId
 * @returns {string | null}
 */
export function getEditorAssetCategoryId(toolId) {
  if (!toolId) return null;
  return EDITOR_TOOL_META[toolId]?.categoryId ?? null;
}

/**
 * @param {EditorStackParentCategory} parentCategoryId
 * @returns {readonly string[]}
 */
export function getCategoryAcceptsOnTop(parentCategoryId) {
  const restricted = CATEGORY_ACCEPTS_ON_TOP_RESTRICTED[parentCategoryId];
  if (restricted) return restricted;
  return ['*'];
}

/**
 * @param {EditorStackParentCategory} parentCategoryId
 * @param {string} childCategoryId
 * @returns {boolean}
 */
export function canStackCategoryOnParent(parentCategoryId, childCategoryId) {
  if (!childCategoryId) return false;
  const accepts = getCategoryAcceptsOnTop(parentCategoryId);
  if (accepts.includes('*')) return true;
  return accepts.includes(childCategoryId);
}

/**
 * @param {string} childToolId
 * @param {EditorStackParentCategory} parentCategoryId
 * @returns {boolean}
 */
export function canPlaceEditorToolOnParent(childToolId, parentCategoryId) {
  const childCategoryId = getEditorAssetCategoryId(childToolId);
  if (!childCategoryId) return false;
  return canStackCategoryOnParent(parentCategoryId, childCategoryId);
}

/**
 * @param {string | null | undefined} terrainId
 * @returns {EditorStackParentCategory}
 */
export function terrainIdToParentCategory(terrainId) {
  if (isEditorSeaTerrain(terrainId)) {
    return 'editorSea';
  }
  const categoryId = getEditorAssetCategoryId(terrainId);
  return categoryId ?? 'editorGround';
}
