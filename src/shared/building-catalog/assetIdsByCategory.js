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
    'Farm-Olive',
  ]),
  industry: Object.freeze([
    'Windmill-001',
    'Factory-Plate',
    'Factory-Pot',
    'Factory-Oil',
    'Factory-Candle',
    'Factory-Amphora',
    'Lumberjack',
    'Lumberjack-Industry',
    'Factory-Furniture',
    'Factory-Network',
    'CoalPlant',
    'PetrolPlant',
    'NuclearPlant',
    'Warehouse',
    'TradeWarehouse',
  ]),
  markets: Object.freeze(['Market-Stall-Red']),
  infrastructure: Object.freeze([
    'StonePath-001',
    'StonePath-Right-001',
    'StonePath-Left-001',
    'StonePath-Cross-001',
    'StonePath-Tee-001',
    'StonePath-End-001',
  ]),
  public: Object.freeze([
    'WaterTank',
    'School',
    'Library',
    'Doctor',
    'Hospital',
    'Theatre',
    'Cinema',
    'Pub',
    'FireStation',
    'PoliceStation',
  ]),
  nature: Object.freeze([
    'Tree-Pine-001',
    'Tree-Square-001',
    'Tree-Tall-001',
    'Boulder-001',
  ]),
});

/**
 * The Kenney suburban models, grouped by the kind of house they show — how the /assets page lays out the
 * houses, and the pool a house's evolution levels will draw its look from. An id of
 * `KENNEY_CITY_KIT_TOOLS_BY_CATEGORY.houses` that is in no group is shown under an explicit "unclassified"
 * section on that page, never silently put in one of these.
 * @type {ReadonlyArray<Readonly<{ id: string, label: string, assetIds: ReadonlyArray<string> }>>}
 */
export const HOUSE_MODEL_GROUPS = Object.freeze([
  Object.freeze({
    id: 'small-white',
    label: 'Petite maison blanche',
    assetIds: Object.freeze(['Kenney-Suburban-building-type-k', 'Kenney-Suburban-building-type-r', 'Kenney-Suburban-building-type-s']),
  }),
  Object.freeze({
    id: 'small-black',
    label: 'Petite maison noire',
    assetIds: Object.freeze(['Kenney-Suburban-building-type-q', 'Kenney-Suburban-building-type-p', 'Kenney-Suburban-building-type-l']),
  }),
  Object.freeze({
    id: 'intermediate',
    label: 'Maison intermédiaire (avec ou sans étage)',
    assetIds: Object.freeze([
      'Kenney-Suburban-building-type-a',
      'Kenney-Suburban-building-type-g',
      'Kenney-Suburban-building-type-i',
      'Kenney-Suburban-building-type-m',
      'Kenney-Suburban-building-type-c',
    ]),
  }),
  Object.freeze({
    id: 'rich',
    label: 'Maison de riches (deux étages)',
    assetIds: Object.freeze([
      'Kenney-Suburban-building-type-e',
      'Kenney-Suburban-building-type-d',
      'Kenney-Suburban-building-type-o',
      'Kenney-Suburban-building-type-n',
      'Kenney-Suburban-building-type-t',
      'Kenney-Suburban-building-type-f',
    ]),
  }),
  Object.freeze({
    id: 'solar',
    label: 'Maison à panneaux solaires',
    assetIds: Object.freeze([
      'Kenney-Suburban-building-type-u',
      'Kenney-Suburban-building-type-b',
      'Kenney-Suburban-building-type-h',
      'Kenney-Suburban-building-type-j',
    ]),
  }),
]);

/**
 * The Kenney industrial models, grouped by what they look like (not by whether the game uses them — the /assets
 * page says that on each card). Same rule as `HOUSE_MODEL_GROUPS`: a model of
 * `KENNEY_CITY_KIT_TOOLS_BY_CATEGORY.industry` in no group is shown under an explicit "unclassified" section.
 * @type {ReadonlyArray<Readonly<{ id: string, label: string, assetIds: ReadonlyArray<string> }>>}
 */
