/**
 * Presentation-owned category id lists derived from BUILDING_ASSETS's own
 * button.group field — not a second hand-typed list to keep in sync with
 * the catalog. Lives in presentation/ (not shared/) because button.group
 * is itself a presentation fact (carousel grouping); shared/ must not
 * depend on presentation/ (see asset-footprint/resolveFootprint.js).
 */

import { BUILDING_ASSETS } from './buildingAssets.js';
import { getBuildingDefinition } from '../../../shared/building-catalog/index.js';
import { SOCIAL_CATEGORY } from '../../../shared/population/socialCategoryCatalog.js';

/**
 * @param {string} group
 * @returns {ReadonlyArray<string>}
 */
function idsByButtonGroup(group) {
  return Object.entries(BUILDING_ASSETS)
    .filter(([, entry]) => entry.button?.group === group)
    .map(([id]) => id);
}

/**
 * @param {string} tag
 * @returns {ReadonlyArray<string>}
 */
function idsByTag(tag) {
  return Object.entries(BUILDING_ASSETS)
    .filter(([, entry]) => entry.tags?.includes(tag))
    .map(([id]) => id);
}

export const houses = Object.freeze(idsByButtonGroup('houses'));

/**
 * The build-bar pill a building is listed under. A WORKPLACE belongs to the social class whose houses staff it: the class
 * that grants the skill the building requires (`employment.requiredSkill`, granted in socialCategoryCatalog.js), so
 * moving a skill from one class to another moves the buildings it staffs with it, and nothing is listed twice. Anything
 * that employs nobody (the houses, the roads) says its own pill in `button.group`. Neither means a catalog defect.
 * @param {string} toolId
 * @returns {string} 'artisans' | 'merchants' | 'scholars', or the asset's own `button.group`
 */
export function toolbarGroupOf(toolId) {
  const button = BUILDING_ASSETS[toolId]?.button;
  if (!button) throw new Error(`[toolbar] "${toolId}" has no button in buildingAssets.js: it is not a tool`);
  const skill = getBuildingDefinition(toolId)?.employment?.requiredSkill;
  if (skill) {
    const group = Object.keys(SOCIAL_CATEGORY).find((candidate) =>
      Object.values(SOCIAL_CATEGORY[candidate].tiers).some((tier) => (tier.skills[skill] ?? 0) >= 1));
    if (!group) throw new Error(`[toolbar] "${toolId}" is staffed by the skill "${skill}", which no social class grants`);
    return group;
  }
  if (!button.group) throw new Error(`[toolbar] "${toolId}" employs nobody and declares no button.group: no pill to list it under`);
  return button.group;
}

// By `tags` (semantic — "this is a market"), not `button.group` (which build-bar tab shows it):
// a market shares its carousel tab with warehouses, but is still a market for whoever asks.
export const commerce = Object.freeze(idsByTag('markets'));

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
