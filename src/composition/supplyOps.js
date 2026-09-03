/**
 * Composition ops — migrated from facades/supply.js (plan_use_case_wiring Barre 5).
 * Prefer sessionApi / create*Context for new call sites.
 */

import {
  createSupplyContext,
  getOrCreateSupplyContext,
} from './createSupplyContext.js';

import { DEFAULT_FOOD_DISTRIBUTION_DISTANCE } from '../contexts/supply/domain/catalogs/SupplySimulationCatalog.js';

export { createSupplyContext, getOrCreateSupplyContext };

export { isWithinMarketRange, manhattanDistance, findHousesInMarketRange } from '../contexts/supply/domain/policies/MarketRangePolicy.js';

export { DEFAULT_FOOD_DISTRIBUTION_DISTANCE };

export { toSupplySeason, toSupplyMonth } from './supplyTimeLabels.js';

/** @returns {number} */
export function getDefaultFoodDistributionDistance() {
  return DEFAULT_FOOD_DISTRIBUTION_DISTANCE;
}

/** Windmill DTOs for storage / commerce UI (stocks + export flags). */
export async function listWindmillSupplyViews() {
  return getOrCreateSupplyContext().listWindmillSupplyViews();
}

/** City map cells with Supply fields (farms, markets, houses, …). */
export async function listSupplyMapBuildings() {
  return getOrCreateSupplyContext().listSupplyMapBuildings();
}

/** Nature spawns (trees, boulders) for placement UI. */
export async function listNatureResources() {
  return getOrCreateSupplyContext().listNatureResources();
}

/** Windmills eligible for partner export (active + commercialize enabled). */
export async function listCommercializableWindmills() {
  const windmills = await listWindmillSupplyViews();
  return windmills.filter(
    (windmill) => windmill.isActive && windmill.commercializeEnabled
  );
}

/** Raw Dexie row for commerce windmill import/export metadata. */
export async function getSupplyBuildingRow(buildingId) {
  return getOrCreateSupplyContext().getSupplyBuildingRow(buildingId);
}

/** Patch supply-related row fields (stocks, lastImport, market flags, …). */
export async function updateSupplyBuildingFields(buildingId, fields) {
  return getOrCreateSupplyContext().updateSupplyBuildingFields(buildingId, fields);
}

/** All food traceability audit rows (admin panel, commerce consumption badges). */
export async function getAllFoodTraceabilityTransactions(maxAge = null) {
  return getOrCreateSupplyContext().getAllFoodTraceabilityTransactions(maxAge);
}

/** Food traceability rows for one game turn (optional month filter). */
export async function getFoodTraceabilityTransactionsForMonth(turn, month = null) {
  return getOrCreateSupplyContext().getFoodTraceabilityTransactionsForMonth(turn, month);
}
