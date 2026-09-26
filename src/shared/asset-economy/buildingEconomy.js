import { KENNEY_BUILDING_CATALOG_ENTRIES } from '../building-catalog/kenneyCityKitRegistry.generated.js';

/**
 * Economy facts (price, category, employment, accounting, residentialGroup,
 * displayName) for the playable-building theme — houses, farms, industry,
 * markets, infrastructure, public. See buildingCatalog.js for the
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

/**
 * Manufactured and raw goods a goods warehouse stores, and the aggregate they are filed under.
 * A warehouse is a hub like the windmill: what it accepts is only its own `categories`, so one hub
 * can hold the diet's crops and another these goods, side by side.
 */
const RETAIL_GOODS = ['furniture', 'plate', 'pot', 'amphora'];
/** What lights a home. */
const LIGHT_GOODS = ['oil', 'candle'];
/** Raw farm goods that are not eaten: the oil press draws them from a warehouse. */
const RAW_FARM_GOODS = ['olive'];
const STORED_GOODS = ['wood', ...RETAIL_GOODS, ...LIGHT_GOODS, ...RAW_FARM_GOODS];
/** An olive field's single annual harvest (olives): enough for two oil presses' year. */
const OLIVE_ANNUAL_YIELD = 120;
const GOODS_TOTAL_KEY = 'goods';
/** Manhattan tiles around a warehouse from which it collects goods, and from which a workshop draws its supplies. */
const WAREHOUSE_RANGE = 12;
const WAREHOUSE_MAX_STOCK = 500;
/** Markets a warehouse can supply at once. */
const WAREHOUSE_LINK_CAPACITY = 4;
/** Tiles between a market and the warehouse it draws its goods from. */
const MARKET_WAREHOUSE_RANGE = 8;
/** Goods one market stall can hold at once. */
const MARKET_GOODS_MAX_STOCK = 120;
/** Units of goods a citizen uses up per month (a quarter: one unit per four citizens). */
const CITIZEN_MONTHLY_GOODS_NEED = 0.25;
/** What a citizen burns to keep warm, per month, and the goods that can supply it (wood today; coal, oil... later). */
const HEAT_GOODS = ['wood'];
const HEAT_TOTAL_KEY = 'heat';
const CITIZEN_MONTHLY_HEAT_NEED = 0.1;
/** Heat one market stall can hold at once. */
const MARKET_HEAT_MAX_STOCK = 60;
/** What a citizen burns to see at night, per month, and what one market stall can hold of it. */
const LIGHT_TOTAL_KEY = 'light';
const CITIZEN_MONTHLY_LIGHT_NEED = 0.1;
const MARKET_LIGHT_MAX_STOCK = 60;

/** When a crop is sold to its hub: the windmill's collection month, declared on the field it collects from. */
const HARVEST_SALE = { schedule: { unit: 'month', values: ['december'] } };

/**
 * An industrial cycle of two steps, one a month: the first sets a base, the second multiplies it, and the
 * product is credited when the second is done; it is sold in that same month, once the cycle is complete.
 * The next cycle starts the following month, and selling never holds it up (see ProduceResource `cycle`).
 * Change the numbers, the months or the step names here, one building at a time.
 */
const twoMonthCycle = ({ first, second, base, factor, inputs }) => ({
  cycle: [
    { id: first, when: { unit: 'monthIndex', interval: 2, offset: 0 }, amount: base, wait: true, ...(inputs ? { inputs } : {}) },
    { id: second, when: { unit: 'monthIndex', interval: 2, offset: 1 }, factor, wait: true },
  ],
  sale: { schedule: { unit: 'monthIndex', interval: 2, offset: 1 } },
});

/** A raw-material producer of wood from the trees around it; its name and who it serves first vary. */
const lumberjack = ({ displayName, clients }) => ({
  displayName,
  construction: { price: 45, category: 'industry' },
  employment: { sector: 3, workerNeed: 2, requiredSkill: 'artisanat' },
  resourceRoles: [{
    role: 'producer',
    categories: ['wood'],
    schedule: { unit: 'always' },
    amount: 10,
    source: { resource: 'wood', range: 6, consume: 1 },
    clients,
    periodLock: { field: 'lastProductionMonth', unit: 'month' },
  }],
});

