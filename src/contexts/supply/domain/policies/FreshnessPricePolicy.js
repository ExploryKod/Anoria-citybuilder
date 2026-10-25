/**
 * The price of a unit follows its freshness: the full price while more than `fullPriceAboveLifeShare` of its life is left, then a straight line down to `floor` times the price
 * on the day it goes bad (see ResourceCategoryCatalog.js). The units of a stock are sold oldest first, so they are sold cheapest first.
 */

/**
 * @param {{ remainingTurns: number, lifeTurns: number, curve: { fullPriceAboveLifeShare: number, floor: number } }} params
 * @returns {number} the factor on the price, between `floor` and 1 (1 for a good that never goes bad)
 */
export function freshnessFactor({ remainingTurns, lifeTurns, curve }) {
  if (lifeTurns === Infinity) return 1;
  if (!(lifeTurns > 0)) throw new Error(`[freshness] a life must be above 0 turns, got ${lifeTurns}`);
  if (!(curve.fullPriceAboveLifeShare > 0 && curve.fullPriceAboveLifeShare <= 1) || !(curve.floor > 0 && curve.floor <= 1)) {
    throw new Error(`[freshness] a curve needs a share of life in ]0, 1] and a floor in ]0, 1], got ${JSON.stringify(curve)}`);
  }
  const share = Math.min(1, Math.max(0, remainingTurns / lifeTurns));
  if (share >= curve.fullPriceAboveLifeShare) return 1;
  return curve.floor + (1 - curve.floor) * (share / curve.fullPriceAboveLifeShare);
}

/**
 * The factor of the n-th unit (0 is the oldest) of a stock sold oldest first.
 * @param {{ ages: ReadonlyArray<[number, number]>, nth: number, turn: number, lifeTurns: number, curve: { fullPriceAboveLifeShare: number, floor: number } }} params
 * `ages` are the batches in step with the stock (see `reconcileAges`), oldest first.
 * @returns {number}
 */
export function freshnessFactorOfNthUnit({ ages, nth, turn, lifeTurns, curve }) {
  if (lifeTurns === Infinity) return 1;
  let before = 0;
  for (const [born, amount] of ages) {
    if (nth < before + amount) return freshnessFactor({ remainingTurns: lifeTurns - (turn - born), lifeTurns, curve });
    before += amount;
  }
  throw new Error(`[freshness] the stock holds ${before} units, there is no unit number ${nth} to price`);
}
