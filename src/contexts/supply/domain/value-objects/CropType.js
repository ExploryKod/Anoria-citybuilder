import { getAllCategoriesForRole } from '../policies/ResourceRolePolicy.js';

/** @typedef {'wheat' | 'carrot' | 'cabbage'} Crop */

/** A crop is whatever some building declares as a 'producer' category — derived, not a hand list. */
export const CROPS = getAllCategoriesForRole('producer');

/**
 * @param {unknown} value
 * @returns {value is Crop}
 */
export function isCrop(value) {
  return CROPS.includes(value);
}
