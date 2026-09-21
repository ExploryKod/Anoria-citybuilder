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
/**
 * Goods, declared ONCE. Every list of categories below (a house's diet, a
 * market's stock, the silo's collection) is built from these two arrays, so
 * adding a good is one edit here — never a name written in code.
 * Crops are supplied through the farm → silo → market → house chain; gathered
 * goods are produced by the house itself (see HOUSE_GATHERING below).
 */
const SUPPLIED_GOODS = ['wheat', 'carrot', 'cabbage'];
const GATHERED_GOODS = ['fruit', 'game'];
/** Aggregate stock field summing every good a citizen can eat. */
const DIET_TOTAL_KEY = 'food';

/** A citizen's daily need: `amount` units per inhabitant per period (see ConsumeResource.js). */
const HOUSE_DIET_CONSUMER = {
  role: 'consumer',
  categories: [...SUPPLIED_GOODS, ...GATHERED_GOODS],
  totalKey: DIET_TOTAL_KEY,
  amount: 1,
  // Asks for exactly this period's meal and holds nothing back: the supply hub stays the
  // one place where the stock lives, and a house shows what it ate (`lastConsumption`).
  stockTarget: { periods: 1 },
  schedule: { unit: 'always' },
  periodLock: { field: 'lastConsumptionMonth', unit: 'month' },
};

/**
 * Free household gathering (autarky) — every house produces these on its own,
 * outside farms and markets. `scale` picks how `amount` is read:
 *   'building'   — a FIXED amount per house, whatever its population;
 *   'population' — amount × the house's inhabitants.
 * `requiresOperational: false` lets a house without a road still gather.
 */
const HOUSE_GATHERING = {
  role: 'producer',
  categories: [...GATHERED_GOODS],
  totalKey: DIET_TOTAL_KEY,
  amount: 1,
  scale: 'building',
  requiresOperational: false,
  schedule: { unit: 'always' },
  periodLock: { field: 'lastSubsistenceMonth', unit: 'month' },
};

/** One coverage-flag consumer per service category (see socialCategoryCatalog.js for which tier needs which). */
const serviceConsumer = (category) => ({
  role: 'consumer',
  categories: [category],
  consumption: 'flag',
  schedule: { unit: 'always' },
  periodLock: { unit: 'month' },
});

/** Everything a house-like building holds: diet, gathering, and every service it can be covered by. */
const HOUSE_RESOURCE_ROLES = [
  HOUSE_DIET_CONSUMER,
  HOUSE_GATHERING,
  serviceConsumer('faith'),
  serviceConsumer('school'),
  serviceConsumer('library'),
  serviceConsumer('doctor'),
  serviceConsumer('hospital'),
  serviceConsumer('publicBath'),
  serviceConsumer('theatre'),
  serviceConsumer('cinema'),
  serviceConsumer('pub'),
];

/** Stock ceiling of every market stall (units it can hold before the silo stops restocking it). */
const MARKET_MAX_STOCK = 500;
/** Tiles between a market and the silo feeding it (placement gate, not service reach). */
const MARKET_SILO_PLACEMENT_RANGE = 5;

const MARKET_RESOURCE_ROLES = [{
  role: 'distributor',
  categories: [...SUPPLIED_GOODS],
  range: Infinity,
  totalKey: DIET_TOTAL_KEY,
  maxStock: MARKET_MAX_STOCK,
  schedule: { unit: 'always' },
  hubLink: { sourceLinkField: 'supplyHubId' },
}];
const MARKET_PLACEMENT_REQUIRES = [
  { role: 'hub', categories: [...SUPPLIED_GOODS], range: MARKET_SILO_PLACEMENT_RANGE, requiresCapacity: true },
];

