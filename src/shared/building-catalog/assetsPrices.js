/**
 * Placement / economy catalog: price, UI category, footprint size.
 * Pure data — no Three.js. Source of truth for construction cost lookups.
 *
 * Derived from `buildingCatalog.js` (the single source of truth for static
 * per-building facts). This file keeps its historic export name/shape so
 * existing call sites (construction, scene, mesh loader) don't change.
 */

import { buildingCatalog } from './buildingCatalog.js';

function buildAssetsPrices() {
  /** @type {Record<string, { price: number, category: string, gridSize: number }>} */
  const prices = {};
  for (const [id, definition] of Object.entries(buildingCatalog)) {
    if (!definition.construction) continue;
    prices[id] = { ...definition.construction };
  }
  return Object.freeze(prices);
}

export const assetsPrices = buildAssetsPrices();
