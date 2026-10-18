import { SATISFACTION_RANGE } from '../../../../shared/trade-catalog/TradeCatalog.js';
export { satisfactionOf, formatSatisfaction } from '../../../../shared/trade-catalog/satisfaction.js';

/**
 * A trade relation's satisfaction is one number built from the factors its catalog entry declares
 * (`TradeCatalog.js` → `satisfaction`). Each factor is a pure function `(context, params) => points`
 * for one review. This policy sums the declared factors and clamps the result to SATISFACTION_RANGE (-100..100).
 *
 * Open to extension, closed to modification: a new factor is one entry in SATISFACTION_FACTORS, and
 * `reviewSatisfaction` never changes. A factor name the registry does not know throws, and so does a
 * factor that returns something that is not a number: no stand-in points.
 *
 * @typedef {{ name: string, [param: string]: number }} SatisfactionFactorSpec
 * @typedef {{ sold: boolean }} SatisfactionContext  what happened since the last review
 */

/** @type {Readonly<Record<string, (context: SatisfactionContext, params: object) => number>>} */
export const SATISFACTION_FACTORS = Object.freeze({
  /** Gain when the merchant sold something on the review, loss when the order found nothing to sell. */
  sales: ({ sold }, { gain, loss }) => (sold ? gain : -loss),
});

/**
 * @param {number} current satisfaction before the review (-100..100)
 * @param {ReadonlyArray<SatisfactionFactorSpec>} factorSpecs the entry's declared factors
 * @param {SatisfactionContext} context
 * @returns {number} the new satisfaction, -100..100
 */
export function reviewSatisfaction(current, factorSpecs, context) {
  let points = 0;
  for (const spec of factorSpecs) {
    const factor = SATISFACTION_FACTORS[spec.name];
    if (!factor) {
      throw new Error(`[trade] unknown satisfaction factor "${spec.name}": declare it in SATISFACTION_FACTORS`);
    }
    const contribution = factor(context, spec);
    if (!Number.isFinite(contribution)) {
      throw new Error(`[trade] satisfaction factor "${spec.name}" returned ${contribution}, expected a number`);
    }
    points += contribution;
  }
  return Math.max(SATISFACTION_RANGE.min, Math.min(SATISFACTION_RANGE.max, current + points));
}
