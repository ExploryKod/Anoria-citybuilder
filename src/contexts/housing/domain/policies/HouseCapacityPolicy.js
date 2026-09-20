import { SOCIAL_CATEGORY } from '../../../../shared/population/socialCategoryCatalog.js';
import { getBuildingDefinition } from '../../../../shared/building-catalog/buildingCatalog.js';

/** Max citizen slots per house (regular or palace) — beyond this a resident counts as élite. */
export const HOUSE_CITIZEN_CAP = 6;

/** Max total pop for a palace (citizen slots + 1 élite slot at this stage). */
export const PALACE_MAX_POP = HOUSE_CITIZEN_CAP + 1;

/**
 * Population ceiling of a house of `group` at `level`, straight from the
 * social-category catalog (`tiers[level].maxPopulation`). An unknown level
 * (including none reached yet) falls back to the group's first tier; an
 * unknown group has no ceiling declared, so 0.
 *
 * @param {number} level
 * @param {string} group Residential group ('artisans' | 'merchants' | 'scholars' …).
 * @returns {number}
 */
export function maxPopulationForLevel(level, group) {
  const tiers = SOCIAL_CATEGORY[group]?.tiers;
  return tiers?.[level]?.maxPopulation ?? tiers?.[1]?.maxPopulation ?? 0;
}

/**
 * @param {string} type Catalog house type.
 * @returns {string | undefined} Its permanent residential group, if any.
 */
export function residentialGroupOfType(type) {
  return getBuildingDefinition(type)?.residentialGroup;
}

/**
 * @param {string} type
 * @returns {boolean}
 */
export function isPalaceHouseType(type) {
  const t = type || '';
  return t.includes('2Story') || t.includes('2-Story');
}

/**
 * Residential house types that participate in population growth.
 * @param {string} type
 * @returns {boolean}
 */
export function isResidentialHouseType(type) {
  const t = type || '';
  return (
    t.includes('House-Blue') ||
    t.includes('House-Red') ||
    t.includes('House-Purple') ||
    t.includes('House-2Story') ||
    t.includes('House_2Story')
  );
}

/**
 * @param {string} type
 * @returns {number}
 */
export function maxPopulationForHouseType(type) {
  if (!isResidentialHouseType(type)) return 0;
  return isPalaceHouseType(type) ? PALACE_MAX_POP : maxPopulationForLevel(1, residentialGroupOfType(type));
}
