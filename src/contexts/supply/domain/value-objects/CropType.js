/** @typedef {'wheat' | 'carrot' | 'cabbage'} Crop */

export const CROPS = Object.freeze(['wheat', 'carrot', 'cabbage']);

/**
 * @param {string} farmType
 * @returns {Crop | null}
 */
export function cropFromFarmType(farmType) {
  const type = typeof farmType === 'string' ? farmType : '';
  if (type.includes('Wheat') || type.includes('wheat')) return 'wheat';
  if (type.includes('Carrot') || type.includes('carrot')) return 'carrot';
  if (type.includes('Cabbage') || type.includes('cabbage')) return 'cabbage';
  return null;
}

/**
 * @param {unknown} value
 * @returns {value is Crop}
 */
export function isCrop(value) {
  return CROPS.includes(value);
}
