import { FOOD_CIRCUIT } from '../catalogs/FoodCircuitCatalog.js';

/** @typedef {'spring' | 'summer' | 'autumn' | 'winter'} Season */

/**
 * Farms harvest their annual crop only once per year, in the season
 * configured on FoodCircuitCatalog.
 * @param {Season | string | null | undefined} season
 */
export function canFarmHarvest(season) {
  return season === FOOD_CIRCUIT.harvestSeason;
}
