/**
 * Village GLB asset sets: playable (toolbar) vs mesh-only (legacy saves / world gen).
 * Kenney buildings are registered separately; see kenneyCityKitRegistry.generated.js.
 */

/** @type {Readonly<Record<string, ReadonlyArray<string>>>} */
export const VILLAGE_PLAYABLE_TOOL_IDS_BY_CATEGORY = Object.freeze({
  zones: Object.freeze(['grass']),
  houses: Object.freeze([]),
  tombs: Object.freeze([]),
  farms: Object.freeze([
    'Farm-Wheat',
    'Farm-Carrot',
    'Farm-Cabbage',
    'Hay-Bale',
    'Hay-Cart',
    'Hay-Pile',
  ]),
  industry: Object.freeze([]),
  markets: Object.freeze([]),
  infrastructure: Object.freeze([
    'roads',
    'StonePath-001',
    'StonePath-Right-001',
    'StonePath-Left-001',
    'StonePath-Cross-001',
  ]),
  public: Object.freeze([]),
  palaces: Object.freeze([]),
  nature: Object.freeze([]),
  decoration: Object.freeze([]),
});

/**
 * Nature ids written to tiles / Dexie during world generation (not in the placement toolbar).
 * Logical tree names map to GLB mesh ids via {@link VILLAGE_NATURE_MESH_ALIASES}.
 */
export const VILLAGE_NATURE_GAME_IDS = Object.freeze([
  'Tree-Sapin',
  'Tree-Arbuste',
  'Tree-Chene',
  'Tree-Pine-001',
  'Tree-Square-001',
  'Tree-Tall-001',
  'Boulder-001',
]);

/** @type {Readonly<Record<string, string>>} */
export const VILLAGE_NATURE_MESH_ALIASES = Object.freeze({
  'Tree-Sapin': 'Tree-Pine-001',
  'Tree-Arbuste': 'Tree-Square-001',
  'Tree-Chene': 'Tree-Tall-001',
});

/** Full village mesh load list — kept for legacy saves and procedural nature. */
/** @type {Readonly<Record<string, ReadonlyArray<string>>>} */
export const VILLAGE_MESH_TOOL_IDS_BY_CATEGORY = Object.freeze({
  zones: Object.freeze(['grass']),
  houses: Object.freeze(['House-Blue', 'House-Red', 'House-Purple']),
  tombs: Object.freeze([
    'Tombstone-1',
    'Tombstone-2',
    'Tombstone-3',
    'Grave-1',
    'Grave-2',
    'Tomb',
    'Coffin',
  ]),
  farms: Object.freeze([
    'Farm-Wheat',
    'Farm-Carrot',
    'Farm-Cabbage',
    'Hay-Bale',
    'Hay-Cart',
    'Hay-Pile',
  ]),
  industry: Object.freeze([
    'Windmill-001',
    'Barn-001',
    'Crate-001',
    'Winery-001',
    'Cylinder',
  ]),
  markets: Object.freeze(['Market-Stall', 'Market-Stall-Blue', 'Market-Stall-Red']),
  infrastructure: Object.freeze([
    'Well-001',
    'Fountain-001',
    'Streetlight-001',
    'roads',
    'StonePath-001',
    'StonePath-Right-001',
    'StonePath-Left-001',
    'StonePath-Cross-001',
    'Fence-001',
    'Pond-001',
    'Plane-001',
    'Plane-004',
    'Plane-007',
    'Cube',
    'Sphere-001',
    'Sphere-002',
  ]),
  public: Object.freeze(['Chapel', 'BookShop-001']),
  palaces: Object.freeze(['House-2Story']),
  nature: Object.freeze([
    'Tree-Pine-001',
    'Tree-Square-001',
    'Tree-Tall-001',
    'Boulder-001',
  ]),
  decoration: Object.freeze([
    'Bench',
    'Picnic-Table',
    'Potted-Bush',
    'Daisy',
    'Shroom',
    'Arch',
    'Obelisk',
    'Pillar',
    'Garland',
    'Barrell',
  ]),
});
