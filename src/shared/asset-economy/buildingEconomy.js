import { KENNEY_BUILDING_CATALOG_ENTRIES } from '../building-catalog/kenneyCityKitRegistry.generated.js';

/**
 * Economy facts (price, category, employment, accounting, residentialGroup,
 * displayName) for the playable-building theme — houses, farms, industry,
 * markets, infrastructure, public, palaces. See buildingCatalog.js for the
 * merged, compat-shaped export every bounded context still reads.
 *
 * Kenney building ids are folded in from their own auto-generated registry
 * (scanned from the real GLB bounding box) — this file is the one place
 * that's allowed to know Kenney exists; buildingCatalog.js isn't. Same
 * pattern as shared/asset-footprint/buildingFootprint.js.
 *
 * Same hard rules as buildingCatalog.js: data only, no behavior, no
 * `src/contexts/**` imports.
 */
export const BUILDING_ECONOMY = {
  ...KENNEY_BUILDING_CATALOG_ENTRIES,

  // StonePath variants reuse one mesh with different rotations — the sole
  // road tool. The old separate procedural 'roads' tile/mesh (a different,
  // now-retired asset) has been removed entirely, not just hidden — its
  // employment/accounting facts moved here, onto the canonical variant,
  // since "the road" now means StonePath. (Every placed road, whichever
  // variant, still gets its runtime type/name marker set to the string
  // 'roads' for connectivity — see BuildingKind.js /
  // VillageTownAssetManager#createBuilding — so EmploymentSectorCatalog.js
  // and BuildingMaintenanceBreakdownPolicy.js alias that marker to this
  // entry's facts instead of expecting a 'roads' catalog id.)
  'StonePath-001': {
    displayName: 'Chemin de pierre',
    construction: { price: 5, category: 'infrastructure' },
    employment: { sector: 5, workerNeed: 0, eliteNeed: 0 },
    accounting: { maintenance: 4 },
  },
  'StonePath-Right-001': {
    displayName: 'Chemin de pierre',
    construction: { price: 5, category: 'infrastructure' },
  },
  'StonePath-Left-001': {
    displayName: 'Chemin de pierre',
    construction: { price: 5, category: 'infrastructure' },
  },
  'StonePath-Cross-001': {
    displayName: 'Chemin de pierre',
    construction: { price: 5, category: 'infrastructure' },
  },

  // Houses — color = permanent social group (never changes after placement).
  // Mutable progression (autarky vs specialized profession) lives in `level`,
  // a per-instance house row field owned by Housing — not a catalog fact.
  'House-Blue': {
    displayName: 'Maison bleue',
    construction: { price: 10, category: 'houses' },
    accounting: { maintenance: 6 },
    residentialGroup: 'merchants',
  },
  'House-Red': {
    displayName: 'Maison rouge',
    construction: { price: 10, category: 'houses' },
    accounting: { maintenance: 6 },
    residentialGroup: 'artisans',
  },
  'House-Purple': {
    displayName: 'Maison violette',
    construction: { price: 10, category: 'houses' },
    accounting: { maintenance: 6 },
    residentialGroup: 'scholars',
  },

  // Palaces
  'House-2Story': {
    displayName: 'Palais',
    construction: { price: 20, category: 'palaces' },
    accounting: { maintenance: 6 },
  },

  // Farms
  'Farm-Wheat': {
    displayName: 'Champ de blé',
    construction: { price: 10, category: 'farms' },
    employment: { sector: 1, workerNeed: 3, eliteNeed: 0 },
  },
  'Farm-Carrot': {
    displayName: 'Champ de carottes',
    construction: { price: 20, category: 'farms' },
    employment: { sector: 1, workerNeed: 3, eliteNeed: 0 },
  },
  'Farm-Cabbage': {
    displayName: 'Champ de choux',
    construction: { price: 30, category: 'farms' },
    employment: { sector: 1, workerNeed: 3, eliteNeed: 0 },
  },
  'Hay-Bale': { displayName: 'Botte de foin', construction: { price: 2, category: 'farms' } },
  'Hay-Cart': { displayName: 'Chariot de foin', construction: { price: 5, category: 'farms' } },
  'Hay-Pile': { displayName: 'Meule de foin', construction: { price: 2, category: 'farms' } },

  // Industry
  'Windmill-001': {
    displayName: 'Moulin',
    construction: { price: 50, category: 'industry' },
    employment: { sector: 4, workerNeed: 4, eliteNeed: 2 },
  },
  'Barn-001': {
    displayName: 'Grange',
    construction: { price: 40, category: 'industry' },
    // Worker capacity is derived from storage rules owned by the supply
    // bounded context (see BarnCommerceCatalog.getBarnMaxWorkers) — not a
    // fixed catalog fact, so workerNeed/eliteNeed are intentionally absent.
    employment: { sector: 4 },
  },
  'Crate-001': { displayName: 'Caisse', construction: { price: 2, category: 'industry' } },
  'Winery-001': {
    displayName: 'Chai',
    construction: { price: 50, category: 'industry' },
    employment: { sector: 3, workerNeed: 18, eliteNeed: 0 },
  },
  // Wheat silo (all Cylinder* meshes pool to this one tool)
  Cylinder: { displayName: 'Silo à blé', construction: { price: 15, category: 'industry' } },

  // Markets
  'Market-Stall': {
    displayName: 'Étal',
    construction: { price: 10, category: 'markets' },
    employment: { sector: 2, workerNeed: 2, eliteNeed: 1 },
  },
  'Market-Stall-Blue': {
    displayName: 'Étal bleu',
    construction: { price: 10, category: 'markets' },
    employment: { sector: 2, workerNeed: 2, eliteNeed: 1 },
  },
  'Market-Stall-Red': {
    displayName: 'Étal rouge',
    construction: { price: 10, category: 'markets' },
    employment: { sector: 2, workerNeed: 2, eliteNeed: 1 },
  },

  // Public (Chapel only — Church-002 mesh discarded as broken duplicate)
  // Sector 6 (Services Publics) — scholars' workplaces.
  Chapel: {
    displayName: 'Chapelle',
    construction: { price: 60, category: 'public' },
    employment: { sector: 6, workerNeed: 2, eliteNeed: 0 },
  },
  'BookShop-001': {
    displayName: 'Librairie',
    construction: { price: 60, category: 'public' },
    employment: { sector: 6, workerNeed: 2, eliteNeed: 0 },
  },
  // Legacy save alias — same building as Chapel, kept for old saves
  'Church-002': { displayName: 'Chapelle', construction: { price: 60, category: 'public' } },
};
