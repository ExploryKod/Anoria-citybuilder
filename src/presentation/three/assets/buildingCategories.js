/**
 * Presentation-owned category id lists derived from BUILDING_ASSETS's own
 * button.group field — not a second hand-typed list to keep in sync with
 * the catalog. Lives in presentation/ (not shared/) because button.group
 * is itself a presentation fact (carousel grouping); shared/ must not
 * depend on presentation/ (see asset-footprint/resolveFootprint.js).
 */

import { BUILDING_ASSETS } from './buildingAssets.js';

/**
 * @param {string} group
 * @returns {ReadonlyArray<string>}
 */
function idsByButtonGroup(group) {
  return Object.entries(BUILDING_ASSETS)
    .filter(([, entry]) => entry.button?.group === group)
    .map(([id]) => id);
}

export const houses = Object.freeze(idsByButtonGroup('houses'));

export const commerce = Object.freeze(idsByButtonGroup('markets'));

/**
 * The tool a build-bar category pill IS, when the catalog says so
 * (`button.pillCategory`): the pill activates it directly and no carousel is
 * shown under it. `null` for a category that lists tools to choose from.
 * @param {string} categoryId The pill's category id.
 * @returns {string | null}
 */
export function getDirectToolForCategory(categoryId) {
  const entry = Object.entries(BUILDING_ASSETS).find(
    ([, asset]) => asset.button?.pillCategory === categoryId
  );
  return entry ? entry[0] : null;
}
