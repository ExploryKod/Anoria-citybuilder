/**
 * Single source of truth for an id's collision footprint (in tiles) — the
 * fact that decides both placement validity (contexts/construction) and
 * multi-tile mesh centering (presentation/three). One number, one place,
 * always explicit — no implicit default to fall back on.
 *
 * Resolution:
 *  1. Kenney's own auto-generated registry (KENNEY_BUILDING_CATALOG_ENTRIES)
 *     — scanned from the real GLB bounding box, authoritative for any
 *     native Kenney id. Never hand-authored here.
 *  2. The theme-appropriate explicit map (building/nature/terrain
 *     footprint files) — every non-Kenney id is listed there by hand,
 *     including reassigned ids like House-Blue.
 *
 * Throws if an id is in neither — a missing footprint is a bug to fix by
 * adding the entry, never a case to silently default.
 *
 * Deliberately keyed by the game-logic id only — does NOT consult
 * presentation/three/assets/*.js to see which mesh currently renders an id
 * (shared/ must not depend on presentation/).
 */

import { KENNEY_BUILDING_CATALOG_ENTRIES } from '../building-catalog/kenneyCityKitRegistry.generated.js';
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
  const kenneyConstruction = KENNEY_BUILDING_CATALOG_ENTRIES[id]?.construction;
  if (kenneyConstruction) {
    return Object.freeze({
      width: kenneyConstruction.footprintWidth,
      depth: kenneyConstruction.footprintDepth,
    });
  }
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
