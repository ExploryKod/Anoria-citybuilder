import { FOOD_CIRCUIT } from '../catalogs/FoodCircuitCatalog.js';

/** @typedef {'wheat' | 'carrot' | 'cabbage'} Crop */

export const CROPS = FOOD_CIRCUIT.crops;

/**
 * @param {string} farmType
 * @returns {Crop | null}
 */
export function cropFromFarmType(farmType) {
  const type = typeof farmType === 'string' ? farmType : '';
  const entry = FOOD_CIRCUIT.farmTypeToCrop.find(({ match }) => match.test(type));
  return entry ? entry.crop : null;
}

/**
 * @param {unknown} value
 * @returns {value is Crop}
 */
export function isCrop(value) {
  return CROPS.includes(value);
}
