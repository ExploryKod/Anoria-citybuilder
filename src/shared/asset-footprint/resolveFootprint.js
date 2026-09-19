/**
 * Single source of truth for an id's collision footprint (in tiles) — the
 * fact that decides both placement validity (contexts/construction) and
 * multi-tile mesh centering (presentation/three). One number, one place,
 * always explicit — no implicit default, no per-source branching.
 *
 * This file knows nothing about where a footprint number comes from — not
 * Kenney, not village, nothing. It merges the three declarative catalogs
 * (building/nature/terrain, each free to fold in its own generated data —
 * see buildingFootprint.js) into one flat table and looks ids up. Adding a
 * new source means that source's own catalog file changes; this file never
 * does.
 *
 * Throws if an id is declared nowhere — a missing footprint is a bug to fix
 * by adding the entry, never a case to silently default.
 *
 * Deliberately keyed by the game-logic id only — does NOT consult
 * presentation/three/assets/*.js to see which mesh currently renders an id
 * (shared/ must not depend on presentation/).
 */

import { BUILDING_FOOTPRINT } from './buildingFootprint.js';
import { NATURE_FOOTPRINT } from './natureFootprint.js';
import { TERRAIN_FOOTPRINT } from './terrainFootprint.js';

const FOOTPRINT = Object.freeze({
  ...BUILDING_FOOTPRINT,
  ...NATURE_FOOTPRINT,
  ...TERRAIN_FOOTPRINT,
});

/**
 * @param {string} id
 * @returns {{ width: number, depth: number }}
 */
export function resolveFootprint(id) {
  const footprint = FOOTPRINT[id];
  if (!footprint) {
    throw new Error(`[resolveFootprint] No footprint declared for "${id}" — add it to buildingFootprint.js / natureFootprint.js / terrainFootprint.js`);
  }
  return footprint;
}

/**
 * @param {string} id
 * @returns {number}
 */
export function resolveGridSize(id) {
  const { width, depth } = resolveFootprint(id);
  return Math.max(width, depth);
}
