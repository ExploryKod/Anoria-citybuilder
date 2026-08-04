/**
 * House population: citizens (worker-eligible) vs élites (additive at palace).
 *
 * - Regular house: pop = citizens only (max 6).
 * - Palace: up to 6 citizens + élites beyond citizen cap (pop 7 → 6 citizens + 1 élite).
 * - workerPop excludes élites; food consumes full pop (élites eat).
 */

/** Max citizen slots per house (regular or palace). */
export const HOUSE_CITIZEN_CAP = 6;

/** Max total pop for a regular house (citizens only). */
export const REGULAR_HOUSE_MAX_POP = HOUSE_CITIZEN_CAP;

/** Max total pop for a palace (6 citizens + 1 élite slot at this stage). */
export const PALACE_MAX_POP = HOUSE_CITIZEN_CAP + 1;

/**
 * @param {string} type
 * @returns {boolean}
 */
export function isPalaceHouseType(type) {
  const t = type || '';
  return t.includes('2Story') || t.includes('2-Story');
}

/**
 * @param {string} type
 * @returns {number}
 */
export function maxTotalPopForHouse(type) {
  return isPalaceHouseType(type) ? PALACE_MAX_POP : REGULAR_HOUSE_MAX_POP;
}

/**
 * @param {number} pop
 * @returns {number}
 */
function clampPop(pop) {
  return Number.isFinite(pop) ? Math.max(0, Math.floor(pop)) : 0;
}

/**
 * Élites in a palace: population beyond the citizen cap (additive, not subtracted from citizens).
 * @param {string} type
 * @param {number} pop
 * @returns {number}
 */
export function elitePopFromHouse(type, pop) {
  const p = clampPop(pop);
  if (p <= 0 || !isPalaceHouseType(type)) return 0;
  return Math.max(0, p - HOUSE_CITIZEN_CAP);
}

/**
 * Citizens (non-élite residents); eligible for worker jobs.
 *
 * Level 1 (autarky / hunter-gatherer) houses are outside the labor market by
 * design — 0 regardless of `pop`. Level defaults to 2 for backward
 * compatibility with callers that don't track it yet (e.g. Palace, which has
 * no level concept and always contributes its citizens).
 *
 * @param {string} type
 * @param {number} pop
 * @param {1 | 2} [level=2]
 * @returns {number}
 */
export function citizenPopFromHouse(type, pop, level = 2) {
  if (level === 1) return 0;
  const p = clampPop(pop);
  return p - elitePopFromHouse(type, p);
}

/**
 * Worker pool contribution from a house (citizens only — élites excluded).
 * @param {string} type
 * @param {number} pop
 * @param {1 | 2} [level=2]
 * @returns {number}
 */
export function workerPopFromHouse(type, pop, level = 2) {
  return citizenPopFromHouse(type, pop, level);
}

/**
 * Pop granted when a house evolves into a palace (+1 élite, citizens unchanged).
 * @param {number} currentPop
 * @returns {number}
 */
export function popAfterPalaceEvolution(currentPop) {
  return clampPop(currentPop) + 1;
}

/**
 * Pop after palace regression (remove additive élites).
 * @param {string} palaceType
 * @param {number} currentPop
 * @returns {number}
 */
export function popAfterPalaceRegression(palaceType, currentPop) {
  const p = clampPop(currentPop);
  return Math.max(0, p - elitePopFromHouse(palaceType, p));
}
