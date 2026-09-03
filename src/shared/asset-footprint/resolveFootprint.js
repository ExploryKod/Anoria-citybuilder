/**
 * Single source of truth for an id's collision footprint (in tiles) — the
 * fact that decides both placement validity (contexts/construction) and
 * multi-tile mesh centering (presentation/three). One number, one place.
 *
 * Resolution order:
 *  1. Kenney's own auto-generated registry (KENNEY_BUILDING_CATALOG_ENTRIES)
 *     — scanned from the real GLB bounding box, authoritative for any
 *     native Kenney id. Never hand-overridden here.
 *  2. The theme-appropriate sparse override (building/nature/terrain
 *     footprint files) — hand-authored, only for ids that deviate from 1×1.
 *  3. Default 1×1.
 *
 * Deliberately keyed by the game-logic id only — does NOT consult
 * presentation/three/assets/*.js to see which mesh currently renders an id
 * (e.g. House-Blue reassigned to a Kenney mesh keeps its own, independently
 * authored economy footprint; shared/ must not depend on presentation/).
 */

import { KENNEY_BUILDING_CATALOG_ENTRIES } from '../building-catalog/kenneyCityKitRegistry.generated.js';
import { BUILDING_FOOTPRINT_OVERRIDES } from './buildingFootprint.js';
import { NATURE_FOOTPRINT_OVERRIDES } from './natureFootprint.js';
import { TERRAIN_FOOTPRINT_OVERRIDES } from './terrainFootprint.js';

const FOOTPRINT_OVERRIDES = Object.freeze({
  ...BUILDING_FOOTPRINT_OVERRIDES,
  ...NATURE_FOOTPRINT_OVERRIDES,
  ...TERRAIN_FOOTPRINT_OVERRIDES,
});

const DEFAULT_FOOTPRINT = Object.freeze({ width: 1, depth: 1 });

/**
 * @param {string} id
 * @returns {{ width: number, depth: number }}
 */
export function resolveFootprint(id) {
  const kenneyConstruction = KENNEY_BUILDING_CATALOG_ENTRIES[id]?.construction;
  if (kenneyConstruction) {
    return Object.freeze({
      width: kenneyConstruction.footprintWidth ?? kenneyConstruction.gridSize ?? 1,
      depth: kenneyConstruction.footprintDepth ?? kenneyConstruction.gridSize ?? 1,
    });
  }
  return FOOTPRINT_OVERRIDES[id] ?? DEFAULT_FOOTPRINT;
}

/**
 * @param {string} id
 * @returns {number}
 */
export function resolveGridSize(id) {
  const { width, depth } = resolveFootprint(id);
  return Math.max(width, depth);
}
