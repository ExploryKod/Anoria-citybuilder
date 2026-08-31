/**
 * Editor asset behavior catalog — mount modes, vertical-face hosts, stacking rules.
 * (Distinct from Isometric PNG previews and from /assets reference page.)
 */

import { getEditorAssetCategoryId } from './editorStackRules.js';
import {
  getCliffMaterial,
  isCliffHalfFootprint,
  isCliffQuarterFootprint,
  isKenneyCliffGlbName,
} from './classifyKenneyCliff.js';

/** @typedef {'surface' | 'verticalFace'} EditorAssetMountMode */

/** @typedef {'north' | 'east' | 'south' | 'west'} EditorVerticalFaceDirection */

/** Categories whose props may graft onto a vertical cliff face (e.g. river → waterfall). */
export const VERTICAL_FACE_MOUNT_CHILD_CATEGORIES = Object.freeze(['editorRiver']);

/**
 * Cliff carousel categories that expose vertical faces for river grafting.
 * Quarter-footprint cliffs are excluded (too small).
 */
export const VERTICAL_FACE_HOST_CATEGORY_IDS = Object.freeze([
  'editorCliffHalfRock',
  'editorCliffHalfStone',
  'editorCliffRock',
  'editorCliffStone',
]);

/** @type {Readonly<Record<EditorVerticalFaceDirection, string>>} */
export const VERTICAL_FACE_DIRECTION_LABELS = Object.freeze({
  north: 'Face nord (+Z)',
  east: 'Face est (+X)',
  south: 'Face sud (−Z)',
  west: 'Face ouest (−X)',
});

/**
 * @param {string} assetId
 * @returns {string}
 */
export function resolveKenneyGlbNameFromAssetId(assetId) {
  if (assetId.startsWith('nature-prop:')) {
    return assetId.slice('nature-prop:'.length);
  }
  if (assetId.startsWith('nature:')) {
    return assetId.slice('nature:'.length);
  }
  return assetId;
}

/**
 * @param {string | null | undefined} assetId
 * @returns {boolean}
 */
export function isEditorRiverAsset(assetId) {
  if (!assetId) return false;
  return getEditorAssetCategoryId(assetId) === 'editorRiver';
}

/**
 * @param {string | null | undefined} assetId
 * @param {EditorAssetMountMode} mountMode
 * @returns {boolean}
 */
export function assetSupportsMountMode(assetId, mountMode) {
  if (mountMode === 'surface') {
    return Boolean(assetId);
  }
  if (mountMode === 'verticalFace') {
    return isEditorRiverAsset(assetId);
  }
  return false;
}

/**
 * @param {string | null | undefined} assetId
 * @returns {boolean}
 */
export function cliffAssetExposesVerticalFaces(assetId) {
  const glbName = resolveKenneyGlbNameFromAssetId(assetId ?? '');
  if (!isKenneyCliffGlbName(glbName)) {
    return false;
  }
  if (isCliffQuarterFootprint(glbName)) {
    return false;
  }
  return true;
}

/**
 * @param {string | null | undefined} categoryId
 * @returns {boolean}
 */
export function isVerticalFaceHostCategory(categoryId) {
  return VERTICAL_FACE_HOST_CATEGORY_IDS.includes(categoryId ?? '');
}

/**
 * @param {string} childToolId
 * @param {string} hostAssetId
 * @returns {boolean}
 */
export function canMountAssetOnVerticalFace(childToolId, hostAssetId) {
  if (!assetSupportsMountMode(childToolId, 'verticalFace')) {
    return false;
  }
  if (!cliffAssetExposesVerticalFaces(hostAssetId)) {
    return false;
  }
  const hostCategory = getEditorAssetCategoryId(hostAssetId);
  return isVerticalFaceHostCategory(hostCategory);
}

/**
 * @param {number} rotationStep — river tools use 0–3 surface yaw, 4–7 vertical faces N/E/S/W
 * @returns {{ mountMode: EditorAssetMountMode, faceDirection: EditorVerticalFaceDirection, surfaceRotationStep: number }}
 */
export function resolveRiverMountFromRotationStep(rotationStep) {
  const normalized = ((rotationStep % 8) + 8) % 8;
  if (normalized < 4) {
    return {
      mountMode: 'surface',
      faceDirection: 'north',
      surfaceRotationStep: normalized,
    };
  }
  /** @type {EditorVerticalFaceDirection[]} */
  const faces = ['north', 'east', 'south', 'west'];
  return {
    mountMode: 'verticalFace',
    faceDirection: faces[normalized - 4],
    surfaceRotationStep: 0,
  };
}

/**
 * @param {string | null | undefined} assetId
 * @returns {number}
 */
export function maxEditorPlacementRotationSteps(assetId) {
  return isEditorRiverAsset(assetId) ? 8 : 4;
}

/**
 * River steps 4–7 graft onto a cliff face using Kenney's native upright waterfall piece.
 *
 * @param {string} hostAssetId
 * @returns {string}
 */
export function resolveVerticalFaceRiverAssetId(hostAssetId) {
  const glbName = resolveKenneyGlbNameFromAssetId(hostAssetId);
  const material = getCliffMaterial(glbName);
  return material === 'stone' ? 'nature:cliff_waterfall_stone' : 'nature:cliff_waterfall_rock';
}
