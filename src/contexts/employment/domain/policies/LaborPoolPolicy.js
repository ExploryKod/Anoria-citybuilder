/**
 * House population: citizens (worker-eligible) vs élites (additive at palace).
 *
 * - Regular house: pop = citizens only (max 6).
 * - Palace: up to 6 citizens + élites beyond citizen cap (pop 7 → 6 citizens + 1 élite).
 * - workerPop excludes élites; food consumes full pop (élites eat).
 *
 * Which SKILL a house's citizens can work with, at which level, is a
 * catalog fact (shared/population/socialCategoryCatalog.js via
 * GroupSkillPolicy.js) — this module only turns `pop` into a headcount,
 * it doesn't gate who's employable.
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
 * Eligibility for any ONE job is entirely skill-driven (does this house's
 * tier grant the job's required skill, at the required level? — see
 * GroupSkillPolicy.js / socialCategoryCatalog.js), never gated here by
 * house level: a level-1 (hunter-gatherer) house's citizens do hold a
 * skill — `spiritual` — so they must be countable as headcount just like
 * any other house; DistributeCityWorkers only ever calls this for houses
 * that already passed its own per-skill filter, so no separate blanket
 * "is this level employable at all" flag is needed (or read) here.
 *
 * @param {string} type
 * @param {number} pop
 * @returns {number}
 */
export function citizenPopFromHouse(type, pop) {
  const p = clampPop(pop);
  return p - elitePopFromHouse(type, p);
}

/**
 * Worker pool contribution from a house (citizens only — élites excluded).
 * Callers may still pass a `level` (unused here — kept accepted, not read,
 * so existing call sites built around a per-house snapshot don't need an
 * unrelated signature edit) for skill eligibility, decided upstream.
 * @param {string} type
 * @param {number} pop
 * @returns {number}
 */
export function workerPopFromHouse(type, pop) {
  return citizenPopFromHouse(type, pop);
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
