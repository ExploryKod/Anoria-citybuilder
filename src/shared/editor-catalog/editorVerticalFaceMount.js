import { getKenneyPlacementProfile } from './kenneyPlacementProfile.js';
import { resolveKenneyGlbNameFromAssetId } from './editorKenneyAssetBehavior.js';
import { isCliffHalfFootprint } from './classifyKenneyCliff.js';

/** @typedef {import('./editorKenneyAssetBehavior.js').EditorVerticalFaceDirection} EditorVerticalFaceDirection */

/**
 * Grid contract (matches TileGridOverlay): tile centers at integer (x, z),
 * cell edges at ±0.5 from center. Shared edge between two adjacent tiles
 * is exactly at hostCenter ± 0.5 on the axis perpendicular to the face.
 */
export const GRID_TILE_HALF = 0.5;

/**
 * @param {number} hostX
 * @param {number} hostY
 * @param {EditorVerticalFaceDirection} faceDirection — face of the **host** cliff
 * @returns {{ axis: 'x' | 'z', value: number }}
 */
export function sharedGridEdgeCoordinate(hostX, hostY, faceDirection) {
  switch (faceDirection) {
    case 'north':
      return { axis: 'z', value: hostY + GRID_TILE_HALF };
    case 'south':
      return { axis: 'z', value: hostY - GRID_TILE_HALF };
    case 'east':
      return { axis: 'x', value: hostX + GRID_TILE_HALF };
    case 'west':
      return { axis: 'x', value: hostX - GRID_TILE_HALF };
    default:
      return { axis: 'z', value: hostY };
  }
}

/**
 * Host tile across the shared grid edge from the child tile.
 *
 * @param {number} childX
 * @param {number} childY
 * @param {EditorVerticalFaceDirection} faceDirection
 */
export function hostTileFromChildFace(childX, childY, faceDirection) {
  switch (faceDirection) {
    case 'north':
      return { x: childX, y: childY - 1 };
    case 'south':
      return { x: childX, y: childY + 1 };
    case 'east':
      return { x: childX - 1, y: childY };
    case 'west':
      return { x: childX + 1, y: childY };
    default:
      return { x: childX, y: childY };
  }
}

/**
 * Tile adjacent to the host cliff on the given face (+Z = north = increasing y).
 *
 * @param {number} hostX
 * @param {number} hostY
 * @param {EditorVerticalFaceDirection} faceDirection — face of the **host** cliff
 */
export function neighborTileForHostFace(hostX, hostY, faceDirection) {
  switch (faceDirection) {
    case 'north':
      return { x: hostX, y: hostY + 1 };
    case 'south':
      return { x: hostX, y: hostY - 1 };
    case 'east':
      return { x: hostX + 1, y: hostY };
    case 'west':
      return { x: hostX - 1, y: hostY };
    default:
      return { x: hostX, y: hostY };
  }
}

/**
 * @param {EditorVerticalFaceDirection} faceDirection
 * @returns {EditorVerticalFaceDirection}
 */
export function oppositeFaceDirection(faceDirection) {
  switch (faceDirection) {
    case 'north':
      return 'south';
    case 'south':
      return 'north';
    case 'east':
      return 'west';
    case 'west':
      return 'east';
    default:
      return 'south';
  }
}

/**
 * @param {number} x
 * @param {number} y
 * @param {number} citySize
 */
export function isTileInBounds(x, y, citySize) {
  if (citySize <= 0) {
    return true;
  }
  return x >= 0 && y >= 0 && x < citySize && y < citySize;
}

/**
 * @param {string} assetId
 * @returns {boolean}
 */
export function usesKenneyEdgePivotOrigin(assetId) {
  const glbName = resolveKenneyGlbNameFromAssetId(assetId);
  return isCliffHalfFootprint(glbName);
}

/**
 * Yaw so the asset's glue face points toward the host cliff (1×1 footprint).
 *
 * @param {EditorVerticalFaceDirection} faceDirection
 * @returns {number}
 */
