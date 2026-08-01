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

  // Tombs
  'Tombstone-1': { price: 2, category: 'tombs', gridSize: 1 },
  'Tombstone-2': { price: 4, category: 'tombs', gridSize: 1 },
  'Tombstone-3': { price: 8, category: 'tombs', gridSize: 1 },

  // Farms (only fields)
  'Farm-Wheat': { price: 10, category: 'farms', gridSize: 1 },
  'Farm-Carrot': { price: 20, category: 'farms', gridSize: 1 },
  'Farm-Cabbage': { price: 30, category: 'farms', gridSize: 1 },

  // Industry (agricultural industry)
  'Windmill-001': { price: 50, category: 'industry', gridSize: 1 },
  'Barn-001': { price: 40, category: 'industry', gridSize: 2 },
  'Crate-001': { price: 2, category: 'industry', gridSize: 1 },
  'Winery-001': { price: 50, category: 'industry', gridSize: 1 },

  // Markets
  'Market-Stall': { price: 10, category: 'markets', gridSize: 1 },

  // Infrastructure
  'Well-001': { price: 15, category: 'infrastructure', gridSize: 1 },
  'Fountain-001': { price: 25, category: 'infrastructure', gridSize: 1 },
  'Streetlight-001': { price: 5, category: 'infrastructure', gridSize: 1 },

  // Public Buildings
  'Church-002': { price: 100, category: 'public', gridSize: 3 },
  'BookShop-001': { price: 60, category: 'public', gridSize: 1 },

  // Nature (Trees and Rocks)
  'Tree-Pine-001': { price: 3, category: 'nature', gridSize: 1 },
  'Tree-Square-001': { price: 3, category: 'nature', gridSize: 1 },
  'Tree-Tall-001': { price: 3, category: 'nature', gridSize: 1 },
  'Tree-Sapin': { price: 3, category: 'nature', gridSize: 1 },
  'Tree-Arbuste': { price: 3, category: 'nature', gridSize: 1 },
  'Tree-Chene': { price: 3, category: 'nature', gridSize: 1 },
  'Boulder-001': { price: 2, category: 'nature', gridSize: 1 },
});
