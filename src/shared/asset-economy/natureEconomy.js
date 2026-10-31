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
  'Tree-Pine-001': { displayName: 'Sapin', naturalResource: 'wood', construction: { price: 3, category: 'nature' } },
  'Tree-Square-001': { displayName: 'Arbuste', naturalResource: 'wood', construction: { price: 3, category: 'nature' } },
  'Tree-Tall-001': { displayName: 'Chêne', naturalResource: 'wood', construction: { price: 3, category: 'nature' } },
  'Tree-Sapin': { displayName: 'Sapin', naturalResource: 'wood', construction: { price: 3, category: 'nature' } },
  'Tree-Arbuste': { displayName: 'Arbuste', naturalResource: 'wood', construction: { price: 3, category: 'nature' } },
  'Tree-Chene': { displayName: 'Chêne', naturalResource: 'wood', construction: { price: 3, category: 'nature' } },
  // A boulder holds these deposits (each counted in its own `stocks` field, see depositQueries.js).
  // Any other piece of nature a map stands on the grid (a flower, a bush, a fence...): it is on the grid, so it is a record of the hamlet, with nothing to draw from it yet.
  'Nature-Piece': { displayName: 'Élément de nature', construction: { price: 0, category: 'nature' } },
  'Boulder-001': { displayName: 'Rocher', deposits: ['rock', 'iron', 'gold'], construction: { price: 2, category: 'nature' } },

};
