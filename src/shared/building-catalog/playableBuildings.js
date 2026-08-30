/**
 * Which building types the player can place in the current Kenney-focused game.
 * Legacy village types remain in buildingCatalog for saves; only farms + roads stay playable.
 */

import { KENNEY_CITY_KIT_BUILDING_IDS } from './kenneyCityKitRegistry.generated.js';
import { VILLAGE_PLAYABLE_TOOL_IDS_BY_CATEGORY } from './villageAssetSets.js';

const KENNEY_PLAYABLE = new Set(KENNEY_CITY_KIT_BUILDING_IDS);

const VILLAGE_PLAYABLE = new Set(
  Object.values(VILLAGE_PLAYABLE_TOOL_IDS_BY_CATEGORY).flat(),
);

/**
 * @param {string | null | undefined} buildingId
 * @returns {boolean}
 */
export function isPlayableBuildingId(buildingId) {
  if (!buildingId) return false;
  return KENNEY_PLAYABLE.has(buildingId) || VILLAGE_PLAYABLE.has(buildingId);
}

/** @returns {ReadonlyArray<string>} */
export function getPlayableBuildingIds() {
  return Object.freeze([...KENNEY_CITY_KIT_BUILDING_IDS, ...VILLAGE_PLAYABLE]);
}
