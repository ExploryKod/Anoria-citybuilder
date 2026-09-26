/**
 * Placeable asset ids grouped by gameplay category (houses, farms, industry,
 * markets, infrastructure, public, nature, zones…) — the list the /assets
 * reference page enumerates. Which pack renders an id is NOT declared here:
 * that is the `source` of its entry in the presentation catalogs
 * (buildingAssets.js / natureAssets.js / terrainAssets.js). Kenney city-kit
 * tools are registered separately; see kenneyCityKitRegistry.generated.js.
 *
 * There used to be a second, narrower "playable" list here (only farms +
 * roads), disconnected from the actual rendering/economy catalogs — it
 * silently drifted out of sync (see git history) and blocked real,
 * priced, rendered buildings from ever being placed. Every buildingCatalog
 * entry with a construction fact is playable, full stop — see
 * asset-placement/buildingPlacementCatalog.js — so this file only needs to declare the one real fact:
 * which ids exist in each category.
 */

/**
 * Nature ids written to tiles / Dexie during world generation (not in the placement toolbar).
 * Logical tree names map to their canonical mesh ids via {@link NATURE_MESH_ALIASES}.
 */
export const NATURE_GAME_IDS = Object.freeze([
  'Tree-Sapin',
  'Tree-Arbuste',
  'Tree-Chene',
  'Tree-Pine-001',
  'Tree-Square-001',
  'Tree-Tall-001',
  'Boulder-001',
]);

/** @type {Readonly<Record<string, string>>} */
export const NATURE_MESH_ALIASES = Object.freeze({
  'Tree-Sapin': 'Tree-Pine-001',
  'Tree-Arbuste': 'Tree-Square-001',
  'Tree-Chene': 'Tree-Tall-001',
});

/** Every placeable id per category — kept for legacy saves and procedural nature. */
/** @type {Readonly<Record<string, ReadonlyArray<string>>>} */
export const ASSET_IDS_BY_CATEGORY = Object.freeze({
  zones: Object.freeze(['grass']),
  houses: Object.freeze(['House-Blue', 'House-Red', 'House-Purple']),
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
    'Factory-Plate',
    'Factory-Pot',
    'Factory-Amphora',
    'Lumberjack',
    'Factory-Furniture',
    'Warehouse',
  ]),
  markets: Object.freeze(['Market-Stall', 'Market-Stall-Blue', 'Market-Stall-Red']),
  infrastructure: Object.freeze([
    'StonePath-001',
    'StonePath-Right-001',
    'StonePath-Left-001',
    'StonePath-Cross-001',
    'StonePath-Tee-001',
    'StonePath-End-001',
  ]),
  public: Object.freeze([
    'Chapel',
    'BookShop-001',
    'School',
    'Library',
    'Doctor',
    'Hospital',
    'PublicBath',
    'Theatre',
    'Cinema',
    'Pub',
  ]),
  palaces: Object.freeze(['House-2Story']),
  nature: Object.freeze([
    'Tree-Pine-001',
    'Tree-Square-001',
    'Tree-Tall-001',
    'Boulder-001',
  ]),
});
