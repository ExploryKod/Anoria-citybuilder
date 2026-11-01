import { isWithinRange, manhattanDistance } from './ResourceRangePolicy.js';

/**
 * Which plots a producer buys: when the natural sources in its range have run short (fewer than `buysBelowSources` still hold some), it buys the nearest plots
 * for sale for its use, within its range, up to `tilesPerPurchase` tiles. Nothing else decides: whether it can pay is the books' business.
 *
 * @param {object} params
 * @param {{ x: number, y: number }} params.buyer
 * @param {number} params.sourcesInRange how many natural sources of its resource still hold some within its range
 * @param {Array<{ x: number, y: number, use: string, owner: string | null }>} params.plots every plot of the hamlet
 * @param {{ use: string, buysBelowSources: number, tilesPerPurchase: number }} params.landPurchase the producer's catalog fact
 * @param {number} params.range how far it reaches
 * @returns {Array<{ x: number, y: number, use: string, owner: null }>} the plots to buy, nearest first (none when it has enough sources)
 */
export function plotsToBuy({ buyer, sourcesInRange, plots, landPurchase, range }) {
  if (sourcesInRange >= landPurchase.buysBelowSources) return [];
  return plots
    .filter((plot) => plot.owner === null && plot.use === landPurchase.use && isWithinRange(buyer, plot, range))
    .sort((a, b) => manhattanDistance(buyer, a) - manhattanDistance(buyer, b) || a.y - b.y || a.x - b.x)
    .slice(0, landPurchase.tilesPerPurchase);
}
