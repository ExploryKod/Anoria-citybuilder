/** @typedef {'spring' | 'summer' | 'autumn' | 'winter'} Season */

/**
 * @deprecated Markets no longer buy from farms — use windmill allocation instead.
 * @param {Season | string | null | undefined} _season
 */
export function canMarketBuyFromFarms(_season) {
  return false;
}

/**
 * Markets distribute to houses every month from their own stocks.
 * @param {Season | string | null | undefined} _season
 */
export function canMarketDistributeToHouses(_season) {
  return true;
}

/**
 * Markets restock from their assigned windmill every month.
 * @param {string | null | undefined} _month
 */
export function canMarketBuyFromWindmill(_month) {
  return true;
}
