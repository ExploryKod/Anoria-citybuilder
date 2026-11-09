import { SATISFACTION_RANGE } from '../../../../shared/trade-catalog/TradeCatalog.js';
export { formatSatisfaction, satisfactionTier } from '../../../../shared/trade-catalog/satisfaction.js';

/**
 * The commercial satisfaction of one good in one flow is one number built from the factors declared in the catalog: the city's own (`entry.satisfaction`) and the
 * common ones (`COMMON_SATISFACTION_FACTORS`). Each factor is a pure function `(context, params) => points` for one review. This policy sums the declared factors,
 * rounds the sum and clamps the result to SATISFACTION_RANGE (-100..100), and keeps what each factor gave so the player can read why.
 *
 * Open to extension, closed to modification: a new factor is one entry in SATISFACTION_FACTORS, and `reviewSatisfaction` never changes. A factor name the registry does
 * not know throws, and so does a factor that returns something that is not a number: no stand-in points.
 *
 * @typedef {{ name: string, [param: string]: number | string }} SatisfactionFactorSpec
 * @typedef {{
 *   sold: boolean,      // the order found something to trade
 *   ready: number,      // the deals waiting against what an order asks, 0..1
 *   dutyRate: number,   // our customs duty on the good in this flow, 0..1
 * }} SatisfactionContext  what happened since the last review
 */

/** @type {Readonly<Record<string, (context: SatisfactionContext, params: object) => number>>} */
export const SATISFACTION_FACTORS = Object.freeze({
  /** Gain when the order found something to trade, loss when it found nothing: the reliability of the orders (each city's own figures). */
  sales: ({ sold }, { gain, loss }) => (sold ? gain : -loss),
  /** The deals waiting against what an order asks: everything there earns `points`, nothing costs `points`, linearly between. */
  availability: ({ ready }, { points }) => (2 * ready - 1) * points,
  /** Our duty makes the exchange dearer for the partner's merchants: `perDuty` points lost for a duty of 100 %. */
  barriers: ({ dutyRate }, { perDuty }) => -dutyRate * perDuty,
});

/**
 * @param {number} current satisfaction before the review (-100..100)
 * @param {ReadonlyArray<SatisfactionFactorSpec>} factorSpecs the declared factors (the city's and the common ones)
 * @param {SatisfactionContext} context
 * @returns {{ score: number, contributions: Record<string, number> }} the new satisfaction (-100..100) and what each factor gave (before the rounding)
 */
export function reviewSatisfaction(current, factorSpecs, context) {
  let points = 0;
  const contributions = {};
  for (const spec of factorSpecs) {
    const factor = SATISFACTION_FACTORS[spec.name];
    if (!factor) {
      throw new Error(`[trade] unknown satisfaction factor "${spec.name}": declare it in SATISFACTION_FACTORS`);
    }
    const contribution = factor(context, spec);
    if (!Number.isFinite(contribution)) {
      throw new Error(`[trade] satisfaction factor "${spec.name}" returned ${contribution}, expected a number`);
    }
    contributions[spec.name] = contribution;
    points += contribution;
  }
  const score = Math.max(SATISFACTION_RANGE.min, Math.min(SATISFACTION_RANGE.max, Math.round(current + points)));
  return { score, contributions };
}
