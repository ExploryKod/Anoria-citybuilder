/**
 * @param {number} currentAmount
 * @param {number} maxStock
 * @returns {number}
 */
export function remainingHubCapacity(currentAmount, maxStock) {
  const current = Number.isFinite(currentAmount) ? Math.max(0, Math.floor(currentAmount)) : 0;
  const max = Number.isFinite(maxStock) && maxStock > 0 ? Math.floor(maxStock) : 500;
  return Math.max(0, max - current);
}
