import { MONTHS_PER_YEAR } from '../../../../shared/time/TimeCalendar.js';
import { SCARCITY_RESPONSE } from '../../../../shared/resource-catalog/ScarcityCatalog.js';

/**
 * How short, or how plentiful, a need is: the stock the city holds against the months it must last (until the next harvest).
 * @param {{ stock: number, monthlyDemand: number, monthsToHarvest: number }} params `stock`: units of the need the whole city holds; `monthlyDemand`: what its citizens use in a month;
 *   `monthsToHarvest`: months until the stock is renewed (the stock a normal year leaves is exactly that many months of demand)
 * @returns {{ coverMonths: number, expectedMonths: number, gapMonths: number }} `gapMonths` is below nothing when short, above when plentiful
 */
export function coverOf({ stock, monthlyDemand, monthsToHarvest }) {
  for (const [name, value] of Object.entries({ stock, monthlyDemand, monthsToHarvest })) {
    if (!Number.isFinite(value) || value < 0) throw new Error(`[scarcity] ${name} must be a number of zero or more, got ${value}`);
  }
  const expectedMonths = monthsToHarvest;
  const coverMonths = monthlyDemand > 0 ? stock / monthlyDemand : expectedMonths;
  return { coverMonths, expectedMonths, gapMonths: coverMonths - expectedMonths };
}

/**
 * The factor on a good's retail price given the gap between the stock and the stock expected (ScarcityCatalog.js).
 * @param {number} gapMonths from `coverOf`
 * @returns {number} 1 when the stock is what the year expects, up to the cap when short, down to the floor when plentiful
 */
export function scarcityFactorOf(gapMonths) {
  if (!Number.isFinite(gapMonths)) throw new Error(`[scarcity] the gap must be a number of months, got ${gapMonths}`);
  const { slopeShort, slopeGlut, floor, cap } = SCARCITY_RESPONSE;
  const share = gapMonths / MONTHS_PER_YEAR;
  const factor = share < 0 ? 1 - slopeShort * share : 1 - slopeGlut * share;
  return Math.min(cap, Math.max(floor, factor));
}
