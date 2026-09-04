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
    resourceRoles: [{ role: 'consumer', categories: ['wheat', 'carrot', 'cabbage', 'fruit', 'game'] }],
  },
  'House-Red': {
    displayName: 'Maison rouge',
    construction: { price: 10, category: 'houses' },
    accounting: { maintenance: 6 },
    residentialGroup: 'artisans',
    resourceRoles: [{ role: 'consumer', categories: ['wheat', 'carrot', 'cabbage', 'fruit', 'game'] }],
  },
  'House-Purple': {
    displayName: 'Maison violette',
    construction: { price: 10, category: 'houses' },
    accounting: { maintenance: 6 },
    residentialGroup: 'scholars',
    resourceRoles: [{ role: 'consumer', categories: ['wheat', 'carrot', 'cabbage', 'fruit', 'game'] }],
  },

  // Palaces
  'House-2Story': {
    displayName: 'Palais',
    construction: { price: 20, category: 'palaces' },
    accounting: { maintenance: 6 },
    resourceRoles: [{ role: 'consumer', categories: ['wheat', 'carrot', 'cabbage', 'fruit', 'game'] }],
  },

  // Farms
  'Farm-Wheat': {
    displayName: 'Champ de blé',
    construction: { price: 10, category: 'farms' },
    employment: { sector: 1, workerNeed: 3, eliteNeed: 0 },
    resourceRoles: [{ role: 'producer', categories: ['wheat'] }],
  },
  'Farm-Carrot': {
    displayName: 'Champ de carottes',
    construction: { price: 20, category: 'farms' },
    employment: { sector: 1, workerNeed: 3, eliteNeed: 0 },
    resourceRoles: [{ role: 'producer', categories: ['carrot'] }],
  },
  'Farm-Cabbage': {
    displayName: 'Champ de choux',
    construction: { price: 30, category: 'farms' },
    employment: { sector: 1, workerNeed: 3, eliteNeed: 0 },
    resourceRoles: [{ role: 'producer', categories: ['cabbage'] }],
  },
  'Hay-Bale': { displayName: 'Botte de foin', construction: { price: 2, category: 'farms' } },
  'Hay-Cart': { displayName: 'Chariot de foin', construction: { price: 5, category: 'farms' } },
  'Hay-Pile': { displayName: 'Meule de foin', construction: { price: 2, category: 'farms' } },

  // Industry
  'Windmill-001': {
    displayName: 'Moulin',
    construction: { price: 50, category: 'industry' },
    employment: { sector: 4, workerNeed: 4, eliteNeed: 2 },
    // No `range` on 'collector': today it collects city-wide (matches
    // RunWindmillSurplusCycle passing every farm, unfiltered by distance).
    // A future resource can cap this with a range; food doesn't today.
    resourceRoles: [
      { role: 'collector', categories: ['wheat', 'carrot', 'cabbage'] },
      { role: 'hub', categories: ['wheat', 'carrot', 'cabbage'], linkCapacity: 2 },
    ],
  },
  'Crate-001': { displayName: 'Caisse', construction: { price: 2, category: 'industry' } },
  // Wheat silo (all Cylinder* meshes pool to this one tool)
  Cylinder: { displayName: 'Silo à blé', construction: { price: 15, category: 'industry' } },

  // Markets
  'Market-Stall': {
    displayName: 'Étal',
    construction: { price: 10, category: 'markets' },
    employment: { sector: 2, workerNeed: 2, eliteNeed: 1 },
    resourceRoles: [{ role: 'distributor', categories: ['wheat', 'carrot', 'cabbage'], range: 5 }],
    placementRequires: [{ role: 'hub', categories: ['wheat', 'carrot', 'cabbage'], range: 5, requiresCapacity: true }],
  },
  'Market-Stall-Blue': {
    displayName: 'Étal bleu',
    construction: { price: 10, category: 'markets' },
    employment: { sector: 2, workerNeed: 2, eliteNeed: 1 },
    resourceRoles: [{ role: 'distributor', categories: ['wheat', 'carrot', 'cabbage'], range: 5 }],
    placementRequires: [{ role: 'hub', categories: ['wheat', 'carrot', 'cabbage'], range: 5, requiresCapacity: true }],
  },
  'Market-Stall-Red': {
    displayName: 'Étal rouge',
    construction: { price: 10, category: 'markets' },
    employment: { sector: 2, workerNeed: 2, eliteNeed: 1 },
    resourceRoles: [{ role: 'distributor', categories: ['wheat', 'carrot', 'cabbage'], range: 5 }],
    placementRequires: [{ role: 'hub', categories: ['wheat', 'carrot', 'cabbage'], range: 5, requiresCapacity: true }],
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
