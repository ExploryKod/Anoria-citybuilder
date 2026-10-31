import { KENNEY_PLACEMENT_PROFILES } from './kenneyPlacementProfiles.generated.js';
import { getTerrainCatalogEntry } from '../terrain-catalog/terrainCatalog.js';
import { resolveTerrainId } from '../terrain-catalog/resolveTerrainId.js';
import { isBlockingNatureProp, resolveNaturePropGlbName } from './naturePropCatalog.js';
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

/** The ground the game builds on by default: a building on it stands at its usual height (elevation 0). */
const BUILD_BASELINE_TERRAIN_ID = 'grass';

/**
 * The terrain pieces whose top is flat: a building, a road can stand on them, even when two of them are not at the same level (side by side they make a
 * plateau). Listed by the player from the previews of the Kenney nature kit (glb names, without the extension). Every other piece (a cliff face, a slope,
 * a half wall, a river...) takes no building until it is listed here.
 */
const FLAT_TOP_PIECES = Object.freeze(new Set([
  'cliff_blockQuarter_rock',
  'cliff_blockQuarter_stone',
  'cliff_blockHalf_rock',
  'cliff_blockHalf_stone',
  'cliff_block_rock',
  'cliff_block_stone',
  'cliff_blockCave_rock',
  'cliff_blockCave_stone',
  'ground_grass',
  'ground_pathOpen',
]));

/**
 * The pieces that are a slope: they rise along their local +z axis (from the base of the piece to its top, which is the height they gain), turned by the
 * piece's `rotationY`, over the whole tile (measured on the models: `cliff_blockSlope` goes from 0 to 1.0 across it). Only a road stands on a slope (it
 * follows it), never a building. `cliff_half` is not one: it covers only the upper part of its tile, so a road of one tile would not fit it; it stays a
 * cliff, blocking roads and buildings alike.
 */
const SLOPE_PIECES = Object.freeze(new Set([
  'cliff_blockSlope_rock',
  'cliff_blockSlope_stone',
]));

/** The stone paths (`path_stone`, `path_stoneCircle`, `path_stoneCorner`, ...) are flat too. */
const FLAT_TOP_PREFIXES = Object.freeze(['path_stone']);

/** @param {string} glbName e.g. `cliff_blockHalf_rock` @returns {boolean} whether a building can stand on the top of this piece */
function isFlatTopPiece(glbName) {
  return FLAT_TOP_PIECES.has(glbName) || FLAT_TOP_PREFIXES.some((prefix) => glbName.startsWith(prefix));
}

/**
 * The ground of a tile, as a building meets it: how high it stands above the flat grass the game builds on (0 there), and whether it is flat to build on.
 * The ground is the highest terrain piece stacked on the tile (or the base terrain, when none is higher); the props (trees, flowers) do not count, a
 * building does not stand on them. A building is lifted by `elevation`, so that it stands on its plateau and not in it. Derived from the map, never stored.
 *
 * @param {readonly { x: number, y: number, assetId: string, baseLocalY: number }[]} stackObjects
 * @param {number} x
 * @param {number} y
 * @param {string} terrainId the base terrain of the tile
 * @returns {{ elevation: number, flat: boolean, obstacle: boolean, slope: { dx: number, dy: number, rise: number } | null }} `elevation` (the top of the
 *   ground) in the unit of `baseLocalY` (relative to `WORLD_PLATFORM_Y`); `obstacle`: a prop that blocks building stands on the tile (a tree, a rock, see
 *   `isBlockingNatureProp`); `slope`: the tile is a slope, rising toward the neighbour at (dx, dy) by `rise` (its low side is `elevation - rise`)
 */
export function getGroundSurface(stackObjects, x, y, terrainId) {
  const sea = isEditorSeaTerrain(terrainId);
  // The base terrain is the lowest candidate; a piece at least as high takes over
  let top = sea ? 0 : getTerrainTopLocalY(terrainId);
  let flat = !sea && isFlatTopPiece(resolveTerrainId(terrainId).replace(/^nature:/, ''));
  let obstacle = false;
  let slope = null;
  for (const object of stackObjects) {
    if (object.x !== x || object.y !== y) continue;
    // A tree, a rock... standing on the tile: the ground is not lifted by it, but it is in the way
    if (object.assetId.startsWith('nature-prop:')) {
      obstacle ||= isBlockingNatureProp(object.assetId);
      continue;
    }
    if (!object.assetId.startsWith('nature:')) continue;
    const pieceTop = getKenneyStackTopLocalY(object.assetId, object.baseLocalY);
    if (pieceTop >= top) {
      const glbName = object.assetId.replace(/^nature:/, '');
      top = pieceTop;
      flat = isFlatTopPiece(glbName);
      // The high side of a slope faces where the piece's +z axis points once turned (a quarter turn moves it to the next side)
      slope = SLOPE_PIECES.has(glbName)
        ? {
          dx: Math.round(Math.sin(object.rotationY ?? 0)),
          dy: Math.round(Math.cos(object.rotationY ?? 0)),
          rise: getKenneyPlacementProfile(object.assetId).stackHeight,
        }
        : null;
    }
  }
  return { elevation: top - getTerrainTopLocalY(BUILD_BASELINE_TERRAIN_ID), flat, obstacle, slope };
}

/**
 * How high the middle of a tile stands (above the flat grass, 0 there): the top of its ground, or halfway up for a slope. What lies on the tile (a building, a
 * road, a walker, a tint) is put at this height.
 * @see getGroundSurface
 */
export function getGroundElevation(stackObjects, x, y, terrainId) {
  const { elevation, slope } = getGroundSurface(stackObjects, x, y, terrainId);
  return slope ? elevation - slope.rise / 2 : elevation;
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
