/**
 * Economy facts (price, category, displayName) for the nature/decoration/
 * theme. See buildingCatalog.js for the merged, compat-shaped export
 * every bounded context still reads.
 *
 * Same hard rules as buildingCatalog.js: data only, no behavior, no
 * `src/contexts/**` imports.
 */
export const NATURE_ECONOMY = {
  // Nature
  'Tree-Pine-001': { displayName: 'Sapin', construction: { price: 3, category: 'nature' } },
  'Tree-Square-001': { displayName: 'Arbuste', construction: { price: 3, category: 'nature' } },
  'Tree-Tall-001': { displayName: 'Chêne', construction: { price: 3, category: 'nature' } },
  'Tree-Sapin': { displayName: 'Sapin', construction: { price: 3, category: 'nature' } },
  'Tree-Arbuste': { displayName: 'Arbuste', construction: { price: 3, category: 'nature' } },
  'Tree-Chene': { displayName: 'Chêne', construction: { price: 3, category: 'nature' } },
  'Boulder-001': { displayName: 'Rocher', construction: { price: 2, category: 'nature' } },

};
