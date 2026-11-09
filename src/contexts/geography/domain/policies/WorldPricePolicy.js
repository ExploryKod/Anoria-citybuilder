import { developmentOf } from '../../../../shared/trade-catalog/TradeCatalog.js';

/**
 * The price the world puts on a good in one partner city: the world's reference price of the good (what a producer sells it at at the world's reference wage, so it does not move
 * with our wages) times the level of prices of the city's development class, times the premium (above 1) or discount (below 1) the city declares for that good. It is what the
 * city pays for what we sell it and what it asks for what it sells us (before the world's price index of the month and the freight). Pure.
 *
 * @param {{ referencePrice: number, entry: { cityId: string, development: string }, multiplier: number }} params
 * @returns {number} euros per unit
 */
export function worldUnitPrice({ referencePrice, entry, multiplier }) {
  if (!(referencePrice > 0)) throw new Error(`[trade] the reference price of the good traded with ${entry.cityId} must be above 0, got ${referencePrice}`);
  if (!(multiplier > 0)) throw new Error(`[trade] ${entry.cityId}'s premium on a good must be above 0, got ${multiplier}`);
  return referencePrice * developmentOf(entry).priceLevel * multiplier;
}
