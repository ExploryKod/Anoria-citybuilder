/**
 * Fixed decorative outskirts spots — one per proto hamlet (except the active grid).
 */

import { DEFAULT_HAMLET_ID } from './hamletSession.js';

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
  const playableMinX = 0;
  const playableMaxX = citySize;
  const playableMinZ = 0;
  const playableMaxZ = citySize;
  const midX = citySize / 2;
  const midZ = citySize / 2;

  return [
    {
      hamletId: 'clairiere',
      centerX: playableMinX - 5,
      centerZ: playableMinZ - 5,
      houses: [{ offsetX: -1, offsetZ: -1 }, { offsetX: 1, offsetZ: -1 }, { offsetX: -1, offsetZ: 1 }],
      trees: [{ offsetX: -2, offsetZ: -2 }, { offsetX: 2, offsetZ: -2 }, { offsetX: -2, offsetZ: 2 }],
      hasMarket: true,
      hasWell: true,
    },
    {
      hamletId: 'pont-saules',
      centerX: playableMaxX + 5,
      centerZ: playableMinZ - 5,
      houses: [{ offsetX: -1, offsetZ: -1 }, { offsetX: 1, offsetZ: -1 }, { offsetX: 1, offsetZ: 1 }],
      trees: [{ offsetX: -2, offsetZ: -2 }, { offsetX: 2, offsetZ: -2 }, { offsetX: 2, offsetZ: 2 }],
      hasWell: true,
    },
    {
      hamletId: 'bruyeres',
      centerX: playableMinX - 5,
      centerZ: playableMaxZ + 5,
      houses: [
        { offsetX: -1, offsetZ: -1 },
        { offsetX: 1, offsetZ: -1 },
        { offsetX: -1, offsetZ: 1 },
        { offsetX: 1, offsetZ: 1 },
      ],
      trees: [{ offsetX: -2, offsetZ: -2 }, { offsetX: 2, offsetZ: -2 }, { offsetX: -2, offsetZ: 2 }],
    },
    {
      hamletId: 'rochehaute',
      centerX: playableMaxX + 5,
      centerZ: playableMaxZ + 5,
      houses: [{ offsetX: -1, offsetZ: -1 }, { offsetX: 1, offsetZ: -1 }, { offsetX: -1, offsetZ: 1 }],
      trees: [{ offsetX: -2, offsetZ: -2 }, { offsetX: 2, offsetZ: -2 }, { offsetX: -2, offsetZ: 2 }],
      hasMarket: true,
    },
    {
      hamletId: 'prevert',
      centerX: midX,
      centerZ: playableMinZ - 6,
      houses: [{ offsetX: -1, offsetZ: 0 }, { offsetX: 1, offsetZ: 0 }, { offsetX: 0, offsetZ: -1 }],
      trees: [{ offsetX: -2, offsetZ: 1 }, { offsetX: 2, offsetZ: 1 }],
      hasWell: true,
    },
    {
      hamletId: 'sourceclaire',
      centerX: midX,
      centerZ: playableMaxZ + 6,
      houses: [{ offsetX: -1, offsetZ: 0 }, { offsetX: 1, offsetZ: 0 }, { offsetX: 0, offsetZ: 1 }],
      trees: [{ offsetX: -2, offsetZ: -1 }, { offsetX: 2, offsetZ: -1 }],
    },
    {
      hamletId: 'bois-joli',
      centerX: playableMaxX + 6,
      centerZ: midZ,
      houses: [{ offsetX: 0, offsetZ: -1 }, { offsetX: 0, offsetZ: 1 }, { offsetX: 1, offsetZ: 0 }],
      trees: [{ offsetX: -1, offsetZ: -2 }, { offsetX: -1, offsetZ: 2 }],
      hasWell: true,
    },
    {
      hamletId: 'marais-blanc',
      centerX: playableMinX - 6,
      centerZ: midZ,
      houses: [{ offsetX: 0, offsetZ: -1 }, { offsetX: 0, offsetZ: 1 }, { offsetX: -1, offsetZ: 0 }],
      trees: [{ offsetX: 1, offsetZ: -2 }, { offsetX: 1, offsetZ: 2 }],
    },
    {
      hamletId: 'colline-rouge',
      centerX: playableMinX - 8,
      centerZ: midZ - 4,
      houses: [{ offsetX: -1, offsetZ: 0 }, { offsetX: 0, offsetZ: -1 }, { offsetX: 1, offsetZ: 1 }],
      trees: [{ offsetX: -2, offsetZ: 1 }, { offsetX: 2, offsetZ: -1 }],
      hasMarket: true,
      hasWell: true,
    },
  ];
}

/** Hamlet ids that can appear as outskirts deco (every proto except the starting id slot). */
export const NEIGHBOR_DECO_HAMLET_IDS = buildNeighborHamletDecoSpots(16).map((spot) => spot.hamletId);

/**
 * @param {string} hamletId
 * @returns {boolean}
 */
export function isNeighborDecoHamletId(hamletId) {
  return hamletId !== DEFAULT_HAMLET_ID && NEIGHBOR_DECO_HAMLET_IDS.includes(hamletId);
}
