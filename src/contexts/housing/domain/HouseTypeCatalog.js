export const HOUSE_TYPE_BLUE = 'House-Blue';
export const HOUSE_TYPE_RED = 'House-Red';
export const HOUSE_TYPE_PURPLE = 'House-Purple';

/**
 * @param {string} type
 * @returns {string}
 */
export function normalizeResidentialType(type) {
  const t = type || '';
  if (t.includes('House-Purple')) return HOUSE_TYPE_PURPLE;
  if (t.includes('House-Red')) return HOUSE_TYPE_RED;
  if (t.includes('House-Blue')) return HOUSE_TYPE_BLUE;
  return t;
}
