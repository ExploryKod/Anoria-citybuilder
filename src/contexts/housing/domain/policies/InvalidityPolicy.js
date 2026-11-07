import { HEALTH_SEVERE_BELOW, INVALIDITY_MONTHS } from '../../../../shared/population/HealthFactorCatalog.js';

/**
 * Invalidity (HealthFactorCatalog.js): a citizen whose health stays under the severe threshold `INVALIDITY_MONTHS` months in a row is invalid. The rule of his social
 * category (`{ permanent }`, or null for a category that cannot become invalid) says whether it is for life. What a month leaves of it is two facts on the citizen —
 * the months in a row he has been that ill, and whether he is invalid for good — and whether he is invalid now is read from them, never stored.
 */

/**
 * What a month of the given health makes of a citizen's invalidity.
 * @param {{ severeMonths: number, invalid: boolean }} citizen
 * @param {number} health the lower of his two scores (the body's and the mind's) as he has just reached them: a grave illness of either makes invalid
 * @param {{ permanent: boolean } | null} rule his category's invalidity rule
 * @returns {{ severeMonths: number, invalid: boolean }}
 */
export function invalidityAfter(citizen, health, rule) {
  if (!rule) return { severeMonths: 0, invalid: false };
  const severeMonths = health < HEALTH_SEVERE_BELOW ? citizen.severeMonths + 1 : 0;
  return { severeMonths, invalid: citizen.invalid || (rule.permanent && severeMonths >= INVALIDITY_MONTHS) };
}

/**
 * Whether a citizen is invalid now: for good, or for as long as he stays that ill.
 * @param {{ severeMonths: number, invalid: boolean }} citizen
 * @param {{ permanent: boolean } | null} rule
 * @returns {boolean}
 */
export function isInvalid(citizen, rule) {
  return rule !== null && (citizen.invalid || citizen.severeMonths >= INVALIDITY_MONTHS);
}
