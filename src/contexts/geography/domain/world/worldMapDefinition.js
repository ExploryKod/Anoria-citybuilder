import {
  KENNEY_HEX_DEFAULT_RADIUS,
  resolveKenneyGameplaySprite,
} from '../catalogs/HexAssetCatalog.js';
import { WORLD_CITY_HEX_SITES } from '../catalogs/WorldCityHexCatalog.js';
import { hexDistance, hexKey } from '../../../../shared/geography/hexCoordinates.js';

export const WORLD_MAP_HEX_SIZE = KENNEY_HEX_DEFAULT_RADIUS;

/** Map centre — Anoria. */
const WORLD_CENTER = Object.freeze({ q: 0, r: 0 });

/** @typedef {'grassland' | 'coast' | 'forest' | 'hill' | 'mountain' | 'desert'} WorldTerrainKey */

/**
 * Solid land disc that covers every trade city with a small coast margin.
 * Ocean is never tiled — Phaser background colour only (Kenney has no water hexes).
 */
const WORLD_LAND_RADIUS = (() => {
  const sites = Object.values(WORLD_CITY_HEX_SITES);
  const maxCityDist = Math.max(
    ...sites.map((site) => hexDistance(WORLD_CENTER, { q: site.q, r: site.r }))
  );
  return Math.ceil(maxCityDist) + 2;
})();

/**
 * @param {number} q
 * @param {number} r
 * @returns {WorldTerrainKey}
 */
function pickTerrainForHex(q, r) {
  const dist = hexDistance(WORLD_CENTER, { q, r });
  const edgeGap = WORLD_LAND_RADIUS - dist;

  if (edgeGap <= 1) return 'coast';
  if (dist < 2.2) return 'grassland';
  if (dist < 3.8) return 'forest';
  if (dist < 5.5) return 'grassland';
  if (dist < 7) return 'hill';
  return 'coast';
}

/**
 * @param {WorldTerrainKey} terrain
 * @returns {WorldTerrainKey}
 */
function kenneyTerrainOrGrassland(terrain) {
  return resolveKenneyGameplaySprite(terrain) ? terrain : 'grassland';
}

/**
 * @returns {{ tiles: ReadonlyArray<{ q: number, r: number, terrain: WorldTerrainKey }>, keys: ReadonlySet<string> }}
 */
function buildWorldLandTiles() {
  /** @type {Map<string, { q: number, r: number, terrain: WorldTerrainKey }>} */
  const byKey = new Map();

  for (let q = -WORLD_LAND_RADIUS; q <= WORLD_LAND_RADIUS; q += 1) {
    for (let r = -WORLD_LAND_RADIUS; r <= WORLD_LAND_RADIUS; r += 1) {
      if (Math.abs(q + r) > WORLD_LAND_RADIUS) continue;

      const dist = hexDistance(WORLD_CENTER, { q, r });
      if (dist > WORLD_LAND_RADIUS) continue;

      const terrain = kenneyTerrainOrGrassland(pickTerrainForHex(q, r));
      if (!resolveKenneyGameplaySprite(terrain)) continue;

      byKey.set(hexKey({ q, r }), { q, r, terrain });
    }
  }

  for (const site of Object.values(WORLD_CITY_HEX_SITES)) {
    const key = hexKey(site);
    if (byKey.has(key)) continue;

    const terrain = kenneyTerrainOrGrassland('grassland');
    if (!resolveKenneyGameplaySprite(terrain)) continue;
    byKey.set(key, { q: site.q, r: site.r, terrain });
  }

  return {
    tiles: Object.freeze([...byKey.values()]),
    keys: Object.freeze(new Set(byKey.keys())),
  };
}

const worldLand = buildWorldLandTiles();

/** Kenney terrain sprites only — one tile per land hex, no gaps. */
export const WORLD_MAP_LAND_TILES = worldLand.tiles;

/** Fast lookup for hover / interaction on authored land. */
export const WORLD_MAP_LAND_HEX_KEYS = worldLand.keys;

/**
 * @param {{ q: number, r: number }} hex
 */
export function isWorldMapLandHex(hex) {
  return WORLD_MAP_LAND_HEX_KEYS.has(hexKey(hex));
}
