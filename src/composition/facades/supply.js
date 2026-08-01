/**
 * ACL Supply — only entry from legacy `src/js/` into the Supply BC.
 *
 * Do not import `contexts/supply/domain/**` from UI or SimServices.
 */

import {
  createSupplyContext,
  getOrCreateSupplyContext,
} from '../createSupplyContext.js';

import { DEFAULT_FOOD_DISTRIBUTION_DISTANCE } from '../../contexts/supply/domain/catalogs/SupplySimulationCatalog.js';

export { createSupplyContext, getOrCreateSupplyContext };

export { isWithinMarketRange, manhattanDistance, findHousesInMarketRange } from '../../contexts/supply/domain/policies/MarketRangePolicy.js';

export {
  getFactoryMaxStorage,
  getFactoryWorkerNeed,
  getFactoryEmployeeRoleType,
  FACTORY_MAX_STORAGE,
  FACTORY_EMPLOYEE_NEEDS,
} from '../../contexts/supply/domain/manufacturing/ProductRecipeCatalog.js';

export { DEFAULT_FOOD_DISTRIBUTION_DISTANCE };

export { toSupplySeason, toSupplyMonth } from '../supplyTimeLabels.js';

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

/** Factory rows (Winery-001) for factory-section UI. */
export async function listCityFactories() {
  return getOrCreateSupplyContext().listCityFactories();
}

/** Nature spawns (trees, boulders) for factory-section UI. */
export async function listNatureResources() {
  return getOrCreateSupplyContext().listNatureResources();
}

/** Full factory row for admin UI edits. */
export async function getFactoryById(factoryId) {
  return getOrCreateSupplyContext().getFactoryById(factoryId);
}

/** Patch factory row fields (settings, worker distribution). */
export async function updateFactoryFields(factoryId, fields) {
  return getOrCreateSupplyContext().updateFactoryFields(factoryId, fields);
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

/** Production journal entries (factory-section UI). */
export async function listProductionJournalEntries(factoryId = null, turn = null) {
  return getOrCreateSupplyContext().listProductionJournalEntries(factoryId, turn);
}

/** Production journal entries for one factory. */
export async function getFactoryProductionJournalEntries(factoryId) {
  return getOrCreateSupplyContext().getFactoryProductionJournalEntries(factoryId);
}

/** All food traceability audit rows (admin panel, commerce consumption badges). */
export async function getAllFoodTraceabilityTransactions(maxAge = null) {
  return getOrCreateSupplyContext().getAllFoodTraceabilityTransactions(maxAge);
}

/** Food traceability rows for one game turn (optional month filter). */
export async function getFoodTraceabilityTransactionsForMonth(turn, month = null) {
  return getOrCreateSupplyContext().getFoodTraceabilityTransactionsForMonth(turn, month);
}