/*
 * The food chain's reference numbers. Every capacity and yield below is derived from these
 * few figures, so the chain reads as one ratio (a farm feeds so many citizens, a hub holds
 * so many farms' harvest, a market serves the citizens of one hub) and retuning it is one edit.
 */
/** Units of food a citizen eats per month. */
const CITIZEN_MONTHLY_NEED = 1;
const MONTHS_PER_YEAR = 12;
/** Citizens one farm feeds all year — a tier-4 house (24), or four tier-1 houses (6 each). */
const CITIZENS_FED_PER_FARM = 24;
/** A farm's single annual harvest: exactly what its citizens eat over the year. */
const FARM_ANNUAL_YIELD = CITIZENS_FED_PER_FARM * CITIZEN_MONTHLY_NEED * MONTHS_PER_YEAR;
/** Farms whose harvest one hub can hold at once (a full year of their citizens). */
const FARMS_PER_HUB = 10;
const HUB_MAX_STOCK = FARMS_PER_HUB * FARM_ANNUAL_YIELD;

/** A citizen's need: `amount` units per inhabitant per month (see ConsumeResource.js). */
const HOUSE_DIET_CONSUMER = {
  role: 'consumer',
  categories: [...SUPPLIED_GOODS, ...GATHERED_GOODS],
  totalKey: DIET_TOTAL_KEY,
  amount: CITIZEN_MONTHLY_NEED,
  // Asks for exactly this period's meal and holds nothing back: the supply hub stays the
  // one place where the stock lives, and a house shows what it ate (`lastConsumption`).
  stockTarget: { periods: 1 },
  schedule: { unit: 'always' },
  periodLock: { field: 'lastConsumptionMonth', unit: 'month' },
  outcomeField: 'lastConsumption',
};

/**
 * A second need, wholly parallel to the diet: goods a citizen wears out, drawn from the market like
 * the diet is. Same mechanism, only its goods, rate and fields differ — and all are declared here.
 */
