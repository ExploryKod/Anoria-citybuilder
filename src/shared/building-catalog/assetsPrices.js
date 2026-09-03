/**
 * Placement / economy catalog: price, UI category, footprint size for every
 * building type. Pure data — no Three.js. Source of truth for construction
 * cost lookups.
 *
 * Derived from `buildingCatalog.js` (price/category) and
 * `asset-footprint/resolveFootprint.js` (gridSize/footprintWidth/
 * footprintDepth — single-sourced there, not duplicated here). This file
 * keeps its historic export name/shape so existing call sites (construction,
 * scene, mesh loader) don't change.
 *
 * Every building catalog entry is playable — there is no separate
 * "playable" subset. An id either has a real construction fact (and shows
 * up here) or it doesn't exist as a buildable type at all. If a specific
 * catalog entry ever needs to exist without being placeable, that's an
 * explicit `isPlayable: false` fact on the entry itself, not a derived
 * filter here.
 */

import { buildingCatalog } from './buildingCatalog.js';
import { resolveFootprint, resolveGridSize } from '../asset-footprint/resolveFootprint.js';

/**
 * @type {Readonly<Record<string, { price: number, category: string, gridSize: number, footprintWidth?: number, footprintDepth?: number }>>}
 */
export const assetsPrices = Object.freeze(
  Object.fromEntries(
    Object.entries(buildingCatalog)
      .filter(([, definition]) => definition.construction)
      .map(([id, definition]) => {
        const footprint = resolveFootprint(id);
        return [
          id,
          {
            price: definition.construction.price,
            category: definition.construction.category,
            gridSize: resolveGridSize(id),
            footprintWidth: footprint.width,
            footprintDepth: footprint.depth,
          },
        ];
      })
  )
);