export function yawTowardHostCliff(faceDirection) {
  switch (faceDirection) {
    case 'north':
      return Math.PI;
    case 'south':
      return 0;
    case 'east':
      return -Math.PI / 2;
    case 'west':
      return Math.PI / 2;
    default:
      return 0;
  }
}

/**
 * World-space coordinate of the glue face for a 1×1 tile centered on (tileX, tileZ).
 * Used by tests / debug to verify alignment with sharedGridEdgeCoordinate.
 *
 * @param {EditorVerticalFaceDirection} faceDirection
 * @param {number} tileX
 * @param {number} tileZ
 * @returns {number}
 */
export function glueFaceWorldCoordinate(faceDirection, tileX, tileZ) {
  switch (faceDirection) {
    case 'north':
      return tileZ - GRID_TILE_HALF;
    case 'south':
      return tileZ + GRID_TILE_HALF;
    case 'east':
      return tileX - GRID_TILE_HALF;
    case 'west':
      return tileX + GRID_TILE_HALF;
    default:
      return tileZ;
  }
}

/**
 * Kenney vertical glue on a **shared grid edge** between host cliff and child tile.
 *
 * - 1×1 assets (waterfall, full cliff): child tile **center** — glue face sits on grid line.
 * - Half-footprint cliffs: group origin **on** the grid line (edge pivot).
 *
 * @param {EditorVerticalFaceDirection} faceDirection
 * @param {number} childTileX
 * @param {number} childTileY
 * @param {string} childAssetId
 * @param {number} hostBaseLocalY
 */
export function computeKenneyVerticalEdgeMountTransform(
  faceDirection,
  childTileX,
  childTileY,
  childAssetId,
  hostBaseLocalY
) {
  const host = hostTileFromChildFace(childTileX, childTileY, faceDirection);
  const edge = sharedGridEdgeCoordinate(host.x, host.y, faceDirection);
  const { baseOffsetY } = getKenneyPlacementProfile(childAssetId);
  const localY = hostBaseLocalY + baseOffsetY;
  const rotationY = yawTowardHostCliff(faceDirection);

  if (usesKenneyEdgePivotOrigin(childAssetId)) {
    if (edge.axis === 'z') {
      return {
        x: childTileX,
        y: localY,
        z: edge.value,
        rotationX: 0,
        rotationY,
        rotationZ: 0,
      };
    }
    return {
      x: edge.value,
      y: localY,
      z: childTileY,
      rotationX: 0,
      rotationY,
      rotationZ: 0,
    };
  }

  return {
    x: childTileX,
    y: localY,
    z: childTileY,
    rotationX: 0,
    rotationY,
    rotationZ: 0,
  };
}

/**
 * @param {import('three').Object3D} root
 * @param {EditorVerticalFaceDirection} faceDirection
 * @param {string} childAssetId
 * @param {number} childTileX
 * @param {number} childTileY
 * @param {number} hostBaseLocalY
 * @param {number} [worldPlatformY=0]
 */
export function applyKenneyVerticalEdgeMountToObject(
  root,
  faceDirection,
  childAssetId,
  childTileX,
  childTileY,
  hostBaseLocalY,
  worldPlatformY = 0
) {
  const transform = computeKenneyVerticalEdgeMountTransform(
    faceDirection,
    childTileX,
    childTileY,
    childAssetId,
    hostBaseLocalY
  );

  root.position.set(
    transform.x,
    worldPlatformY + transform.y,
    transform.z
  );
  root.rotation.set(transform.rotationX, transform.rotationY, transform.rotationZ);
}

/** @deprecated use applyKenneyVerticalEdgeMountToObject */
export function applyVerticalFaceMountToObject(
  root,
  faceDirection,
  hostAssetId,
  tileX,
  tileY,
  hostBaseLocalY,
  worldPlatformY = 0
) {
  applyKenneyVerticalEdgeMountToObject(
    root,
    faceDirection,
    hostAssetId,
    tileX,
    tileY,
    hostBaseLocalY,
    worldPlatformY
  );
}
