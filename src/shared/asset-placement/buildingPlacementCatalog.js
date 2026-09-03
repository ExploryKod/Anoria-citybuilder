/**
 * Building placement catalog: merges two catalog families into one flat
 * per-id lookup — price/category from `buildingCatalog.js` and
 * gridSize/footprintWidth/footprintDepth from
 * `asset-footprint/resolveFootprint.js` (single-sourced there, not
 * duplicated here). Pure data — no Three.js.
 *
 * Exists so construction, scene, and the mesh loader can read one flat
 * shape instead of each re-deriving `{...construction, ...footprint}`
 * itself.
 *
 * Every building catalog entry is playable — there is no separate
 * "playable" subset. An id either has a real construction fact (and shows
 * up here) or it doesn't exist as a buildable type at all. If a specific
 * catalog entry ever needs to exist without being placeable, that's an
 * explicit `isPlayable: false` fact on the entry itself, not a derived
 * filter here.
 */

import { buildingCatalog } from '../building-catalog/buildingCatalog.js';
import { resolveFootprint, resolveGridSize } from '../asset-footprint/resolveFootprint.js';

/**
 * @type {Readonly<Record<string, { price: number, category: string, gridSize: number, footprintWidth?: number, footprintDepth?: number }>>}
 */
export const buildingPlacementCatalog = Object.freeze(
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
