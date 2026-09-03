/**
 * Placement / economy catalog: price, UI category, footprint size.
 * Pure data — no Three.js. Source of truth for construction cost lookups.
 *
 * Derived from `buildingCatalog.js` (price/category) and
 * `asset-footprint/resolveFootprint.js` (gridSize/footprintWidth/
 * footprintDepth — single-sourced there, not duplicated here). This file
 * keeps its historic export name/shape so existing call sites (construction,
 * scene, mesh loader) don't change.
 */

import { buildingCatalog } from './buildingCatalog.js';
import { KENNEY_BUILDING_CATALOG_ENTRIES } from './kenneyCityKitRegistry.generated.js';
import { isPlayableBuildingId } from './playableBuildings.js';
import { resolveFootprint, resolveGridSize } from '../asset-footprint/resolveFootprint.js';

function buildAssetsPrices({ playableOnly = false } = {}) {
  /** @type {Record<string, { price: number, category: string, gridSize: number, footprintWidth?: number, footprintDepth?: number }>} */
  const prices = {};
  const mergedCatalog = { ...buildingCatalog, ...KENNEY_BUILDING_CATALOG_ENTRIES };
  for (const [id, definition] of Object.entries(mergedCatalog)) {
    if (!definition.construction) continue;
    if (playableOnly && !isPlayableBuildingId(id)) continue;
    const footprint = resolveFootprint(id);
    prices[id] = {
      price: definition.construction.price,
      category: definition.construction.category,
      gridSize: resolveGridSize(id),
      footprintWidth: footprint.width,
      footprintDepth: footprint.depth,
    };
  }
  return Object.freeze(prices);
}

/** Full catalog — legacy saves, hydration, economy lookups. */
export const assetsPrices = buildAssetsPrices();

/** Subset the player can place (Kenney + farms + roads). */
export const playableAssetsPrices = buildAssetsPrices({ playableOnly: true });
