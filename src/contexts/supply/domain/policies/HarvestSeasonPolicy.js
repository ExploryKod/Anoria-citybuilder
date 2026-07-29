/** @typedef {'spring' | 'summer' | 'autumn' | 'winter'} Season */

/**
 * Farms harvest their annual crop only in autumn (once per year).
 * @param {Season | string | null | undefined} season
 */
export function canFarmHarvest(season) {
  return season === 'autumn';
}
