import {
  canPlaceEditorToolOnParent,
  getEditorAssetCategoryId,
  terrainIdToParentCategory,
} from './editorStackRules.js';
import { isEditorSeaTerrain } from '../terrain-catalog/editorSeaTerrain.js';
import {
  getColumnTopLocalY,
  getKenneyStackTopLocalY,
} from './kenneyPlacementProfile.js';

/**
 * @typedef {object} EditorPlacementTarget
 * @property {'sea' | 'terrain' | 'stack'} kind
 * @property {number} x
 * @property {number} y
 * @property {import('./editorStackRules.js').EditorStackParentCategory} categoryId
 * @property {string} [stackId]
 * @property {string} [terrainId]
 */

/**
 * @param {string} assetId
 * @param {number} baseLocalY
 * @returns {number}
 */
export function getStackObjectTopLocalY(assetId, baseLocalY) {
  return getKenneyStackTopLocalY(assetId, baseLocalY);
}

/**
 * @deprecated use getColumnTopLocalY from kenneyPlacementProfile.js
 */
export { getColumnTopLocalY } from './kenneyPlacementProfile.js';

/**
 * @param {EditorPlacementTarget} target
 * @param {readonly { id: string, assetId: string, baseLocalY: number }[]} stackObjects
 * @returns {number}
 */
export function getPlacementTargetTopLocalY(target, stackObjects) {
  if (target.kind === 'stack' && target.stackId) {
    const parent = stackObjects.find((obj) => obj.id === target.stackId);
    if (!parent) return 0;
    return getStackObjectTopLocalY(parent.assetId, parent.baseLocalY);
  }
  if (target.kind === 'sea') {
    return 0;
  }
  const terrainId = target.terrainId ?? 'grass';
  return getColumnTopLocalY(stackObjects, target.x, target.y, terrainId);
}

/**
 * @param {object | null | undefined} pickedObject
 * @param {number} x
 * @param {number} y
 * @param {string} terrainId
 * @param {readonly { id: string, assetId: string }[]} stackObjects
 * @returns {EditorPlacementTarget}
 */
export function resolveEditorPlacementTarget(pickedObject, x, y, terrainId, stackObjects) {
  let current = pickedObject ?? null;
  while (current) {
    const stackId = current.userData?.editorStackId;
    if (typeof stackId === 'string' && stackId.length > 0) {
      const obj = stackObjects.find((entry) => entry.id === stackId);
      return {
        kind: 'stack',
        stackId,
        x: obj?.x ?? x,
        y: obj?.y ?? y,
        categoryId: getEditorAssetCategoryId(obj?.assetId) ?? 'editorGround',
      };
    }
    current = current.parent ?? null;
  }

  if (isEditorSeaTerrain(terrainId)) {
    return { kind: 'sea', x, y, categoryId: 'editorSea', terrainId };
  }

  const categoryId = terrainIdToParentCategory(terrainId);
  return { kind: 'terrain', x, y, categoryId, terrainId };
}

/**
 * @param {EditorPlacementTarget} target
 * @param {string} childToolId
 * @param {readonly { id: string, assetId: string, baseLocalY: number, x: number, y: number }[]} stackObjects
 * @returns {{ ok: true, baseLocalY: number, parentId: string | null, anchor: 'terrain' | 'stack' | 'sea', x: number, y: number } | { ok: false, reason: string }}
 */
export function resolveEditorStackPlacement(target, childToolId, stackObjects) {
  if (!canPlaceEditorToolOnParent(childToolId, target.categoryId)) {
    return { ok: false, reason: 'category-not-allowed' };
  }

  const baseLocalY = getPlacementTargetTopLocalY(target, stackObjects);
  if (target.kind === 'stack' && target.stackId) {
    return {
      ok: true,
      baseLocalY,
      parentId: target.stackId,
      anchor: 'stack',
      x: target.x,
      y: target.y,
    };
  }
  if (target.kind === 'sea') {
    return {
      ok: true,
      baseLocalY: 0,
      parentId: null,
      anchor: 'sea',
      x: target.x,
      y: target.y,
    };
  }
  return {
    ok: true,
    baseLocalY,
    parentId: null,
    anchor: isEditorSeaTerrain(target.terrainId) ? 'sea' : 'terrain',
    x: target.x,
    y: target.y,
  };
}