const HOUSE_GOODS_CONSUMER = {
  role: 'consumer',
  categories: [...RETAIL_GOODS],
  totalKey: GOODS_TOTAL_KEY,
  amount: CITIZEN_MONTHLY_GOODS_NEED,
  stockTarget: { periods: 1 },
  schedule: { unit: 'always' },
  periodLock: { field: 'lastGoodsConsumptionMonth', unit: 'month' },
  outcomeField: 'lastGoodsConsumption',
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

/**
 * A third need, parallel to the others: what a citizen burns to keep warm. Wood serves it today; any other
 * good added to `HEAT_GOODS` serves it too — a citizen is warm as soon as ANY of them covers the need.
 */
const HOUSE_HEAT_CONSUMER = {
  role: 'consumer',
  categories: [...HEAT_GOODS],
  totalKey: HEAT_TOTAL_KEY,
  amount: CITIZEN_MONTHLY_HEAT_NEED,
  stockTarget: { periods: 1 },
  schedule: { unit: 'always' },
  periodLock: { field: 'lastHeatConsumptionMonth', unit: 'month' },
  outcomeField: 'lastHeatConsumption',
};

/**
 * A fourth need, parallel to the others: what lights the home. Oil or candles serve it, either one — a home is
 * lit as soon as ANY of them covers the need.
 */
const HOUSE_LIGHT_CONSUMER = {
  role: 'consumer',
  categories: [...LIGHT_GOODS],
  totalKey: LIGHT_TOTAL_KEY,
  amount: CITIZEN_MONTHLY_LIGHT_NEED,
  stockTarget: { periods: 1 },
  schedule: { unit: 'always' },
  periodLock: { field: 'lastLightConsumptionMonth', unit: 'month' },
  outcomeField: 'lastLightConsumption',
};

/** Everything a house-like building holds: diet, gathering, and every service it can be covered by. */
const HOUSE_RESOURCE_ROLES = [
  HOUSE_DIET_CONSUMER,
  HOUSE_GOODS_CONSUMER,
  HOUSE_HEAT_CONSUMER,
  HOUSE_LIGHT_CONSUMER,
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

/** Stock ceiling of every market stall: one month of the citizens the farms of one hub feed. */
const MARKET_MAX_STOCK = FARMS_PER_HUB * CITIZENS_FED_PER_FARM * CITIZEN_MONTHLY_NEED;
/** Tiles between a market and the silo feeding it (placement gate, not service reach). */
const MARKET_SILO_PLACEMENT_RANGE = 5;

const MARKET_RESOURCE_ROLES = [{
  role: 'distributor',
  categories: [...SUPPLIED_GOODS],
  range: Infinity,
  totalKey: DIET_TOTAL_KEY,
  maxStock: MARKET_MAX_STOCK,
  schedule: { unit: 'always' },
  // Which hub it draws on: any hub of these goods within this range (and its own field to remember it).
  hubLink: { sourceLinkField: 'supplyHubId', range: MARKET_SILO_PLACEMENT_RANGE },
},
// The goods it also stocks and hands out, drawn from a warehouse: one more entry, nothing more. Give a
// market other `categories`, a different `hubTypes` (catalog ids of the only hubs it may use) or drop this
// entry, and that market stocks and serves exactly that.
{
  role: 'distributor',
  categories: [...RETAIL_GOODS],
  range: Infinity,
  totalKey: GOODS_TOTAL_KEY,
  maxStock: MARKET_GOODS_MAX_STOCK,
  schedule: { unit: 'always' },
  hubLink: { sourceLinkField: 'goodsHubId', range: MARKET_WAREHOUSE_RANGE, hubTypes: ['Warehouse'] },
},
// What keeps the houses warm, drawn from a warehouse like the goods above (its own hub link, ceiling, total).
{
  role: 'distributor',
  categories: [...HEAT_GOODS],
  range: Infinity,
  totalKey: HEAT_TOTAL_KEY,
  maxStock: MARKET_HEAT_MAX_STOCK,
  schedule: { unit: 'always' },
  hubLink: { sourceLinkField: 'heatHubId', range: MARKET_WAREHOUSE_RANGE, hubTypes: ['Warehouse'] },
},
// What lights the houses, drawn from a warehouse the same way.
{
  role: 'distributor',
  categories: [...LIGHT_GOODS],
  range: Infinity,
  totalKey: LIGHT_TOTAL_KEY,
  maxStock: MARKET_LIGHT_MAX_STOCK,
  schedule: { unit: 'always' },
  hubLink: { sourceLinkField: 'lightHubId', range: MARKET_WAREHOUSE_RANGE, hubTypes: ['Warehouse'] },
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
    isRoad: true,
    displayName: 'Chemin de pierre',
    construction: { price: 5, category: 'infrastructure' },
    employment: { sector: 5, workerNeed: 0 },
    accounting: { maintenance: 4 },
  },
  'StonePath-Right-001': {
    isRoad: true,
    displayName: 'Chemin de pierre',
    construction: { price: 5, category: 'infrastructure' },
  },
  'StonePath-Left-001': {
    isRoad: true,
    displayName: 'Chemin de pierre',
    construction: { price: 5, category: 'infrastructure' },
  },
  'StonePath-Cross-001': {
    isRoad: true,
    displayName: 'Chemin de pierre',
    construction: { price: 5, category: 'infrastructure' },
  },
  'StonePath-Tee-001': {
    isRoad: true,
    displayName: 'Chemin de pierre',
    construction: { price: 5, category: 'infrastructure' },
  },
  'StonePath-End-001': {
    isRoad: true,
    displayName: 'Chemin de pierre',
    construction: { price: 5, category: 'infrastructure' },
  },

  // Houses — color = permanent social group (never changes after placement).
  // Mutable progression (autarky vs specialized profession) lives in `level`,
  // a per-instance house row field owned by Housing — not a catalog fact.
  // Every house holds one 'flag' consumer entry per service category:
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

  // Farms — fields, no road needed (`requiresRoad: false`): they employ, produce
  // and are collected by a hub whether or not a road touches them.
  // `schedule`/`amount` below: farms harvest their annual crop once, in
  // autumn (see ResourceSchedulePolicy.js for the schedule shape). The yield is
  // FARM_ANNUAL_YIELD: what CITIZENS_FED_PER_FARM citizens eat over a year, no margin.
  'Farm-Wheat': {
    displayName: 'Champ de blé',
    requiresRoad: false,
    construction: { price: 10, category: 'farms' },
    employment: { sector: 1, workerNeed: 3, requiredSkill: 'fermier' },
    resourceRoles: [{
      role: 'producer',
      categories: ['wheat'],
      schedule: { unit: 'season', values: ['autumn'] },
      sale: HARVEST_SALE,
      amount: FARM_ANNUAL_YIELD,
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
      sale: HARVEST_SALE,
      amount: FARM_ANNUAL_YIELD,
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
      sale: HARVEST_SALE,
      amount: FARM_ANNUAL_YIELD,
      periodLock: { field: 'lastProductionYear', unit: 'year' },
    }],
  },

  // Olive grove: the first field whose harvest is not eaten. Same shape as the crop fields — one annual harvest,
  // sold to a hub in the sale window — but what it grows goes to the oil press (Factory-Oil), not to the citizens.
  'Farm-Olive': {
    displayName: 'Champ d\'oliviers',
    requiresRoad: false,
    construction: { price: 30, category: 'farms' },
    employment: { sector: 1, workerNeed: 3, requiredSkill: 'fermier' },
    resourceRoles: [{
      role: 'producer',
      categories: ['olive'],
      schedule: { unit: 'season', values: ['autumn'] },
      sale: HARVEST_SALE,
      amount: OLIVE_ANNUAL_YIELD,
      periodLock: { field: 'lastProductionYear', unit: 'year' },
    }],
  },

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
      // 2 in the first month, x5 in the second: 10 every two months, sold once complete.
      ...twoMonthCycle({ first: 'shaping', second: 'firing', base: 2, factor: 5 }),
    }],
  },
  'Factory-Pot': {
    displayName: 'Atelier de pots',
    construction: { price: 55, category: 'industry' },
    employment: { sector: 3, workerNeed: 2, requiredSkill: 'artisanat' },
    resourceRoles: [{
      role: 'producer',
      categories: ['pot'],
      // 2 in the first month, x5 in the second: 10 every two months, sold once complete.
      ...twoMonthCycle({ first: 'shaping', second: 'firing', base: 2, factor: 5 }),
    }],
  },
  'Factory-Amphora': {
    displayName: 'Atelier d\'amphores',
    construction: { price: 70, category: 'industry' },
    employment: { sector: 3, workerNeed: 2, requiredSkill: 'artisanat' },
    resourceRoles: [{
      role: 'producer',
      categories: ['amphora'],
      // 2 in the first month, x5 in the second: 10 every two months, sold once complete.
      ...twoMonthCycle({ first: 'shaping', second: 'firing', base: 2, factor: 5 }),
    }],
  },

  // Lighting workshops: two more producers of the same shape as the pottery workshops — one good each, a
  // two-month cycle, sold to a warehouse. What they make lights the houses (see HOUSE_LIGHT_CONSUMER).
  'Factory-Oil': {
    displayName: 'Huilerie',
    construction: { price: 50, category: 'industry' },
    employment: { sector: 3, workerNeed: 2, requiredSkill: 'artisanat' },
    resourceRoles: [{
      role: 'producer',
      categories: ['oil'],
      // A recipe: pressing takes 10 olives from a warehouse in range (and waits for them if they are late);
      // settling multiplies: 10 oil every two months, sold once complete.
      ...twoMonthCycle({
        first: 'pressing',
        second: 'settling',
        base: 2,
        factor: 5,
        inputs: [{ category: 'olive', amount: 10, from: { role: 'hub', range: WAREHOUSE_RANGE } }],
      }),
    }],
  },
  'Factory-Candle': {
    displayName: 'Chandellerie',
    construction: { price: 60, category: 'industry' },
    employment: { sector: 3, workerNeed: 2, requiredSkill: 'artisanat' },
    resourceRoles: [{
      role: 'producer',
      categories: ['candle'],
      ...twoMonthCycle({ first: 'melting', second: 'moulding', base: 2, factor: 5 }),
    }],
  },

  // Raw-material producer (2026-09-23): the first building whose output comes from
  // the map itself. `source` is the whole mechanism — it works only while `range`
  // tiles around it hold a natural resource of that kind (trees are 'wood', see
  // natureEconomy.js), each month's production fells `consume` of them, and the
  // same range gates its placement. Retune or reuse it for any natural resource.
  //
  // Two entries of the same producer that differ only in name and in whom its wood goes to first (`clients`,
  // which the player can reorder or stop in the Clients tab): the lumberjack for households, the industrial
  // one for workshops. Same mesh and footprint (see buildingAssets.js / buildingFootprint.js).
  'Lumberjack': lumberjack({
    displayName: 'Bûcheron',
    clients: ['Market-Stall', 'Market-Stall-Blue', 'Market-Stall-Red', 'Factory-Furniture'],
  }),
  'Lumberjack-Industry': lumberjack({
    displayName: 'Bûcheron industriel',
    clients: ['Factory-Furniture', 'Market-Stall', 'Market-Stall-Blue', 'Market-Stall-Red'],
  }),

  // Furniture workshop (2026-09-23): a recipe — it turns wood into furniture. Its `inputs[].from` says
  // where the wood comes from: a hub (warehouse) within range that holds it, nearest first. With no wood
  // there, it idles and runs again as soon as some arrives. Retune the ratio or the range here.
  'Factory-Furniture': {
    displayName: 'Atelier de meubles',
    construction: { price: 60, category: 'industry' },
    employment: { sector: 3, workerNeed: 2, requiredSkill: 'artisanat' },
    resourceRoles: [{
      role: 'producer',
      categories: ['furniture'],
      // Cutting takes the wood (from a warehouse in range) and waits for it if it is late; assembling
      // multiplies: 10 furniture every two months for 10 wood, sold once complete.
      ...twoMonthCycle({
        first: 'cutting',
        second: 'assembling',
        base: 2,
        factor: 5,
        inputs: [{ category: 'wood', amount: 10, from: { role: 'hub', range: WAREHOUSE_RANGE } }],
      }),
    }],
  },

  // Goods warehouse (2026-09-23): the windmill's counterpart for everything that is not eaten. It
  // collects the goods (raw or manufactured) of the producers within `range`, all year round, and holds
  // them for whoever draws on a hub (a workshop's recipe). Same hub mechanism as the windmill; only the
  // goods it accepts, its capacity, its range and its rhythm differ, and all of them are declared here.
  'Warehouse': {
    displayName: 'Entrepôt',
    construction: { price: 80, category: 'industry' },
    employment: { sector: 4, workerNeed: 2, requiredSkill: 'artisanat' },
    resourceRoles: [
      {
        role: 'collector',
        categories: [...STORED_GOODS],
        totalKey: GOODS_TOTAL_KEY,
        range: WAREHOUSE_RANGE,
        schedule: { unit: 'always' },
      },
      {
        role: 'hub',
        categories: [...STORED_GOODS],
        totalKey: GOODS_TOTAL_KEY,
        linkCapacity: WAREHOUSE_LINK_CAPACITY,
        maxStock: WAREHOUSE_MAX_STOCK,
        hubLink: { linksField: 'linkedDistributors', linkTargetIdField: 'distributorId', allocationField: 'allocatedStocks' },
      },
    ],
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
        maxStock: HUB_MAX_STOCK,
        hubLink: { linksField: 'linkedDistributors', linkTargetIdField: 'distributorId', allocationField: 'allocatedStocks' },
      },
    ],
  },

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
