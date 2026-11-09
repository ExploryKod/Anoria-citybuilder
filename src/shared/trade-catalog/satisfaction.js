/**
 * The commercial satisfaction, as the policy, the cycle and the views read it. Shared, so they use one reader.
 *
 * It is kept per partner, flow and good: `relation.goodSatisfaction[flow][good]` (-100..100), with the contributions of the last review in
 * `relation.goodReview[flow][good]`. A city's own figure is the summary of its goods, weighted by the volume of an order, and is read, never stored.
 */
import { SATISFACTION_EFFECTS, SATISFACTION_START, SATISFACTION_TIERS } from './TradeCatalog.js';

/** The goods a city's merchants really trade with us, by flow: a want no merchant house deals in is never traded. @param {object} entry a trade catalog entry */
export function tradedGoodsOf(entry) {
  return {
    export: entry.wants.filter((want) => want.merchantGood).map((want) => ({ good: want.good, volume: entry.trade.quantityPerOrder })),
    import: entry.offers.map((offer) => ({ good: offer.good, volume: offer.quantityPerOrder })),
  };
}

/** The satisfaction of a relation that has just opened: the middle of the scale for every good it trades. @param {object} entry */
export function openingGoodSatisfaction(entry) {
  const traded = tradedGoodsOf(entry);
  const start = (rows) => Object.fromEntries(rows.map(({ good }) => [good, SATISFACTION_START]));
  return { export: start(traded.export), import: start(traded.import) };
}

/** What a review has not written yet: no good has been reviewed. */
export const openingGoodReview = () => ({ export: {}, import: {} });

/**
 * The satisfaction of one good in one flow, read strictly: a good the relation does not hold is a defect, not a neutral partner.
 * @param {{ cityId?: string, goodSatisfaction?: { export: object, import: object } }} relation
 * @param {'export' | 'import'} flow
 * @param {string} good
 * @returns {number}
 */
export function goodSatisfactionOf(relation, flow, good) {
  const score = relation?.goodSatisfaction?.[flow]?.[good];
  if (!Number.isFinite(score)) {
    throw new Error(`[trade] relation ${relation?.cityId ?? '?'} has no ${flow} satisfaction for "${good}"`);
  }
  return score;
}

/**
 * The satisfaction of a whole city: its goods' scores weighted by the volume of an order, rounded. A city that trades nothing has none (a defect).
 * @param {{ cityId?: string, goodSatisfaction?: object }} relation
 * @param {object} entry the city's trade catalog entry
 * @returns {number}
 */
export function relationSatisfaction(relation, entry) {
  const traded = tradedGoodsOf(entry);
  let weighted = 0;
  let volume = 0;
  for (const flow of ['export', 'import']) {
    for (const row of traded[flow]) {
      weighted += goodSatisfactionOf(relation, flow, row.good) * row.volume;
      volume += row.volume;
    }
  }
  if (volume === 0) throw new Error(`[trade] ${entry.cityId} trades no good: it has no satisfaction to summarise`);
  return Math.round(weighted / volume);
}

/** @param {number} score @returns {string} the step of the scale the score reaches, in the player's words (TradeCatalog's SATISFACTION_TIERS) */
export function satisfactionTier(score) {
  let reached = null;
  for (const tier of SATISFACTION_TIERS) if (score >= tier.from) reached = tier;
  if (!reached) throw new Error(`[trade] the satisfaction ${score} is under the first step of SATISFACTION_TIERS`);
  return reached.label;
}

/** @param {number} score @returns {string} the score with its sign: "+25", "-40", "0" */
export function formatSatisfaction(score) {
  return score > 0 ? `+${score}` : `${score}`;
}

/** The share of an order a partner places at this satisfaction: 1 from zero up, falling to the floor at the bottom of the scale. @param {number} score @returns {number} */
export function orderShare(score) {
  if (score >= 0) return 1;
  const { quantityFloor } = SATISFACTION_EFFECTS;
  return quantityFloor + (1 - quantityFloor) * ((100 + score) / 100);
}

/** Where a sale's price range is centred at this satisfaction (-1..1, the merchants favoured when positive). @param {number} score @returns {number} */
export function saleBiasOf(score) {
  return (score / 100) * SATISFACTION_EFFECTS.priceBias;
}
