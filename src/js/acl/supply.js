/**
 * ACL Supply — only entry from legacy `src/js/` into the Supply BC.
 *
 * Do not import `contexts/supply/domain/**` from UI or SimServices.
 */

import {
  createSupplyContext,
  getOrCreateSupplyContext,
} from '../../composition/createSupplyContext.js';

export { createSupplyContext, getOrCreateSupplyContext };

export { isWithinMarketRange, manhattanDistance, findHousesInMarketRange } from '../../contexts/supply/domain/policies/MarketRangePolicy.js';

/** Map TimeManager French season labels → Supply English seasons. */
const LEGACY_SEASON_TO_SUPPLY = Object.freeze({
  Printemps: 'spring',
  Été: 'summer',
  Automne: 'autumn',
  Hiver: 'winter',
});

/** Map TimeManager French month labels → Supply English months. */
const LEGACY_MONTH_TO_SUPPLY = Object.freeze({
  Janvier: 'january',
  Février: 'february',
  Mars: 'march',
  Avril: 'april',
  Mai: 'may',
  Juin: 'june',
  Juillet: 'july',
  Août: 'august',
  Septembre: 'september',
  Octobre: 'october',
  Novembre: 'november',
  Décembre: 'december',
});

/**
 * @param {string | null | undefined} legacySeason
 * @returns {'spring' | 'summer' | 'autumn' | 'winter' | null}
 */
export function toSupplySeason(legacySeason) {
  if (!legacySeason || typeof legacySeason !== 'string') return null;
  return LEGACY_SEASON_TO_SUPPLY[legacySeason] ?? null;
}

/**
 * @param {string | null | undefined} legacyMonth
 * @returns {'january' | 'february' | 'march' | 'april' | 'may' | 'june' | 'july' | 'august' | 'september' | 'october' | 'november' | 'december' | null}
 */
export function toSupplyMonth(legacyMonth) {
  if (!legacyMonth || typeof legacyMonth !== 'string') return null;
  return LEGACY_MONTH_TO_SUPPLY[legacyMonth] ?? null;
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
