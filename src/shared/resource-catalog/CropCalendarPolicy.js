/**
 * For how many months of the year a crop is gone from its store: it keeps `keepsInStoreMonths` from its harvest, and the next purchase comes `monthsToNextSale` months after
 * that harvest (a year later, plus the gap between its harvest and its sale month). Not an error: a perishable crop is part of the game, and the player is told.
 * @param {{ keepsInStoreMonths: number | null, monthsToNextSale: number }} params
 * @returns {number} 0 when the crop lasts until the next purchase (or never goes bad)
 */
export function monthsWithoutStock({ keepsInStoreMonths, monthsToNextSale }) {
  if (keepsInStoreMonths === null) return 0;
  return Math.max(0, monthsToNextSale - keepsInStoreMonths);
}
