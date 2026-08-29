import { KENNEY_HEX_DEFAULT_RADIUS } from '../catalogs/HexAssetCatalog.js';

export const WORLD_MAP_HEX_SIZE = KENNEY_HEX_DEFAULT_RADIUS;

/** @typedef {'grassland' | 'coast' | 'forest' | 'hill' | 'mountain' | 'desert'} WorldTerrainKey */

/**
 * Small authored landmass around the trade cities (axial coords).
 * Ocean is rendered as Phaser background — no tile sprites.
 * @type {ReadonlyArray<{ q: number, r: number, terrain: WorldTerrainKey }>}
 */
export const WORLD_MAP_LAND_TILES = Object.freeze(
  (() => {
    const tiles = [];
    const radius = 7;

    for (let q = -radius; q <= radius; q += 1) {
      for (let r = -radius; r <= radius; r += 1) {
        if (Math.abs(q + r) > radius) continue;

        const dist = hexDistApprox(q, r);
        if (dist > 5.8) continue;

        let terrain = 'coast';
        if (dist < 2.2) terrain = 'grassland';
        else if (dist < 3.4) terrain = 'forest';
        else if (dist > 5.2) terrain = 'hill';

        tiles.push({ q, r, terrain });
      }
    }

    return tiles;
  })()
);

/**
 * @param {number} q
 * @param {number} r
 */
function hexDistApprox(q, r) {
  return (Math.abs(q) + Math.abs(q + r) + Math.abs(r)) / 2;
}
