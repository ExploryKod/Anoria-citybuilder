import { FOOD_CIRCUIT } from '../catalogs/FoodCircuitCatalog.js';

/** @typedef {'wheat' | 'carrot' | 'cabbage'} Crop */

export const CROPS = FOOD_CIRCUIT.crops;

/**
 * @param {unknown} value
 * @returns {value is Crop}
 */
export function isCrop(value) {
  return CROPS.includes(value);
}
