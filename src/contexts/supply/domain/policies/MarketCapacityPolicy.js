/**
 * @param {number} currentFood
 * @param {number} maxStock
 * @returns {number}
 */
export function remainingMarketCapacity(currentFood, maxStock) {
  const current = Number.isFinite(currentFood) ? Math.max(0, Math.floor(currentFood)) : 0;
  const max = Number.isFinite(maxStock) && maxStock > 0 ? Math.floor(maxStock) : 500;
  return Math.max(0, max - current);
}
