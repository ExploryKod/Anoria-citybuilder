import { FOOD_CIRCUIT } from '../catalogs/FoodCircuitCatalog.js';
import { getCategoriesForRole } from '../policies/ResourceRolePolicy.js';

/** @typedef {'wheat' | 'carrot' | 'cabbage'} Crop */

export const CROPS = FOOD_CIRCUIT.crops;

/**
 * @param {string} farmType
 * @returns {Crop | null}
 */
export function cropFromFarmType(farmType) {
  return getCategoriesForRole(farmType, 'producer')[0] ?? null;
}

/**
 * @param {unknown} value
 * @returns {value is Crop}
 */
export function isCrop(value) {
  return CROPS.includes(value);
}
