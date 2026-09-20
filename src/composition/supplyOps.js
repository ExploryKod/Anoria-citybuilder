/**
 * Composition ops — migrated from facades/supply.js (plan_use_case_wiring Barre 5).
 * Prefer sessionApi / create*Context for new call sites.
 */

import {
  createSupplyContext,
  getOrCreateSupplyContext,
} from './createSupplyContext.js';

export { createSupplyContext, getOrCreateSupplyContext };

export { isWithinRange, manhattanDistance, findBuildingsWithRoleInRange } from '../contexts/supply/domain/policies/ResourceRangePolicy.js';

export { toSupplySeason, toSupplyMonth } from './supplyTimeLabels.js';

/** Windmill DTOs for storage / commerce UI (stocks + export flags). */
export async function listHubSupplyViews() {
  return getOrCreateSupplyContext().listHubSupplyViews();
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
  const windmills = await listHubSupplyViews();
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
export async function getAllSupplyTraceabilityTransactions(maxAge = null) {
  return getOrCreateSupplyContext().getAllSupplyTraceabilityTransactions(maxAge);
}

/** Food traceability rows for one game turn (optional month filter). */
export async function getSupplyTraceabilityTransactionsForMonth(turn, month = null) {
  return getOrCreateSupplyContext().getSupplyTraceabilityTransactionsForMonth(turn, month);
}
