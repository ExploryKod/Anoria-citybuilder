import {
  canPlaceEditorToolOnParent,
  getEditorAssetCategoryId,
  terrainIdToParentCategory,
} from './editorStackRules.js';
import {
  canMountAssetOnVerticalFace,
  cliffAssetExposesVerticalFaces,
  isEditorRiverAsset,
  resolveRiverMountFromRotationStep,
  resolveVerticalFaceRiverAssetId,
} from './editorKenneyAssetBehavior.js';
import { isEditorSeaTerrain } from '../terrain-catalog/editorSeaTerrain.js';
import {
  getColumnTopLocalY,
  getKenneyStackTopLocalY,
} from './kenneyPlacementProfile.js';
import {
  isTileInBounds,
  neighborTileForHostFace,
  oppositeFaceDirection,
} from './editorVerticalFaceMount.js';

/**
 * @typedef {import('./editorKenneyAssetBehavior.js').EditorAssetMountMode} EditorAssetMountMode
 * @typedef {import('./editorKenneyAssetBehavior.js').EditorVerticalFaceDirection} EditorVerticalFaceDirection
 */

/**
 * @param {readonly { id: string, assetId: string, x: number, y: number }[]} stackObjects
 * @param {number} x
 * @param {number} y
 * @returns {{ id: string, assetId: string, baseLocalY: number, x: number, y: number } | undefined}
 */
export function findVerticalFaceHostOnTile(stackObjects, x, y) {
  return stackObjects.find(
    (obj) => obj.x === x && obj.y === y && cliffAssetExposesVerticalFaces(obj.assetId)
  );
}

/**
 * @param {EditorPlacementTarget} target
 * @returns {{ id: string | null, assetId: string, baseLocalY: number, x: number, y: number } | undefined}
 */
export function resolveTerrainCliffVerticalFaceHost(target) {
  const terrainId = target.terrainId;
  if (!terrainId) {
    return undefined;
  }
  const assetId = terrainId.startsWith('nature:') ? terrainId : `nature:${terrainId}`;
  if (!cliffAssetExposesVerticalFaces(assetId)) {
    return undefined;
  }
  return {
    id: null,
    assetId,
    baseLocalY: 0,
    x: target.x,
    y: target.y,
  };
}

/**
 * @param {EditorPlacementTarget} target
 * @param {readonly { id: string, assetId: string, baseLocalY: number, x: number, y: number }[]} stackObjects
 * @returns {{ id: string | null, assetId: string, baseLocalY: number, x: number, y: number } | undefined}
 */
export function resolveVerticalFaceHost(target, stackObjects) {
  if (target.kind === 'stack' && target.stackId) {
    const parent = stackObjects.find((obj) => obj.id === target.stackId);
    if (parent && cliffAssetExposesVerticalFaces(parent.assetId)) {
      return parent;
    }
  }
  const stackHost = findVerticalFaceHostOnTile(stackObjects, target.x, target.y);
  if (stackHost) {
    return stackHost;
  }
  return resolveTerrainCliffVerticalFaceHost(target);
}

/**
 * @param {number} x
 * @param {number} y
 * @param {string} terrainId
 * @param {readonly { id: string, assetId: string, baseLocalY: number, x: number, y: number }[]} stackObjects
 * @returns {{ id: string | null, assetId: string, baseLocalY: number, x: number, y: number } | undefined}
 */
export function resolveVerticalFaceHostAtTile(x, y, terrainId, stackObjects) {
  const stackHost = findVerticalFaceHostOnTile(stackObjects, x, y);
  if (stackHost) {
    return stackHost;
  }
  return resolveTerrainCliffVerticalFaceHost({
    kind: 'terrain',
    x,
    y,
    categoryId: terrainIdToParentCategory(terrainId),
    terrainId,
  });
}

/**
 * Resolve host cliff + neighbor child tile for Kenney vertical-edge mounting.
 *
 * @param {number} clickX
 * @param {number} clickY
 * @param {string} terrainId — terrain at click tile
 * @param {readonly { id: string, assetId: string, baseLocalY: number, x: number, y: number }[]} stackObjects
 * @param {EditorVerticalFaceDirection} faceDirection
 * @param {number} citySize
 * @param {(tx: number, ty: number) => string} [getTerrainIdAt]
 */
