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
  // SceneAssetManager#createBuilding — so EmploymentSectorCatalog.js
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
  'House-Blue': {
    displayName: 'Maison bleue',
    construction: { price: 10, category: 'houses' },
    accounting: { maintenance: 6 },
    residentialGroup: 'merchants',
    resourceRoles: [
      { role: 'consumer', categories: ['wheat', 'carrot', 'cabbage', 'fruit', 'game'], totalKey: 'food', amount: 1, schedule: { unit: 'always' }, periodLock: { field: 'lastConsumptionMonth', unit: 'month' } },
      { role: 'consumer', categories: ['faith'], consumption: 'flag', schedule: { unit: 'always' }, periodLock: { unit: 'month' } },
      { role: 'consumer', categories: ['school'], consumption: 'flag', schedule: { unit: 'always' }, periodLock: { unit: 'month' } },
      { role: 'consumer', categories: ['library'], consumption: 'flag', schedule: { unit: 'always' }, periodLock: { unit: 'month' } },
      { role: 'consumer', categories: ['doctor'], consumption: 'flag', schedule: { unit: 'always' }, periodLock: { unit: 'month' } },
      { role: 'consumer', categories: ['hospital'], consumption: 'flag', schedule: { unit: 'always' }, periodLock: { unit: 'month' } },
      { role: 'consumer', categories: ['publicBath'], consumption: 'flag', schedule: { unit: 'always' }, periodLock: { unit: 'month' } },
      { role: 'consumer', categories: ['theatre'], consumption: 'flag', schedule: { unit: 'always' }, periodLock: { unit: 'month' } },
      { role: 'consumer', categories: ['cinema'], consumption: 'flag', schedule: { unit: 'always' }, periodLock: { unit: 'month' } },
      { role: 'consumer', categories: ['pub'], consumption: 'flag', schedule: { unit: 'always' }, periodLock: { unit: 'month' } },
    ],
  },
  'House-Red': {
    displayName: 'Maison rouge',
    construction: { price: 10, category: 'houses' },
    accounting: { maintenance: 6 },
    residentialGroup: 'artisans',
    resourceRoles: [
      { role: 'consumer', categories: ['wheat', 'carrot', 'cabbage', 'fruit', 'game'], totalKey: 'food', amount: 1, schedule: { unit: 'always' }, periodLock: { field: 'lastConsumptionMonth', unit: 'month' } },
      { role: 'consumer', categories: ['faith'], consumption: 'flag', schedule: { unit: 'always' }, periodLock: { unit: 'month' } },
      { role: 'consumer', categories: ['school'], consumption: 'flag', schedule: { unit: 'always' }, periodLock: { unit: 'month' } },
      { role: 'consumer', categories: ['library'], consumption: 'flag', schedule: { unit: 'always' }, periodLock: { unit: 'month' } },
      { role: 'consumer', categories: ['doctor'], consumption: 'flag', schedule: { unit: 'always' }, periodLock: { unit: 'month' } },
      { role: 'consumer', categories: ['hospital'], consumption: 'flag', schedule: { unit: 'always' }, periodLock: { unit: 'month' } },
      { role: 'consumer', categories: ['publicBath'], consumption: 'flag', schedule: { unit: 'always' }, periodLock: { unit: 'month' } },
      { role: 'consumer', categories: ['theatre'], consumption: 'flag', schedule: { unit: 'always' }, periodLock: { unit: 'month' } },
      { role: 'consumer', categories: ['cinema'], consumption: 'flag', schedule: { unit: 'always' }, periodLock: { unit: 'month' } },
      { role: 'consumer', categories: ['pub'], consumption: 'flag', schedule: { unit: 'always' }, periodLock: { unit: 'month' } },
    ],
  },
  'House-Purple': {
    displayName: 'Maison violette',
    construction: { price: 10, category: 'houses' },
    accounting: { maintenance: 6 },
    residentialGroup: 'scholars',
    resourceRoles: [
      { role: 'consumer',
        categories: ['wheat', 'carrot', 'cabbage', 'fruit', 'game'],
        totalKey: 'food', amount: 1,
        schedule: { unit: 'always' },
        periodLock: { field: 'lastConsumptionMonth', unit: 'month' }
      },
      { role: 'consumer', categories: ['faith'], consumption: 'flag', schedule: { unit: 'always' }, periodLock: { unit: 'month' } },
      { role: 'consumer', categories: ['school'], consumption: 'flag', schedule: { unit: 'always' }, periodLock: { unit: 'month' } },
      { role: 'consumer', categories: ['library'], consumption: 'flag', schedule: { unit: 'always' }, periodLock: { unit: 'month' } },
      { role: 'consumer', categories: ['doctor'], consumption: 'flag', schedule: { unit: 'always' }, periodLock: { unit: 'month' } },
      { role: 'consumer', categories: ['hospital'], consumption: 'flag', schedule: { unit: 'always' }, periodLock: { unit: 'month' } },
      { role: 'consumer', categories: ['publicBath'], consumption: 'flag', schedule: { unit: 'always' }, periodLock: { unit: 'month' } },
      { role: 'consumer', categories: ['theatre'], consumption: 'flag', schedule: { unit: 'always' }, periodLock: { unit: 'month' } },
      { role: 'consumer', categories: ['cinema'], consumption: 'flag', schedule: { unit: 'always' }, periodLock: { unit: 'month' } },
      { role: 'consumer', categories: ['pub'], consumption: 'flag', schedule: { unit: 'always' }, periodLock: { unit: 'month' } },
    ]
  },

  // Palaces
  'House-2Story': {
    displayName: 'Palais',
    construction: { price: 20, category: 'palaces' },
    accounting: { maintenance: 6 },
    resourceRoles: [
      { role: 'consumer', categories: ['wheat', 'carrot', 'cabbage', 'fruit', 'game'], totalKey: 'food', amount: 1, schedule: { unit: 'always' }, periodLock: { field: 'lastConsumptionMonth', unit: 'month' } },
      { role: 'consumer', categories: ['faith'], consumption: 'flag', schedule: { unit: 'always' }, periodLock: { unit: 'month' } },
      { role: 'consumer', categories: ['school'], consumption: 'flag', schedule: { unit: 'always' }, periodLock: { unit: 'month' } },
      { role: 'consumer', categories: ['library'], consumption: 'flag', schedule: { unit: 'always' }, periodLock: { unit: 'month' } },
      { role: 'consumer', categories: ['doctor'], consumption: 'flag', schedule: { unit: 'always' }, periodLock: { unit: 'month' } },
      { role: 'consumer', categories: ['hospital'], consumption: 'flag', schedule: { unit: 'always' }, periodLock: { unit: 'month' } },
      { role: 'consumer', categories: ['publicBath'], consumption: 'flag', schedule: { unit: 'always' }, periodLock: { unit: 'month' } },
      { role: 'consumer', categories: ['theatre'], consumption: 'flag', schedule: { unit: 'always' }, periodLock: { unit: 'month' } },
      { role: 'consumer', categories: ['cinema'], consumption: 'flag', schedule: { unit: 'always' }, periodLock: { unit: 'month' } },
      { role: 'consumer', categories: ['pub'], consumption: 'flag', schedule: { unit: 'always' }, periodLock: { unit: 'month' } },
    ],
  },

  // Farms
  // `schedule`/`amount` below: farms harvest their annual crop once, in
  // autumn (see ResourceSchedulePolicy.js for the schedule shape). 78 =
  // 6 citizens x 12 months + a 6-basket buffer.
  'Farm-Wheat': {
    displayName: 'Champ de blé',
    construction: { price: 10, category: 'farms' },
    employment: { sector: 1, workerNeed: 3, eliteNeed: 0, requiredSkill: 'fermier' },
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
    construction: { price: 20, category: 'farms' },
    employment: { sector: 1, workerNeed: 3, eliteNeed: 0, requiredSkill: 'fermier' },
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
    construction: { price: 30, category: 'farms' },
    employment: { sector: 1, workerNeed: 3, eliteNeed: 0, requiredSkill: 'fermier' },
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
    employment: { sector: 3, workerNeed: 2, eliteNeed: 0, requiredSkill: 'artisanat' },
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
    employment: { sector: 3, workerNeed: 2, eliteNeed: 0, requiredSkill: 'artisanat' },
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
    employment: { sector: 3, workerNeed: 2, eliteNeed: 0, requiredSkill: 'artisanat' },
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
    employment: { sector: 4, workerNeed: 4, eliteNeed: 2, requiredSkill: 'stockage-alimentaire' },
    // No `range` on 'collector': today it collects city-wide (matches
    // RunHubSurplusCycle passing every source, unfiltered by distance).
    // A future resource can cap this with a range; food doesn't today.
    resourceRoles: [
      {
        role: 'collector',
        categories: ['wheat', 'carrot', 'cabbage'],
        totalKey: 'food',
        schedule: { unit: 'month', values: ['december'] },
      },
      {
        role: 'hub',
        categories: ['wheat', 'carrot', 'cabbage'],
        totalKey: 'food',
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
    employment: { sector: 2, workerNeed: 2, eliteNeed: 1, requiredSkill: 'vente-alimentaire' },
    // Unlimited reach (2026-09-11, same reasoning as Chapel below) — a
    // debugging aid so a house's food access is never confounded by tile
    // distance while chasing other bugs; `placementRequires`'s hub range
    // just below is a DIFFERENT mechanic (construction placement gating,
    // not service reach) and is deliberately left untouched.
    resourceRoles: [{ role: 'distributor', categories: ['wheat', 'carrot', 'cabbage'], range: Infinity, totalKey: 'food', schedule: { unit: 'always' }, hubLink: { sourceLinkField: 'supplyHubId' } }],
    placementRequires: [{ role: 'hub', categories: ['wheat', 'carrot', 'cabbage'], range: 5, requiresCapacity: true }],
  },
  'Market-Stall-Blue': {
    displayName: 'Étal bleu',
    construction: { price: 10, category: 'markets' },
    employment: { sector: 2, workerNeed: 2, eliteNeed: 1, requiredSkill: 'vente-alimentaire' },
    // Unlimited reach (2026-09-11, same reasoning as Chapel below) — a
    // debugging aid so a house's food access is never confounded by tile
    // distance while chasing other bugs; `placementRequires`'s hub range
    // just below is a DIFFERENT mechanic (construction placement gating,
    // not service reach) and is deliberately left untouched.
    resourceRoles: [{ role: 'distributor', categories: ['wheat', 'carrot', 'cabbage'], range: Infinity, totalKey: 'food', schedule: { unit: 'always' }, hubLink: { sourceLinkField: 'supplyHubId' } }],
    placementRequires: [{ role: 'hub', categories: ['wheat', 'carrot', 'cabbage'], range: 5, requiresCapacity: true }],
  },
  'Market-Stall-Red': {
    displayName: 'Étal rouge',
    construction: { price: 10, category: 'markets' },
    employment: { sector: 2, workerNeed: 2, eliteNeed: 1, requiredSkill: 'vente-alimentaire' },
    // Unlimited reach (2026-09-11, same reasoning as Chapel below) — a
    // debugging aid so a house's food access is never confounded by tile
    // distance while chasing other bugs; `placementRequires`'s hub range
    // just below is a DIFFERENT mechanic (construction placement gating,
    // not service reach) and is deliberately left untouched.
    resourceRoles: [{ role: 'distributor', categories: ['wheat', 'carrot', 'cabbage'], range: Infinity, totalKey: 'food', schedule: { unit: 'always' }, hubLink: { sourceLinkField: 'supplyHubId' } }],
    placementRequires: [{ role: 'hub', categories: ['wheat', 'carrot', 'cabbage'], range: 5, requiresCapacity: true }],
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
    employment: { sector: 6, workerNeed: 2, eliteNeed: 0, requiredSkill: 'spiritual' },
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
    employment: { sector: 6, workerNeed: 2, eliteNeed: 0, requiredSkill: 'education' },
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
  // same need at different scale (Doctor/Hospital, Library-BookShop/School,
  // Cinema/Theatre), the bigger one requires the skill's level-2 grant.
  //
  // range: Infinity (2026-09-11, same reasoning as Chapel/Market above) —
  // a debugging aid: with distance never a confound, a house failing to
  // reach a tier or hold a skill is provably a REAL bug (allocation order,
  // a missing skill grant, ...), not just "too far from the service." Once
  // gameplay balancing starts, these can get real per-building ranges back
  // one at a time.
  School: {
    displayName: 'École',
    construction: { price: 90, category: 'public' },
    employment: { sector: 6, workerNeed: 3, eliteNeed: 0, requiredSkill: 'education', requiredSkillLevel: 2 },
    resourceRoles: [{ role: 'distributor', categories: ['school'], range: Infinity, schedule: { unit: 'always' }, consumption: 'flag' }],
  },
  Library: {
    displayName: 'Bibliothèque',
    construction: { price: 50, category: 'public' },
    employment: { sector: 6, workerNeed: 2, eliteNeed: 0, requiredSkill: 'education' },
    resourceRoles: [{ role: 'distributor', categories: ['library'], range: Infinity, schedule: { unit: 'always' }, consumption: 'flag' }],
  },
  Doctor: {
    displayName: 'Cabinet médical',
    construction: { price: 55, category: 'public' },
    employment: { sector: 6, workerNeed: 2, eliteNeed: 0, requiredSkill: 'medical' },
    resourceRoles: [{ role: 'distributor', categories: ['doctor'], range: Infinity, schedule: { unit: 'always' }, consumption: 'flag' }],
  },
  Hospital: {
    displayName: 'Hôpital',
    construction: { price: 140, category: 'public' },
    employment: { sector: 6, workerNeed: 4, eliteNeed: 0, requiredSkill: 'medical', requiredSkillLevel: 2 },
    resourceRoles: [{ role: 'distributor', categories: ['hospital'], range: Infinity, schedule: { unit: 'always' }, consumption: 'flag' }],
  },
  PublicBath: {
    displayName: 'Bains publics',
    construction: { price: 85, category: 'public' },
    employment: { sector: 6, workerNeed: 3, eliteNeed: 0, requiredSkill: 'hygiene' },
    resourceRoles: [{ role: 'distributor', categories: ['publicBath'], range: Infinity, schedule: { unit: 'always' }, consumption: 'flag' }],
  },
  Theatre: {
    displayName: 'Théâtre',
    construction: { price: 130, category: 'public' },
    employment: { sector: 6, workerNeed: 4, eliteNeed: 0, requiredSkill: 'entertainment', requiredSkillLevel: 2 },
    resourceRoles: [{ role: 'distributor', categories: ['theatre'], range: Infinity, schedule: { unit: 'always' }, consumption: 'flag' }],
  },
  Cinema: {
    displayName: 'Cinéma',
    construction: { price: 95, category: 'public' },
    employment: { sector: 6, workerNeed: 3, eliteNeed: 0, requiredSkill: 'entertainment' },
    resourceRoles: [{ role: 'distributor', categories: ['cinema'], range: Infinity, schedule: { unit: 'always' }, consumption: 'flag' }],
  },
  Pub: {
    displayName: 'Taverne',
    construction: { price: 45, category: 'public' },
    employment: { sector: 6, workerNeed: 2, eliteNeed: 0, requiredSkill: 'hospitality' },
    resourceRoles: [{ role: 'distributor', categories: ['pub'], range: Infinity, schedule: { unit: 'always' }, consumption: 'flag' }],
  },
};
