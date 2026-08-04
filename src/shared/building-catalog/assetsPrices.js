/**
 * Placement / economy catalog: price, UI category, footprint size.
 * Pure data — no Three.js. Source of truth for construction cost lookups.
 */

export const assetsPrices = Object.freeze({
  // Zones
  grass: { price: 0, category: 'zones', gridSize: 1 },
  terrain: { price: 0, category: 'zones', gridSize: 1 },

  // Roads (use StonePath mesh variants with different rotations)
  roads: { price: 5, category: 'infrastructure', gridSize: 1 },
  'StonePath-001': { price: 5, category: 'infrastructure', gridSize: 1 },
  'StonePath-Right-001': { price: 5, category: 'infrastructure', gridSize: 1 },
  'StonePath-Left-001': { price: 5, category: 'infrastructure', gridSize: 1 },
  'StonePath-Cross-001': { price: 5, category: 'infrastructure', gridSize: 1 },

  // Houses
  'House-Blue': { price: 10, category: 'houses', gridSize: 1 },
  'House-Red': { price: 10, category: 'houses', gridSize: 1 },
  'House-Purple': { price: 10, category: 'houses', gridSize: 1 },

  // Palaces
  'House-2Story': { price: 20, category: 'palaces', gridSize: 1 },

  // Tombs / cemetery
  'Tombstone-1': { price: 2, category: 'tombs', gridSize: 1 },
  'Tombstone-2': { price: 4, category: 'tombs', gridSize: 1 },
  'Tombstone-3': { price: 8, category: 'tombs', gridSize: 1 },
  'Grave-1': { price: 3, category: 'tombs', gridSize: 1 },
  'Grave-2': { price: 3, category: 'tombs', gridSize: 1 },
  Tomb: { price: 5, category: 'tombs', gridSize: 1 },
  Coffin: { price: 4, category: 'tombs', gridSize: 1 },

  // Farms
  'Farm-Wheat': { price: 10, category: 'farms', gridSize: 1 },
  'Farm-Carrot': { price: 20, category: 'farms', gridSize: 1 },
  'Farm-Cabbage': { price: 30, category: 'farms', gridSize: 1 },
  'Hay-Bale': { price: 2, category: 'farms', gridSize: 1 },
  'Hay-Cart': { price: 5, category: 'farms', gridSize: 1 },
  'Hay-Pile': { price: 2, category: 'farms', gridSize: 1 },

  // Industry
  'Windmill-001': { price: 50, category: 'industry', gridSize: 1 },
  'Barn-001': { price: 40, category: 'industry', gridSize: 2 },
  'Crate-001': { price: 2, category: 'industry', gridSize: 1 },
  'Winery-001': { price: 50, category: 'industry', gridSize: 1 },
  // Wheat silo (all Cylinder* meshes)
  Cylinder: { price: 15, category: 'industry', gridSize: 1 },

  // Markets
  'Market-Stall': { price: 10, category: 'markets', gridSize: 1 },
  'Market-Stall-Blue': { price: 10, category: 'markets', gridSize: 1 },
  'Market-Stall-Red': { price: 10, category: 'markets', gridSize: 1 },

  // Infrastructure
  'Well-001': { price: 15, category: 'infrastructure', gridSize: 1 },
  'Fountain-001': { price: 25, category: 'infrastructure', gridSize: 1 },
  'Streetlight-001': { price: 5, category: 'infrastructure', gridSize: 1 },
  'Fence-001': { price: 3, category: 'infrastructure', gridSize: 1 },
  'Pond-001': { price: 20, category: 'infrastructure', gridSize: 1 },
  'Plane-001': { price: 8, category: 'infrastructure', gridSize: 1 },
  'Plane-004': { price: 12, category: 'infrastructure', gridSize: 1 },
  'Plane-007': { price: 16, category: 'infrastructure', gridSize: 1 },
  Cube: { price: 5, category: 'infrastructure', gridSize: 1 },
  'Sphere-001': { price: 5, category: 'infrastructure', gridSize: 1 },
  'Sphere-002': { price: 5, category: 'infrastructure', gridSize: 1 },

  // Public (Chapel only — Church-002 mesh discarded as broken duplicate)
  Chapel: { price: 60, category: 'public', gridSize: 1 },
  'BookShop-001': { price: 60, category: 'public', gridSize: 1 },
  // Legacy save alias
  'Church-002': { price: 60, category: 'public', gridSize: 1 },

  // Nature
  'Tree-Pine-001': { price: 3, category: 'nature', gridSize: 1 },
  'Tree-Square-001': { price: 3, category: 'nature', gridSize: 1 },
  'Tree-Tall-001': { price: 3, category: 'nature', gridSize: 1 },
  'Tree-Sapin': { price: 3, category: 'nature', gridSize: 1 },
  'Tree-Arbuste': { price: 3, category: 'nature', gridSize: 1 },
  'Tree-Chene': { price: 3, category: 'nature', gridSize: 1 },
  'Boulder-001': { price: 2, category: 'nature', gridSize: 1 },

  // Decoration
  Bench: { price: 2, category: 'decoration', gridSize: 1 },
  'Picnic-Table': { price: 4, category: 'decoration', gridSize: 1 },
  'Potted-Bush': { price: 2, category: 'decoration', gridSize: 1 },
  Daisy: { price: 1, category: 'decoration', gridSize: 1 },
  Shroom: { price: 1, category: 'decoration', gridSize: 1 },
  Arch: { price: 10, category: 'decoration', gridSize: 1 },
  Obelisk: { price: 12, category: 'decoration', gridSize: 1 },
  Pillar: { price: 5, category: 'decoration', gridSize: 1 },
  Garland: { price: 2, category: 'decoration', gridSize: 1 },
  Barrell: { price: 2, category: 'decoration', gridSize: 1 },
});
