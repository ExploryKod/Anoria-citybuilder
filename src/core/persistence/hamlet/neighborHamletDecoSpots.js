/**
 * Fixed decorative outskirts spots — one per proto hamlet (except the active grid).
 */

import { DEFAULT_HAMLET_SLUG, hamletSlugOf } from './hamletSession.js';
import { HAMLET_CATALOG } from '../../../shared/hamlet-catalog/hamletCatalog.js';

/**
 * @typedef {{
 *   hamletId: string,
 *   centerX: number,
 *   centerZ: number,
 *   houses: { offsetX: number, offsetZ: number }[],
 *   trees: { offsetX: number, offsetZ: number }[],
 *   hasMarket?: boolean,
 *   hasWell?: boolean,
 * }} NeighborHamletDecoSpot
 */

/**
 * @param {number} citySize
 * @returns {NeighborHamletDecoSpot[]}
 */
export function buildNeighborHamletDecoSpots(citySize) {
  const edges = { min: 0, mid: citySize / 2, max: citySize };
  return HAMLET_CATALOG.filter((hamlet) => hamlet.deco).map((hamlet) => {
    const { anchor, houses, trees, hasMarket, hasWell } = hamlet.deco;
    return {
      hamletId: hamlet.slug,
      centerX: edges[anchor.x] + anchor.dx,
      centerZ: edges[anchor.z] + anchor.dz,
      houses,
      trees,
      ...(hasMarket ? { hasMarket } : {}),
      ...(hasWell ? { hasWell } : {}),
    };
  });
}

/** Hamlet ids that can appear as outskirts deco (every proto except the starting id slot). */
export const NEIGHBOR_DECO_HAMLET_IDS = buildNeighborHamletDecoSpots(16).map((spot) => spot.hamletId);

/**
 * @param {string} hamletId
 * @returns {boolean}
 */
export function isNeighborDecoHamletId(hamletId) {
  const slug = hamletSlugOf(hamletId);
  return slug !== DEFAULT_HAMLET_SLUG && NEIGHBOR_DECO_HAMLET_IDS.includes(slug);
}
