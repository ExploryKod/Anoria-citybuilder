/**
 * Presentation-owned category id lists derived from BUILDING_ASSETS's own
 * button.group field — not a second hand-typed list to keep in sync with
 * the catalog. Lives in presentation/ (not shared/) because button.group
 * is itself a presentation fact (carousel grouping); shared/ must not
 * depend on presentation/ (see asset-footprint/resolveFootprint.js).
 */

import { BUILDING_ASSETS } from './buildingAssets.js';
import { palaces } from '../../../shared/building-catalog/buildingCategories.js';

/**
 * @param {string} group
 * @returns {ReadonlyArray<string>}
 */
function idsByButtonGroup(group) {
  return Object.entries(BUILDING_ASSETS)
    .filter(([, entry]) => entry.button?.group === group)
    .map(([id]) => id);
}

const PALACE_ID_SET = new Set(palaces);

// House-2Story shares the 'houses' carousel tab (button.group) but is a
// palace, not a house, for gameplay purposes (see shared/building-catalog/
// buildingCategories.js's `palaces`) — carousel grouping and game
// classification aren't the same fact, so subtract it explicitly rather
// than re-declaring it here.
export const houses = Object.freeze(
  idsByButtonGroup('houses').filter((id) => !PALACE_ID_SET.has(id))
);

export const commerce = Object.freeze(idsByButtonGroup('markets'));
