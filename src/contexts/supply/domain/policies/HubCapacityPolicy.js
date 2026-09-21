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

/**
 * What a hub still holds from before its last harvest, per category. Goods leave a hub oldest
 * first, so the last harvest is the last part of the stock to be touched: whatever the stock
 * holds beyond it is older. No per-lot bookkeeping — the stock and the last collection say it.
 *
 * @param {Record<string, number> | null | undefined} stocks
 * @param {Record<string, number> | null | undefined} lastCollection What the last harvest brought, per category.
 * @param {readonly string[]} categories
 * @returns {Record<string, number>}
 */
export function computeCarryOver(stocks, lastCollection, categories) {
  const whole = (value) => Math.max(0, Math.floor(Number(value) || 0));
  return Object.fromEntries(
    categories.map((category) => [category, Math.max(0, whole(stocks?.[category]) - whole(lastCollection?.[category]))])
  );
}

/**
 * Whole months a hub's stock lasts at the pace things left it last month; null while nothing
 * has left it yet (no pace to measure).
 *
 * @param {number} stock
 * @param {number | null | undefined} monthlyOutflow Units that left the hub in its last month of activity.
 * @returns {number | null}
 */
export function computeAutonomyMonths(stock, monthlyOutflow) {
  if (!(monthlyOutflow > 0)) return null;
  return Math.floor(Math.max(0, Number(stock) || 0) / monthlyOutflow);
}

