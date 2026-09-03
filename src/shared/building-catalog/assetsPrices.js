/**
 * Placement / economy catalog: price, UI category, footprint size, and
 * which ids are playable at all.
 * Pure data — no Three.js. Source of truth for construction cost lookups.
 *
 * Derived from `buildingCatalog.js` (price/category — already merged village
 * + Kenney, no separate Kenney import needed here) and
 * `asset-footprint/resolveFootprint.js` (gridSize/footprintWidth/
 * footprintDepth — single-sourced there, not duplicated here). This file
 * keeps its historic export name/shape so existing call sites (construction,
 * scene, mesh loader) don't change.
 *
 * Playability is derived purely from having a real economy-catalog entry —
 * no separate allowlist. A missing entry means "not a real buildable type,"
 * not "temporarily hidden." Whether an id also gets a carousel button is a
 * presentation-layer decision (see buildingAssets.js/natureAssets.js
 * `button` field) — this file only knows "is there a price for this," which
 * is all economy code needs.
 */

import { buildingCatalog } from './buildingCatalog.js';
import { resolveFootprint, resolveGridSize } from '../asset-footprint/resolveFootprint.js';

const PLAYABLE_BUILDING_IDS = Object.freeze(Object.keys(buildingCatalog));
const PLAYABLE_BUILDING_ID_SET = new Set(PLAYABLE_BUILDING_IDS);

/**
 * @param {string | null | undefined} buildingId
 * @returns {boolean}
 */
export function isPlayableBuildingId(buildingId) {
  return Boolean(buildingId) && PLAYABLE_BUILDING_ID_SET.has(buildingId);
}

/** @returns {ReadonlyArray<string>} */
export function getPlayableBuildingIds() {
  return PLAYABLE_BUILDING_IDS;
}

function buildAssetsPrices({ playableOnly = false } = {}) {
  /** @type {Record<string, { price: number, category: string, gridSize: number, footprintWidth?: number, footprintDepth?: number }>} */
  const prices = {};
  for (const [id, definition] of Object.entries(buildingCatalog)) {
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
