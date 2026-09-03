import { buildingCatalog } from '../../../../shared/building-catalog/buildingCatalog.js';

/**
 * Per-building-type maintenance costs derived from `buildingCatalog` where a
 * real building id exists. `Farm` and `Market` are category-level defaults
 * (no single building type owns them), so they stay declared locally.
 *
 * `roads` is aliased to StonePath-001's fact: every placed road (any
 * StonePath rotation variant) gets its runtime type marker set to the
 * string 'roads' for connectivity (see BuildingKind.js), which is the key
 * `classifyMaintenanceBuilding` below actually matches on — 'roads' itself
 * is not a real building id, StonePath-001 is the one true road tool.
 */
const DEFAULT_MAINTENANCE_COSTS = Object.freeze({
  roads: buildingCatalog['StonePath-001'].accounting.maintenance,
  'House-Blue': buildingCatalog['House-Blue'].accounting.maintenance,
  'House-Red': buildingCatalog['House-Red'].accounting.maintenance,
  'House-Purple': buildingCatalog['House-Purple'].accounting.maintenance,
  'House-2Story': buildingCatalog['House-2Story'].accounting.maintenance,
  Farm: 2,
  Market: 2,
});

export { DEFAULT_MAINTENANCE_COSTS };

/**
 * @param {string} type
 * @param {typeof DEFAULT_MAINTENANCE_COSTS} maintenanceCosts
 * @returns {{ category: 'roads'|'houses'|'farms'|'markets'|null, cost: number }}
 */
function classifyMaintenanceBuilding(type, maintenanceCosts) {
  if (type.includes('roads')) {
    return { category: 'roads', cost: maintenanceCosts.roads };
  }
  if (
    type === 'House-Blue' ||
    type === 'House-Red' ||
    type === 'House-Purple' ||
    type === 'House-2Story'
  ) {
    return { category: 'houses', cost: maintenanceCosts['House-Blue'] };
  }
  if (type.includes('Farm')) {
    return { category: 'farms', cost: maintenanceCosts.Farm };
  }
  if (type.includes('Market')) {
    return { category: 'markets', cost: maintenanceCosts.Market };
  }
  return { category: null, cost: 0 };
}

/**
 * Snapshot for ProcessTurnBudget — counts + per-category cost breakdown.
 *
 * @param {string[]} buildingTypes
 * @param {typeof DEFAULT_MAINTENANCE_COSTS} [maintenanceCosts]
 */
export function buildTurnBudgetMaintenanceSnapshot(
  buildingTypes,
  maintenanceCosts = DEFAULT_MAINTENANCE_COSTS
) {
  const buildingCounts = {
    houses: 0,
    farms: 0,
    markets: 0,
    roads: 0,
    total: 0,
  };

  const maintenanceBreakdown = {
    roads: { count: 0, cost: 0 },
    houses: { count: 0, cost: 0 },
    farms: { count: 0, cost: 0 },
    markets: { count: 0, cost: 0 },
  };

  for (const type of buildingTypes) {
    if (!type) continue;

    const { category, cost } = classifyMaintenanceBuilding(type, maintenanceCosts);
    if (!category) continue;

    buildingCounts[category]++;
    buildingCounts.total++;
    maintenanceBreakdown[category].count++;
    maintenanceBreakdown[category].cost += cost;
  }

  return { buildingCounts, maintenanceBreakdown };
}

/**
 * @param {Array<{ type?: string }>} houses
 * @param {typeof DEFAULT_MAINTENANCE_COSTS} [maintenanceCosts]
 */
export function accumulateBuildingMaintenanceBreakdown(
  houses,
  maintenanceCosts = DEFAULT_MAINTENANCE_COSTS
) {
  const maintenanceBreakdown = {
    houses: 0,
    farms: 0,
    markets: 0,
    roads: 0,
    infrastructure: 0,
    industry: 0,
    total: 0,
  };

  for (const house of houses) {
    if (!house.type) {
      continue;
    }

    const type = house.type;
    let cost = 2;

    if (type.includes('roads')) {
      cost = maintenanceCosts.roads;
      maintenanceBreakdown.roads += cost;
    } else if (
      type === 'House-Blue' ||
      type === 'House-Red' ||
      type === 'House-Purple' ||
      type === 'House-2Story' ||
      type.includes('House')
    ) {
      cost = maintenanceCosts['House-Blue'];
      maintenanceBreakdown.houses += cost;
    } else if (type.includes('Farm')) {
      cost = maintenanceCosts.Farm;
      maintenanceBreakdown.farms += cost;
    } else if (type.includes('Market')) {
      cost = maintenanceCosts.Market;
      maintenanceBreakdown.markets += cost;
    } else if (
      type.includes('Well') ||
      type.includes('Fountain') ||
      type.includes('Streetlight')
    ) {
      cost = 2;
      maintenanceBreakdown.infrastructure += cost;
    } else if (type.includes('Windmill') || type.includes('Barn')) {
      cost = 2;
      maintenanceBreakdown.industry += cost;
    }

    maintenanceBreakdown.total += cost;
  }

  return maintenanceBreakdown;
}