const industrialBuilding = (letters) => Object.freeze(letters.map((letter) => `Kenney-Industrial-building-${letter}`));
const industrial = (names) => Object.freeze(names.map((name) => `Kenney-Industrial-${name}`));
export const INDUSTRY_MODEL_GROUPS = Object.freeze([
  Object.freeze({ id: 'storage', label: 'Entrepôt et stockage (portes de camion)', assetIds: industrialBuilding(['i', 'h', 'j', 's', 'p']) }),
  Object.freeze({ id: 'industry', label: 'Industrie (toit ou cheminée)', assetIds: industrialBuilding(['k', 'g', 'e', 'm', 'n', 't', 'f', 'b']) }),
  Object.freeze({ id: 'energy', label: 'Énergie (cheminée ou bonbonne de gaz)', assetIds: industrialBuilding(['c', 'l', 'r']) }),
  Object.freeze({ id: 'tech-offices', label: 'Tech et bureaux (proche du commerce)', assetIds: industrialBuilding(['d', 'q', 'o', 'a']) }),
  Object.freeze({
    id: 'renewable',
    label: 'Énergie renouvelable (solaire, éolien)',
    assetIds: industrial(['solar-panel-flat', 'solar-panel-landscape', 'solar-panel-landscape-group', 'solar-panel-portrait', 'solar-panel-portrait-group', 'windmill', 'windmill-low']),
  }),
  Object.freeze({
    id: 'tanks',
    label: 'Réservoirs et château d\'eau',
    assetIds: industrial(['detail-tank', 'detail-tank-large', 'water-tower']),
  }),
  Object.freeze({
    id: 'details',
    label: 'Cheminées et conteneurs',
    assetIds: industrial(['chimney-basic', 'chimney-large', 'chimney-medium', 'chimney-small', 'shipping-container-a', 'shipping-container-b', 'shipping-container-c']),
  }),
]);

/**
 * The Kenney commercial models, grouped by their shape. Same rule as `HOUSE_MODEL_GROUPS`: a model of
 * `KENNEY_CITY_KIT_TOOLS_BY_CATEGORY.markets` in no group is shown under an explicit "unclassified" section.
 * @type {ReadonlyArray<Readonly<{ id: string, label: string, assetIds: ReadonlyArray<string> }>>}
 */
const commercialPiece = (names) => Object.freeze(names.map((name) => `Kenney-Commercial-${name}`));
const commercial = (names) => Object.freeze(names.map((name) => `Kenney-Commercial-building-${name}`));
export const COMMERCE_MODEL_GROUPS = Object.freeze([
  Object.freeze({ id: 'small-elegant', label: 'Petit et élégant', assetIds: commercial(['a', 'b', 'c']) }),
  Object.freeze({ id: 'small-straight', label: 'Petit et droit', assetIds: commercial(['d', 'f', 'g', 'h']) }),
  Object.freeze({ id: 'wide', label: 'Large', assetIds: commercial(['i', 'n']) }),
  Object.freeze({ id: 'wide-elegant', label: 'Large et élégant', assetIds: commercial(['l', 'm']) }),
  Object.freeze({ id: 'long-elegant', label: 'Long et élégant', assetIds: commercial(['e']) }),
  Object.freeze({ id: 'very-wide', label: 'Très large', assetIds: commercial(['j', 'k']) }),
  Object.freeze({
    id: 'low-detail',
    label: 'Simplifiés (low detail)',
    assetIds: commercialPiece([...'abcdefghijklmn'].map((letter) => `low-detail-building-${letter}`)),
  }),
  Object.freeze({
    id: 'low-detail-wide',
    label: 'Simplifiés larges (low detail)',
    assetIds: commercialPiece(['low-detail-building-wide-a', 'low-detail-building-wide-b']),
  }),
  Object.freeze({
    id: 'skyscraper',
    label: 'Gratte-ciel',
    assetIds: commercial(['skyscraper-a', 'skyscraper-b', 'skyscraper-c', 'skyscraper-d', 'skyscraper-e']),
  }),
]);

/**
 * The Kenney pieces that are not buildings (suburban garden pieces, shop details), grouped by use. Same rule as `HOUSE_MODEL_GROUPS`: a piece of
 * `KENNEY_CITY_KIT_TOOLS_BY_CATEGORY.decoration` in no group is shown under an explicit "unclassified" section.
 * @type {ReadonlyArray<Readonly<{ id: string, label: string, assetIds: ReadonlyArray<string> }>>}
 */
const garden = (names) => Object.freeze(names.map((name) => `Kenney-Suburban-${name}`));
export const DECORATION_MODEL_GROUPS = Object.freeze([
  Object.freeze({
    id: 'fences',
    label: 'Clôtures',
    assetIds: garden(['fence', 'fence-low', 'fence-1x2', 'fence-1x3', 'fence-1x4', 'fence-2x2', 'fence-2x3', 'fence-3x2', 'fence-3x3']),
  }),
  Object.freeze({
    id: 'paths',
    label: 'Chemins et allées',
    assetIds: garden(['path-short', 'path-long', 'path-stones-short', 'path-stones-long', 'path-stones-messy', 'driveway-short', 'driveway-long']),
  }),
  Object.freeze({ id: 'plants', label: 'Jardinière et arbres', assetIds: garden(['planter', 'tree-small', 'tree-large']) }),
  Object.freeze({
    id: 'shop-details',
    label: 'Auvents, avancées et parasols de commerce',
    assetIds: commercialPiece(['detail-awning', 'detail-awning-wide', 'detail-overhang', 'detail-overhang-wide', 'detail-parasol-a', 'detail-parasol-b']),
  }),
]);
