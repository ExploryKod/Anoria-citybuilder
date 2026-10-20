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
 * What a hub held, per category, just before a harvest came in — the part of its stock that is
 * older than that harvest.
 *
 * @param {Record<string, number> | null | undefined} stocks
 * @param {readonly string[]} categories
 * @returns {Record<string, number>}
 */
export function snapshotCarryOver(stocks, categories) {
  return Object.fromEntries(
    categories.map((category) => [category, Math.max(0, Math.floor(Number(stocks?.[category]) || 0))])
  );
}

/**
 * What a hub still holds from before this year's harvest, per category. Goods leave a hub oldest
 * first, so the stock is [old goods][this year's harvest] and the harvest is only touched once the
 * old goods are gone: what is left of the old goods is the stock beyond the harvest, and never
 * more than what was there before it. With no snapshot recorded, none.
 *
 * @param {Record<string, number> | null | undefined} stocks
 * @param {Record<string, number> | null | undefined} snapshot What the hub held before the harvest (`snapshotCarryOver`).
 * @param {Record<string, number> | null | undefined} harvested What came in since, per category.
 * @param {readonly string[]} categories
 * @returns {Record<string, number>}
 */
export function computeCarryOver(stocks, snapshot, harvested, categories) {
  const whole = (value) => Math.max(0, Math.floor(Number(value) || 0));
  return Object.fromEntries(
    categories.map((category) => [
      category,
      Math.min(whole(snapshot?.[category]), Math.max(0, whole(stocks?.[category]) - whole(harvested?.[category]))),
    ])
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