export const BUILDING_ECONOMY = {
  ...KENNEY_BUILDING_CATALOG_ENTRIES,

  // StonePath variants reuse one mesh with different rotations — the sole
  // road tool. The old separate procedural 'roads' tile/mesh (a different,
  // now-retired asset) has been removed entirely, not just hidden — its
  // employment/accounting facts moved here, onto the canonical variant,
  // since "the road" now means StonePath. (Every placed road, whichever
  // variant, still gets its runtime type/name marker set to the string
  // 'roads' for connectivity — see BuildingKind.js /
  // SceneAssetManager#createBuilding — so EmploymentSectorCatalog.js
  // and BuildingMaintenanceBreakdownPolicy.js alias that marker to this
  // entry's facts instead of expecting a 'roads' catalog id.)
  'StonePath-001': {
    displayName: 'Chemin de pierre',
    construction: { price: 5, category: 'infrastructure' },
    employment: { sector: 5, workerNeed: 0 },
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
  'StonePath-Tee-001': {
    displayName: 'Chemin de pierre',
    construction: { price: 5, category: 'infrastructure' },
  },
  'StonePath-End-001': {
    displayName: 'Chemin de pierre',
    construction: { price: 5, category: 'infrastructure' },
  },

  // Houses — color = permanent social group (never changes after placement).
  // Mutable progression (autarky vs specialized profession) lives in `level`,
  // a per-instance house row field owned by Housing — not a catalog fact.
  // Every house/palace holds one 'flag' consumer entry per service category:
  // faith (Chapel) + one per service building (school, library, doctor,
  // hospital, publicBath, theatre, cinema, pub) — see
  // shared/population/socialCategoryCatalog.js for which tier requires
  // which. Adding a 10th service later means one more line here per house
  // type, never a new field name (see `servedFlags` in PeriodLockPolicy.js).
  // A house is named after the social category living in it (the colour in the id
  // is only how the code tells the three apart) — `displayName` is what the player reads.
  'House-Blue': {
    displayName: 'Commerçants',
    construction: { price: 10, category: 'houses' },
    accounting: { maintenance: 6 },
    residentialGroup: 'merchants',
    resourceRoles: HOUSE_RESOURCE_ROLES,
  },
  'House-Red': {
    displayName: 'Artisans-ouvriers',
    construction: { price: 10, category: 'houses' },
    accounting: { maintenance: 6 },
    residentialGroup: 'artisans',
    resourceRoles: HOUSE_RESOURCE_ROLES,
  },
  'House-Purple': {
    displayName: 'Savants',
    construction: { price: 10, category: 'houses' },
    accounting: { maintenance: 6 },
    residentialGroup: 'scholars',
    resourceRoles: HOUSE_RESOURCE_ROLES
  },

  // Palaces
  'House-2Story': {
    displayName: 'Palais',
    construction: { price: 20, category: 'palaces' },
    accounting: { maintenance: 6 },
    resourceRoles: HOUSE_RESOURCE_ROLES,
  },

  // Farms — fields, no road needed (`requiresRoad: false`): they employ, produce
  // and are collected by a hub whether or not a road touches them.
  // `schedule`/`amount` below: farms harvest their annual crop once, in
  // autumn (see ResourceSchedulePolicy.js for the schedule shape). 78 =
  // 6 citizens x 12 months + a 6-basket buffer.
  'Farm-Wheat': {
    displayName: 'Champ de blé',
    requiresRoad: false,
    construction: { price: 10, category: 'farms' },
    employment: { sector: 1, workerNeed: 3, requiredSkill: 'fermier' },
    resourceRoles: [{
      role: 'producer',
      categories: ['wheat'],
      schedule: { unit: 'season', values: ['autumn'] },
      amount: 78,
      periodLock: { field: 'lastProductionYear', unit: 'year' },
    }],
  },
  'Farm-Carrot': {
    displayName: 'Champ de carottes',
    requiresRoad: false,
    construction: { price: 20, category: 'farms' },
    employment: { sector: 1, workerNeed: 3, requiredSkill: 'fermier' },
    resourceRoles: [{
      role: 'producer',
      categories: ['carrot'],
      schedule: { unit: 'season', values: ['autumn'] },
      amount: 78,
      periodLock: { field: 'lastProductionYear', unit: 'year' },
    }],
  },
  'Farm-Cabbage': {
    displayName: 'Champ de choux',
    requiresRoad: false,
    construction: { price: 30, category: 'farms' },
    employment: { sector: 1, workerNeed: 3, requiredSkill: 'fermier' },
    resourceRoles: [{
      role: 'producer',
      categories: ['cabbage'],
      schedule: { unit: 'season', values: ['autumn'] },
      amount: 78,
      periodLock: { field: 'lastProductionYear', unit: 'year' },
    }],
  },
  'Hay-Bale': { displayName: 'Botte de foin', construction: { price: 2, category: 'farms' } },
  'Hay-Cart': { displayName: 'Chariot de foin', construction: { price: 5, category: 'farms' } },
  'Hay-Pile': { displayName: 'Meule de foin', construction: { price: 2, category: 'farms' } },

  // Pottery workshops (2026-09-08) — a second independent quantity-good
  // chain, proving `demandMet`/`goodsVariety` (see HouseTierRequirementPolicy.js)
  // and the whole 'producer' role really are food-agnostic. Same pattern as
  // the 3 crop farms above: one category per building, no shared totalKey
  // yet (each factory's own stock is just its own category — see
  // ResourceRolePolicy.getTotalKeyForRole's single-category fallback).
  // A 'pottery' aggregate total only needs to exist once something collects
  // across all 3 (a future kiln/hub, mirroring Windmill for food) — not
  // built now, since nothing needs it yet. `requiredSkill: 'artisanat'`
  // (2026-09-10) — artisans' own tier-2 Industries skill, shared across all
  // 3 pottery workshops (see socialCategoryCatalog.js).
  'Factory-Plate': {
    displayName: 'Atelier de plats',
    construction: { price: 40, category: 'industry' },
    employment: { sector: 3, workerNeed: 2, requiredSkill: 'artisanat' },
    resourceRoles: [{
      role: 'producer',
      categories: ['plate'],
      schedule: { unit: 'always' },
      amount: 5,
      periodLock: { field: 'lastProductionMonth', unit: 'month' },
    }],
  },
  'Factory-Pot': {
    displayName: 'Atelier de pots',
    construction: { price: 55, category: 'industry' },
    employment: { sector: 3, workerNeed: 2, requiredSkill: 'artisanat' },
    resourceRoles: [{
      role: 'producer',
      categories: ['pot'],
      schedule: { unit: 'always' },
      amount: 5,
      periodLock: { field: 'lastProductionMonth', unit: 'month' },
    }],
  },
  'Factory-Amphora': {
    displayName: 'Atelier d\'amphores',
    construction: { price: 70, category: 'industry' },
    employment: { sector: 3, workerNeed: 2, requiredSkill: 'artisanat' },
    resourceRoles: [{
      role: 'producer',
      categories: ['amphora'],
      schedule: { unit: 'always' },
      amount: 5,
      periodLock: { field: 'lastProductionMonth', unit: 'month' },
    }],
  },

  // Industry
  'Windmill-001': {
    displayName: 'Moulin',
    construction: { price: 50, category: 'industry' },
    employment: { sector: 4, workerNeed: 4, requiredSkill: 'stockage-alimentaire' },
    // No `range` on 'collector': today it collects city-wide (matches
    // RunHubSurplusCycle passing every source, unfiltered by distance).
    // A future resource can cap this with a range; food doesn't today.
    resourceRoles: [
      {
        role: 'collector',
        categories: [...SUPPLIED_GOODS],
        totalKey: DIET_TOTAL_KEY,
        schedule: { unit: 'month', values: ['december'] },
      },
      {
        role: 'hub',
        categories: [...SUPPLIED_GOODS],
        totalKey: DIET_TOTAL_KEY,
        linkCapacity: 2,
        maxStock: 1000,
        hubLink: { linksField: 'linkedDistributors', linkTargetIdField: 'distributorId', allocationField: 'allocatedStocks' },
      },
    ],
  },
  'Crate-001': { displayName: 'Caisse', construction: { price: 2, category: 'industry' } },
  // Wheat silo (all Cylinder* meshes pool to this one tool)
  Cylinder: { displayName: 'Silo à blé', construction: { price: 15, category: 'industry' } },

  // Markets
  // requiredSkill: 'vente-alimentaire' (2026-09-10) — same skill as
  // Market-Stall-Red below (merchants' tier-2 Commerces skill); every
  // market stall variant shares it regardless of house-color naming.
  'Market-Stall': {
    displayName: 'Étal',
    construction: { price: 10, category: 'markets' },
    employment: { sector: 2, workerNeed: 2, requiredSkill: 'vente-alimentaire' },
    // Unlimited reach (2026-09-11, same reasoning as Chapel below) — a
    // debugging aid so a house's food access is never confounded by tile
    // distance while chasing other bugs; `placementRequires`'s hub range
    // just below is a DIFFERENT mechanic (construction placement gating,
    // not service reach) and is deliberately left untouched.
    resourceRoles: MARKET_RESOURCE_ROLES,
    placementRequires: MARKET_PLACEMENT_REQUIRES,
  },
  'Market-Stall-Blue': {
    displayName: 'Étal bleu',
    construction: { price: 10, category: 'markets' },
    employment: { sector: 2, workerNeed: 2, requiredSkill: 'vente-alimentaire' },
    // Unlimited reach (2026-09-11, same reasoning as Chapel below) — a
    // debugging aid so a house's food access is never confounded by tile
    // distance while chasing other bugs; `placementRequires`'s hub range
    // just below is a DIFFERENT mechanic (construction placement gating,
    // not service reach) and is deliberately left untouched.
    resourceRoles: MARKET_RESOURCE_ROLES,
    placementRequires: MARKET_PLACEMENT_REQUIRES,
  },
  'Market-Stall-Red': {
    displayName: 'Étal rouge',
    construction: { price: 10, category: 'markets' },
    employment: { sector: 2, workerNeed: 2, requiredSkill: 'vente-alimentaire' },
    // Unlimited reach (2026-09-11, same reasoning as Chapel below) — a
    // debugging aid so a house's food access is never confounded by tile
    // distance while chasing other bugs; `placementRequires`'s hub range
    // just below is a DIFFERENT mechanic (construction placement gating,
    // not service reach) and is deliberately left untouched.
    resourceRoles: MARKET_RESOURCE_ROLES,
    placementRequires: MARKET_PLACEMENT_REQUIRES,
  },

  // Public (Chapel only — Church-002 mesh discarded as broken duplicate)
  // Sector 6 (Services Publics) — scholars' workplaces.
  // requiredSkill: 'spiritual' (2026-09-10) — every group's own tier-1
  // skill (see socialCategoryCatalog.js): Chapel MUST be staffable before
  // any house has reached tier 2, since tier 2 is what requires Chapel's
  // own faith coverage in the first place.
  Chapel: {
    displayName: 'Chapelle',
    construction: { price: 60, category: 'public' },
    employment: { sector: 6, workerNeed: 2, requiredSkill: 'spiritual' },
    // No hub leg — distributes straight from itself each cycle, same
    // pattern RunCityResourceCycle's own docstring anticipates for a
    // service like this (compare Market-Stall's hubLink above: none here).
    resourceRoles: [{
      role: 'distributor',
      categories: ['faith'],
      // Unlimited — faith reaches every road-connected house on the map,
      // not just ones within a fixed tile radius (2026-09-11: was `range: 5`).
      // `Infinity` is honest about "every tile present in the game" without
      // hardcoding any particular map's dimensions — ResourceRangePolicy's
      // `isWithinRange` is a plain `<=` comparison, so this flows through
      // with no special-casing anywhere it's read.
      range: Infinity,
      schedule: { unit: 'always' },
      consumption: 'flag',
    }],
  },
  // requiredSkill: 'education' (2026-09-10) — same skill/level as Library
  // below (scholars' tier-4 skill); BookShop-001 is the earlier of the two
  // library buildings and doesn't itself distribute a coverage flag (no
  // `resourceRoles`) — kept placeable and staffable regardless.
  'BookShop-001': {
    displayName: 'Librairie',
    construction: { price: 60, category: 'public' },
    employment: { sector: 6, workerNeed: 2, requiredSkill: 'education' },
  },
  // Legacy save alias — same building as Chapel, kept for old saves
  'Church-002': { displayName: 'Chapelle', construction: { price: 60, category: 'public' } },

  // Service layers (2026-09-08) — same 'flag'-distributor pattern as
  // Chapel's 'faith'. Grouped into 3 conceptual layers (education/medical/
  // entertainment — see contexts/housing/docs/service-coverage.md), but
  // each building distributes its OWN category (not a shared per-layer
  // one): the tier ladder needs to tell "a doctor visited" apart from "a
  // public bath is nearby" apart from "a hospital exists", so each gets its
  // own coverage flag. A future building that's truly interchangeable with
  // an existing one (e.g. a second small school) can still share its
  // category — sharing is a per-building catalog choice, not a layer rule.
  // Which category(ies) a house tier actually requires is a
  // socialCategoryCatalog.js decision, not decided here — a tier can
  // require more than one category at once (e.g. 'pub' AND 'publicBath'),
  // that's just two requirement entries, nothing special about this catalog.
  // Meshes borrowed from Kenney's commercial/industrial city kits — see
  // presentation/three/assets/buildingAssets.js for the id/mesh bridge
  // (this economy id is the one stable "game id"; the Kenney mesh id behind
  // it can be swapped freely without touching this file).
  //
  // requiredSkill (2026-09-10) — every service building below is wired to
  // one of scholars' service skills (medical/education/hygiene/
  // entertainment/hospitality — see socialCategoryCatalog.js), matching
  // `eligibleSectors: [6]` for that group. Where two buildings cover the
  // same need at different scale (Doctor/Hospital, Cinema/Theatre), the bigger
  // one requires the skill's level-2 grant — unless it gates a house tier (School).
  //
  // range: Infinity (2026-09-11, same reasoning as Chapel/Market above) —
  // a debugging aid: with distance never a confound, a house failing to
  // reach a tier or hold a skill is provably a REAL bug (allocation order,
  // a missing skill grant, ...), not just "too far from the service." Once
  // gameplay balancing starts, these can get real per-building ranges back
  // one at a time.
  // School gates tier 5 (`serviceCoverage: 'school'`), and a distributor only serves
  // while staffed — so, like Doctor and Cinema (the other tier gates), it needs the
  // skill's level 1, which scholars get at tier 4, one tier AHEAD of the gate. A
  // `requiredSkillLevel: 2` here (granted only from tier 5) deadlocked the ladder:
  // no house could reach tier 5 without a running School, and none could staff it
  // before tier 5. Only buildings that gate NO tier (Hospital, Theatre) take the
  // level-2 grant — see tests/shared/population/serviceStaffingReadiness.test.js.
  School: {
    displayName: 'École',
    construction: { price: 90, category: 'public' },
    employment: { sector: 6, workerNeed: 3, requiredSkill: 'education' },
    resourceRoles: [{ role: 'distributor', categories: ['school'], range: Infinity, schedule: { unit: 'always' }, consumption: 'flag' }],
  },
  Library: {
    displayName: 'Bibliothèque',
    construction: { price: 50, category: 'public' },
    employment: { sector: 6, workerNeed: 2, requiredSkill: 'education' },
    resourceRoles: [{ role: 'distributor', categories: ['library'], range: Infinity, schedule: { unit: 'always' }, consumption: 'flag' }],
  },
  Doctor: {
    displayName: 'Cabinet médical',
    construction: { price: 55, category: 'public' },
    employment: { sector: 6, workerNeed: 2, requiredSkill: 'medical' },
    resourceRoles: [{ role: 'distributor', categories: ['doctor'], range: Infinity, schedule: { unit: 'always' }, consumption: 'flag' }],
  },
  Hospital: {
    displayName: 'Hôpital',
    construction: { price: 140, category: 'public' },
    employment: { sector: 6, workerNeed: 4, requiredSkill: 'medical', requiredSkillLevel: 2 },
    resourceRoles: [{ role: 'distributor', categories: ['hospital'], range: Infinity, schedule: { unit: 'always' }, consumption: 'flag' }],
  },
  PublicBath: {
    displayName: 'Bains publics',
    construction: { price: 85, category: 'public' },
    employment: { sector: 6, workerNeed: 3, requiredSkill: 'hygiene' },
    resourceRoles: [{ role: 'distributor', categories: ['publicBath'], range: Infinity, schedule: { unit: 'always' }, consumption: 'flag' }],
  },
  Theatre: {
    displayName: 'Théâtre',
    construction: { price: 130, category: 'public' },
    employment: { sector: 6, workerNeed: 4, requiredSkill: 'entertainment', requiredSkillLevel: 2 },
    resourceRoles: [{ role: 'distributor', categories: ['theatre'], range: Infinity, schedule: { unit: 'always' }, consumption: 'flag' }],
  },
  Cinema: {
    displayName: 'Cinéma',
    construction: { price: 95, category: 'public' },
    employment: { sector: 6, workerNeed: 3, requiredSkill: 'entertainment' },
    resourceRoles: [{ role: 'distributor', categories: ['cinema'], range: Infinity, schedule: { unit: 'always' }, consumption: 'flag' }],
  },
  Pub: {
    displayName: 'Taverne',
    construction: { price: 45, category: 'public' },
    employment: { sector: 6, workerNeed: 2, requiredSkill: 'hospitality' },
    resourceRoles: [{ role: 'distributor', categories: ['pub'], range: Infinity, schedule: { unit: 'always' }, consumption: 'flag' }],
  },
};
