/** Max citizen slots per house (regular or palace). */
export const HOUSE_CITIZEN_CAP = 6;

/** Max total pop for a regular house (citizens only). */
export const REGULAR_HOUSE_MAX_POP = HOUSE_CITIZEN_CAP;

/** Max total pop for a palace (6 citizens + 1 élite slot at this stage). */
export const PALACE_MAX_POP = HOUSE_CITIZEN_CAP + 1;

/** Level 1 (autarky, hunter-gatherer): reuses the historical regular-house cap. */
export const HOUSE_LEVEL_1_MAX_POP = REGULAR_HOUSE_MAX_POP;

/** Level 2 (group profession, road required): double the level-1 cap. */
export const HOUSE_LEVEL_2_MAX_POP = HOUSE_LEVEL_1_MAX_POP * 2;

/**
 * Max population for a Blue/Red/Purple house at a given level (1 or 2).
 * Palace capacity stays governed by `maxPopulationForHouseType` (frozen path).
 * @param {1 | 2} level
 * @returns {number}
 */
export function maxPopulationForLevel(level) {
  return level === 2 ? HOUSE_LEVEL_2_MAX_POP : HOUSE_LEVEL_1_MAX_POP;
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
  return isPalaceHouseType(type) ? PALACE_MAX_POP : REGULAR_HOUSE_MAX_POP;
}