export function resolveVerticalFacePlacementFromClick(
  clickX,
  clickY,
  terrainId,
  stackObjects,
  faceDirection,
  citySize,
  getTerrainIdAt = () => 'grass'
) {
  const hostOnClick = resolveVerticalFaceHostAtTile(clickX, clickY, terrainId, stackObjects);
  if (hostOnClick) {
    const child = neighborTileForHostFace(hostOnClick.x, hostOnClick.y, faceDirection);
    if (!isTileInBounds(child.x, child.y, citySize)) {
      return { ok: false, reason: 'out_of_bounds' };
    }
    return {
      ok: true,
      host: hostOnClick,
      childX: child.x,
      childY: child.y,
    };
  }

  const hostTile = neighborTileForHostFace(clickX, clickY, oppositeFaceDirection(faceDirection));
  const hostTerrainId = getTerrainIdAt(hostTile.x, hostTile.y);
  const host = resolveVerticalFaceHostAtTile(hostTile.x, hostTile.y, hostTerrainId, stackObjects);
  if (!host) {
    return { ok: false, reason: 'no-vertical-host' };
  }
  if (!isTileInBounds(clickX, clickY, citySize)) {
    return { ok: false, reason: 'out_of_bounds' };
  }
  return {
    ok: true,
    host,
    childX: clickX,
    childY: clickY,
  };
}

/**
 * Ghost / preview data when vertical placement is active (even if placement is invalid).
 *
 * @param {number} clickX
 * @param {number} clickY
 * @param {string} terrainId
 * @param {readonly { id: string, assetId: string, baseLocalY: number, x: number, y: number }[]} stackObjects
 * @param {EditorVerticalFaceDirection} faceDirection
 * @param {number} citySize
 * @param {(tx: number, ty: number) => string} getTerrainIdAt
 * @param {object | null | undefined} [placementPreview]
 */
export function buildVerticalRiverGhostPreview(
  clickX,
  clickY,
  terrainId,
  stackObjects,
  faceDirection,
  citySize,
  getTerrainIdAt,
  placementPreview = null
) {
  if (placementPreview?.ok && placementPreview.mountMode === 'verticalFace') {
    return placementPreview;
  }

  const hostOnClick = resolveVerticalFaceHostAtTile(clickX, clickY, terrainId, stackObjects);
  if (hostOnClick) {
    const child = neighborTileForHostFace(hostOnClick.x, hostOnClick.y, faceDirection);
    if (!isTileInBounds(child.x, child.y, citySize)) {
      return placementPreview ?? { ok: false, reason: 'out_of_bounds' };
    }
    return {
      ...(placementPreview ?? {}),
      ok: placementPreview?.ok ?? false,
      mountMode: 'verticalFace',
      faceDirection,
      x: child.x,
      y: child.y,
      hostX: hostOnClick.x,
      hostY: hostOnClick.y,
      hostAssetId: hostOnClick.assetId,
      baseLocalY: hostOnClick.baseLocalY,
    };
  }

  const hostTile = neighborTileForHostFace(clickX, clickY, oppositeFaceDirection(faceDirection));
  const hostTerrainId = getTerrainIdAt(hostTile.x, hostTile.y);
  const host = resolveVerticalFaceHostAtTile(hostTile.x, hostTile.y, hostTerrainId, stackObjects);
  if (host && isTileInBounds(clickX, clickY, citySize)) {
    return {
      ...(placementPreview ?? {}),
      ok: placementPreview?.ok ?? false,
      mountMode: 'verticalFace',
      faceDirection,
      x: clickX,
      y: clickY,
      hostX: host.x,
      hostY: host.y,
      hostAssetId: host.assetId,
      baseLocalY: host.baseLocalY,
    };
  }

  return {
    ...(placementPreview ?? {}),
    ok: false,
    mountMode: 'verticalFace',
    faceDirection,
    x: clickX,
    y: clickY,
    baseLocalY: placementPreview?.baseLocalY ?? 0,
  };
}

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
 * @param {{ mountMode?: EditorAssetMountMode, faceDirection?: EditorVerticalFaceDirection, rotationStep?: number, citySize?: number, getTerrainIdAt?: (tx: number, ty: number) => string }} [options]
 * @returns {{ ok: true, baseLocalY: number, parentId: string | null, anchor: 'terrain' | 'stack' | 'sea', x: number, y: number, mountMode: EditorAssetMountMode, faceDirection: EditorVerticalFaceDirection | null, hostAssetId?: string, hostX?: number, hostY?: number, placedAssetId?: string } | { ok: false, reason: string }}
 */
