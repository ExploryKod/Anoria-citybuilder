/**
 * @param {number} currentAmount
 * @param {number} maxStock Catalog ceiling (see getMaxStockForBuilding); a missing/invalid
 *   value means the catalog declares none, i.e. unbounded — never a hidden default.
 * @returns {number}
 */
export function remainingHubCapacity(currentAmount, maxStock) {
  const current = Number.isFinite(currentAmount) ? Math.max(0, Math.floor(currentAmount)) : 0;
  const max = Number.isFinite(maxStock) && maxStock > 0 ? Math.floor(maxStock) : Infinity;
  return Math.max(0, max - current);
}
