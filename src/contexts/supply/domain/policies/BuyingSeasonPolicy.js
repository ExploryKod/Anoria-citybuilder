/** @typedef {'spring' | 'summer' | 'autumn' | 'winter'} Season */

/**
 * Markets purchase from farms only in autumn.
 * @param {Season | string | null | undefined} season
 */
export function canMarketBuyFromFarms(season) {
  return season === 'autumn';
}

/**
 * Markets distribute to houses outside autumn (legacy behavior).
 * @param {Season | string | null | undefined} season
 */
export function canMarketDistributeToHouses(season) {
  return Boolean(season) && season !== 'autumn';
}