export function resolveEditorStackPlacement(target, childToolId, stackObjects, options = {}) {
  let mountMode = options.mountMode ?? 'surface';
  let faceDirection = options.faceDirection ?? 'north';

  if (options.rotationStep != null && isEditorRiverAsset(childToolId)) {
    const resolved = resolveRiverMountFromRotationStep(options.rotationStep);
    mountMode = resolved.mountMode;
    faceDirection = resolved.faceDirection;
  }

  if (mountMode === 'verticalFace') {
    const vertical = resolveVerticalFacePlacementFromClick(
      target.x,
      target.y,
      target.terrainId ?? 'grass',
      stackObjects,
      faceDirection,
      options.citySize ?? 0,
      options.getTerrainIdAt
    );
    if (!vertical.ok) {
      return vertical;
    }
    const { host, childX, childY } = vertical;
    if (!canMountAssetOnVerticalFace(childToolId, host.assetId)) {
      return { ok: false, reason: 'vertical-face-not-allowed' };
    }
    return {
      ok: true,
      baseLocalY: host.baseLocalY,
      parentId: host.id,
      anchor: host.id ? 'stack' : 'terrain',
      x: childX,
      y: childY,
      hostX: host.x,
      hostY: host.y,
      mountMode: 'verticalFace',
      faceDirection,
      hostAssetId: host.assetId,
      placedAssetId: resolveVerticalFaceRiverAssetId(host.assetId),
    };
  }

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
      mountMode: 'surface',
      faceDirection: null,
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
      mountMode: 'surface',
      faceDirection: null,
    };
  }
  return {
    ok: true,
    baseLocalY,
    parentId: null,
    anchor: isEditorSeaTerrain(target.terrainId) ? 'sea' : 'terrain',
    x: target.x,
    y: target.y,
    mountMode: 'surface',
    faceDirection: null,
  };
}

/**
 * Preview for placement ghost (position + validity).
 *
 * @param {object | null | undefined} pickedObject
 * @param {number} x
 * @param {number} y
 * @param {string} terrainId
 * @param {string} childToolId
 * @param {readonly { id: string, assetId: string, baseLocalY: number, x: number, y: number }[]} stackObjects
 * @param {number} [rotationStep=0]
 * @param {number} [citySize=0]
 * @param {(tx: number, ty: number) => string} [getTerrainIdAt]
 */
export function resolveEditorGhostPlacementPreview(
  pickedObject,
  x,
  y,
  terrainId,
  childToolId,
  stackObjects,
  rotationStep = 0,
  citySize = 0,
  getTerrainIdAt = () => 'grass'
) {
  const target = resolveEditorPlacementTarget(pickedObject, x, y, terrainId, stackObjects);
  const placement = resolveEditorStackPlacement(target, childToolId, stackObjects, {
    rotationStep,
    citySize,
    getTerrainIdAt,
  });

  if (!isEditorRiverAsset(childToolId)) {
    return placement;
  }

  const riverMount = resolveRiverMountFromRotationStep(rotationStep);
  if (riverMount.mountMode !== 'verticalFace') {
    return placement;
  }

  return buildVerticalRiverGhostPreview(
    x,
    y,
    terrainId,
    stackObjects,
    riverMount.faceDirection,
    citySize,
    getTerrainIdAt,
    placement
  );
}
