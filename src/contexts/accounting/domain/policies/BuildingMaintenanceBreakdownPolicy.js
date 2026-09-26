import { isRoadType, primaryRoadType } from '../../../../shared/building-catalog/roadQueries.js';
import { buildingCatalog } from '../../../../shared/building-catalog/buildingCatalog.js';
import {
  BUILDING_KIND_FARM,
  BUILDING_KIND_HOUSE,
  BUILDING_KIND_MARKET,
  BUILDING_KIND_WINDMILL,
  normalizeResidentialTypeLabel,
  resolveBuildingKind,
} from '../../../../shared/building-identity/index.js';

/**
 * Maintenance costs. A house costs what its own catalog entry declares (`accounting.maintenance`); `Farm`, `Market`
 * and the windmill's industry line are category-level defaults (no single building type owns them), so they stay
 * declared locally.
 *
 * `roads` is the road tool's fact: every placed road (whichever variant) is
 * recognised as a road by roadQueries.js, whatever its runtime marker.
 */
const DEFAULT_MAINTENANCE_COSTS = Object.freeze({
  roads: buildingCatalog[primaryRoadType()].accounting.maintenance,
  Farm: 2,
  Market: 2,
  Industry: 2,
});

export { DEFAULT_MAINTENANCE_COSTS };

/**
 * What a house of this type costs to maintain, as its catalog entry declares.
 * @param {string} type
 * @returns {number}
 */
export function houseMaintenanceCost(type) {
  const houseType = normalizeResidentialTypeLabel(type);
  const cost = buildingCatalog[houseType]?.accounting?.maintenance;
  if (!Number.isFinite(cost)) {
    throw new Error(`[BuildingMaintenanceBreakdownPolicy] house type "${houseType}" declares no accounting.maintenance`);
  }
  return cost;
}

/**
 * @param {string} type
 * @param {typeof DEFAULT_MAINTENANCE_COSTS} maintenanceCosts
 * @returns {{ category: 'roads'|'houses'|'farms'|'markets'|null, cost: number }}
 */
function classifyMaintenanceBuilding(type, maintenanceCosts) {
  if (isRoadType(type)) {
    return { category: 'roads', cost: maintenanceCosts.roads };
  }
  const kind = resolveBuildingKind(type);
  if (kind === BUILDING_KIND_HOUSE) {
    return { category: 'houses', cost: houseMaintenanceCost(type) };
  }
  if (kind === BUILDING_KIND_FARM) {
    return { category: 'farms', cost: maintenanceCosts.Farm };
  }
  if (kind === BUILDING_KIND_MARKET) {
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
    const kind = resolveBuildingKind(type);

    if (isRoadType(type)) {
      cost = maintenanceCosts.roads;
      maintenanceBreakdown.roads += cost;
    } else if (kind === BUILDING_KIND_HOUSE) {
      cost = houseMaintenanceCost(type);
      maintenanceBreakdown.houses += cost;
    } else if (kind === BUILDING_KIND_FARM) {
      cost = maintenanceCosts.Farm;
      maintenanceBreakdown.farms += cost;
    } else if (kind === BUILDING_KIND_MARKET) {
      cost = maintenanceCosts.Market;
      maintenanceBreakdown.markets += cost;
    } else if (kind === BUILDING_KIND_WINDMILL) {
      cost = maintenanceCosts.Industry;
      maintenanceBreakdown.industry += cost;
    }

    maintenanceBreakdown.total += cost;
  }

  return maintenanceBreakdown;
}
