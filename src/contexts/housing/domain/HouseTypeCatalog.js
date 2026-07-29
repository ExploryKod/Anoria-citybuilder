export const HOUSE_TYPE_BLUE = 'House-Blue';
export const HOUSE_TYPE_RED = 'House-Red';
export const HOUSE_TYPE_PURPLE = 'House-Purple';
export const HOUSE_TYPE_PALACE = 'House-2Story';

/** @type {Readonly<Record<string, number>>} */
export const RESIDENTIAL_HOUSE_PRICES = Object.freeze({
  [HOUSE_TYPE_BLUE]: 10,
  [HOUSE_TYPE_RED]: 10,
  [HOUSE_TYPE_PURPLE]: 10,
  [HOUSE_TYPE_PALACE]: 20,
});

/**
 * @param {string} type
 * @returns {string}
 */
export function normalizeResidentialType(type) {
  const t = type || '';
  if (t.includes('2Story') || t.includes('2-Story') || t.includes('House_2Story')) {
    return HOUSE_TYPE_PALACE;
  }
  if (t.includes('House-Purple')) return HOUSE_TYPE_PURPLE;
  if (t.includes('House-Red')) return HOUSE_TYPE_RED;
  if (t.includes('House-Blue')) return HOUSE_TYPE_BLUE;
  return t;
}

/**
 * @param {string} type
 * @returns {number}
 */
export function priceForResidentialType(type) {
  return RESIDENTIAL_HOUSE_PRICES[normalizeResidentialType(type)] ?? 10;
}
