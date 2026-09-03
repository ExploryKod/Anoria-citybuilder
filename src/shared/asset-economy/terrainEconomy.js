/**
 * Economy facts (price, category, displayName) for the terrain/zone theme.
 * See buildingCatalog.js for the merged, compat-shaped export every
 * bounded context still reads.
 *
 * Same hard rules as buildingCatalog.js: data only, no behavior, no
 * `src/contexts/**` imports.
 */
export const TERRAIN_ECONOMY = {
  grass: { displayName: 'Herbe', construction: { price: 0, category: 'zones' } },
  terrain: { construction: { price: 0, category: 'zones' } },
  roads: {
    displayName: 'Route',
    construction: { price: 5, category: 'infrastructure' },
    employment: { sector: 5, workerNeed: 0, eliteNeed: 0 },
    accounting: { maintenance: 4 },
  },
};
