/**
 * House population: every resident is a citizen, worker-eligible.
 *
 * - Regular house: pop = citizens (max 6).
 * - Palace: one more slot than a regular house (pop 7).
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

/** Max total pop for a palace (one slot more than a regular house). */
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
 * Citizens (every resident); eligible for worker jobs.
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
export function citizenPopFromHouse(_type, pop) {
  return clampPop(pop);
}

/**
 * Worker pool contribution from a house (every resident).
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
 * Pop granted when a house evolves into a palace (one more resident).
 * @param {number} currentPop
 * @returns {number}
 */
export function popAfterPalaceEvolution(currentPop) {
  return clampPop(currentPop) + 1;
}

/**
 * Pop after palace regression (back to the regular house cap).
 * @param {string} palaceType
 * @param {number} currentPop
 * @returns {number}
 */
export function popAfterPalaceRegression(palaceType, currentPop) {
  const p = clampPop(currentPop);
  return isPalaceHouseType(palaceType) ? Math.min(p, HOUSE_CITIZEN_CAP) : p;
}
