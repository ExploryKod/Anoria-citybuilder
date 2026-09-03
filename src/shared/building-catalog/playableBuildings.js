/**
 * Which building types the player can place — derived purely from whether
 * the merged economy catalog (buildingCatalog + Kenney registry) has a real
 * entry for the id. No separate allowlist: a missing economy entry means
 * "not a real buildable type," not "temporarily hidden." Whether an id also
 * gets a carousel button is a presentation-layer decision (see
 * buildingAssets.js/natureAssets.js `button` field) — this file only knows
 * "is there a price for this," which is all economy code needs.
 */

import { buildingCatalog } from './buildingCatalog.js';
import { KENNEY_BUILDING_CATALOG_ENTRIES } from './kenneyCityKitRegistry.generated.js';

const PLAYABLE_BUILDING_IDS = Object.freeze([
  ...Object.keys(buildingCatalog),
  ...Object.keys(KENNEY_BUILDING_CATALOG_ENTRIES),
]);

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
