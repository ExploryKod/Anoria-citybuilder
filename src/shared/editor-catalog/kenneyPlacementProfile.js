import { KENNEY_PLACEMENT_PROFILES } from './kenneyPlacementProfiles.generated.js';
import { getTerrainCatalogEntry } from '../terrain-catalog/terrainCatalog.js';
import { resolveTerrainId } from '../terrain-catalog/resolveTerrainId.js';
import { resolveNaturePropGlbName } from './naturePropCatalog.js';
import { isEditorSeaTerrain } from '../terrain-catalog/editorSeaTerrain.js';

/** Minimum vertical step when bbox height is ~0 (flat ground tiles still stack in lego mode). */
const MIN_TERRAIN_STACK_HEIGHT = 0.04;

/** @typedef {{ bboxMinY: number, bboxMaxY: number, baseOffsetY: number, stackHeight: number }} KenneyPlacementProfile */

const DEFAULT_PROFILE = Object.freeze({
  bboxMinY: -0.05,
  bboxMaxY: -0.05,
  baseOffsetY: 0.05,
  stackHeight: 0,
});

/**
 * @param {string} glbName
 * @returns {KenneyPlacementProfile}
 */
export function getKenneyPlacementProfileByGlbName(glbName) {
  const raw = KENNEY_PLACEMENT_PROFILES[glbName];
  if (!raw) {
    return DEFAULT_PROFILE;
  }
  const baseOffsetY = -raw.bboxMinY;
  const stackHeight = raw.bboxMaxY - raw.bboxMinY;
  return {
    bboxMinY: raw.bboxMinY,
    bboxMaxY: raw.bboxMaxY,
    baseOffsetY,
    stackHeight,
  };
}

/**
 * @param {string} assetId — `nature:*` or `nature-prop:*`
 * @returns {KenneyPlacementProfile}
 */
export function getKenneyPlacementProfile(assetId) {
  if (assetId.startsWith('nature-prop:')) {
    const glbName = resolveNaturePropGlbName(assetId);
    return getKenneyPlacementProfileByGlbName(glbName);
  }
  const glbName = assetId.replace(/^nature:/, '');
  return getKenneyPlacementProfileByGlbName(glbName);
}

/**
 * Walkable / stackable top height relative to `WORLD_PLATFORM_Y` for base terrain.
 *
 * @param {string} terrainId
 * @returns {number}
 */
export function getTerrainTopLocalY(terrainId) {
  const canonical = resolveTerrainId(terrainId);
  const entry = getTerrainCatalogEntry(canonical);
  const surfaceY = entry?.surfaceY ?? 0;
  const glbName = canonical.replace(/^nature:/, '');
  const profile = getKenneyPlacementProfileByGlbName(glbName);
  return surfaceY + profile.bboxMaxY;
}

/**
 * @param {string} propId
 * @returns {number}
 */
export function getPropStackHeight(propId) {
  return getKenneyPlacementProfile(propId).stackHeight;
}

/**
 * @param {string} assetId — `nature:*` or `nature-prop:*`
 * @param {number} baseLocalY
 * @returns {number}
 */
export function getKenneyStackTopLocalY(assetId, baseLocalY) {
  const { stackHeight } = getKenneyPlacementProfile(assetId);
  const minHeight = assetId.startsWith('nature:') ? MIN_TERRAIN_STACK_HEIGHT : 0;
  return baseLocalY + Math.max(stackHeight, minHeight);
}

/**
 * Highest surface at a tile: sea level, tile base terrain, or top of any stack piece.
 *
 * @param {readonly { x: number, y: number, assetId: string, baseLocalY: number }[]} stackObjects
 * @param {number} x
 * @param {number} y
 * @param {string} terrainId
 * @returns {number}
 */
export function getColumnTopLocalY(stackObjects, x, y, terrainId) {
  let top = isEditorSeaTerrain(terrainId) ? 0 : getTerrainTopLocalY(terrainId);
  for (const obj of stackObjects) {
    if (obj.x !== x || obj.y !== y) continue;
    top = Math.max(top, getKenneyStackTopLocalY(obj.assetId, obj.baseLocalY));
  }
  return top;
}

/**
 * @param {string} propId
 * @param {number} baseLocalY — surface local Y the prop feet sit on (relative to WORLD_PLATFORM_Y)
 * @returns {number}
 */
export function getPropTopLocalY(propId, baseLocalY) {
  return getKenneyStackTopLocalY(propId, baseLocalY);
}

/**
 * @param {string} propId
 * @param {number} baseLocalY
 * @returns {number} world-space Y for the prop group origin
 */
export function propGroupWorldY(propId, baseLocalY) {
  const { baseOffsetY } = getKenneyPlacementProfile(propId);
  return baseLocalY + baseOffsetY;
}
