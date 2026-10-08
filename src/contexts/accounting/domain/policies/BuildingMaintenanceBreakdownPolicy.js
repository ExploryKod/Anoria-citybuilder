import { isRoadType, primaryRoadType } from '../../../../shared/building-catalog/roadQueries.js';
import { buildingCatalog } from '../../../../shared/building-catalog/buildingCatalog.js';
import { getResourceRoles } from '../../../../shared/building-catalog/resourceRoleQueries.js';
import {
  BUILDING_KIND_FARM,
  BUILDING_KIND_HOUSE,
  BUILDING_KIND_MARKET,
  normalizeResidentialTypeLabel,
  resolveBuildingKind,
} from '../../../../shared/building-identity/index.js';

/**
 * Maintenance costs. A house, a hub or a resourceRole-less workplace (the bank) costs what its own catalog entry
 * declares (`accounting.maintenance` — see `houseMaintenanceCost`/`isIndustrialWorkplace` below); `Farm` and
 * `Market` are category-level defaults (no single building type owns them), so they stay declared locally.
 *
 * `roads` is the road tool's fact: every placed road (whichever variant) is
 * recognised as a road by roadQueries.js, whatever its runtime marker.
 */
const DEFAULT_MAINTENANCE_COSTS = Object.freeze({
  roads: buildingCatalog[primaryRoadType()].accounting.maintenance,
  Farm: 2,
  Market: 2,
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
 * A hub (a goods warehouse, the trade warehouse, the windmill) or a resourceRole-less workplace (the bank) falls
 * into none of the categories above: its upkeep is its own catalog fact, same discipline as a house's
 * (`houseMaintenanceCost`) — this used to fall through to a silent 0 instead (Warehouse, TradeWarehouse and
 * Windmill-001 all paid no upkeep at all, unnoticed until the bank needed the same fact).
 * @param {string} type
 * @returns {boolean}
 */
function isIndustrialWorkplace(type) {
  const roles = getResourceRoles(type);
  if (roles.some((entry) => entry.role === 'hub')) return true;
  return roles.length === 0 && Boolean(buildingCatalog[type]?.employment);
}

/**
 * @param {string} type
 * @param {typeof DEFAULT_MAINTENANCE_COSTS} maintenanceCosts
 * @returns {{ category: 'roads'|'houses'|'farms'|'markets'|'industry'|null, cost: number }}
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
  if (isIndustrialWorkplace(type)) {
    const cost = buildingCatalog[type]?.accounting?.maintenance;
    if (!Number.isFinite(cost)) {
      throw new Error(`[BuildingMaintenanceBreakdownPolicy] "${type}" declares no accounting.maintenance`);
    }
    return { category: 'industry', cost };
  }
  return { category: null, cost: 0 };
}

/**
 * What one building costs to maintain in a month, as the maintenance costs declare it (0 for a building not maintained).
 * @param {string} type
 * @returns {number}
 */
export function buildingMaintenanceCost(type) {
  return classifyMaintenanceBuilding(type, DEFAULT_MAINTENANCE_COSTS).cost;
}
