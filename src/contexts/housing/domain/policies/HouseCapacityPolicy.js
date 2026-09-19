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

/** Level 3 (established): steady growth beyond level 2. */
export const HOUSE_LEVEL_3_MAX_POP = HOUSE_LEVEL_2_MAX_POP + HOUSE_LEVEL_1_MAX_POP;

/** Level 4 (affluent): steady growth beyond level 3. */
export const HOUSE_LEVEL_4_MAX_POP = HOUSE_LEVEL_3_MAX_POP + HOUSE_LEVEL_1_MAX_POP;

/** Level 5 ("manoir"): steady growth beyond level 4. */
export const HOUSE_LEVEL_5_MAX_POP = HOUSE_LEVEL_4_MAX_POP + HOUSE_LEVEL_1_MAX_POP;

/** Population cap per house tier — add a key here for a new tier, no code change. */
const HOUSE_TIER_MAX_POP = Object.freeze({
  1: HOUSE_LEVEL_1_MAX_POP,
  2: HOUSE_LEVEL_2_MAX_POP,
  3: HOUSE_LEVEL_3_MAX_POP,
  4: HOUSE_LEVEL_4_MAX_POP,
  5: HOUSE_LEVEL_5_MAX_POP,
});

/**
 * Max population for a Blue/Red/Purple house at a given tier. An unknown
 * tier (including none reached yet) falls back to tier 1's cap.
 * Palace capacity stays governed by `maxPopulationForHouseType` (frozen path).
 * @param {number} level
 * @returns {number}
 */
export function maxPopulationForLevel(level) {
  return HOUSE_TIER_MAX_POP[level] ?? HOUSE_LEVEL_1_MAX_POP;
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
