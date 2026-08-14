/**
 * HUD population read models — country-wide vs scoped hamlet.
 * Composition-only: reads Dexie directly, reuses domain policies.
 */

import db from '../core/persistence/dexie/db.js';
import { hamletIdOf, getActiveHamletId } from '../core/persistence/hamlet/hamletSession.js';
import { computeCityFamishedPopulation } from '../contexts/housing/domain/policies/FamishedPopulationPolicy.js';
import { computeCityEmploymentSummary } from '../contexts/employment/domain/computeCityEmploymentSummary.js';
import { createHousingBuildingSnapshot } from '../contexts/housing/domain/HousingBuildingSnapshot.js';
import { createEmploymentBuildingSnapshot } from '../contexts/employment/domain/EmploymentBuildingSnapshot.js';
import { isResidentialHouseType } from '../contexts/housing/domain/policies/HouseCapacityPolicy.js';
import { normalizeResidentialType } from '../contexts/housing/domain/HouseTypeCatalog.js';
import { instanceIdFromHouseRow } from '../shared/building-identity/index.js';

/**
 * @param {object} row
 * @returns {import('../contexts/housing/domain/HousingBuildingSnapshot.js').HousingBuildingSnapshot}
 */
function toHousingSnapshot(row) {
  return createHousingBuildingSnapshot({
    id: instanceIdFromHouseRow(row),
    type: row.type || '',
    x: row.x ?? null,
    y: row.y ?? null,
    roadCount: row.roads ?? 0,
    pop: row.pop ?? 0,
    level: row.level ?? 1,
    lastPopulationGrowthMonth: row.lastPopulationGrowthMonth ?? null,
    lastFamineDeathMonth: row.lastFamineDeathMonth ?? null,
    lastConsumption: row.lastConsumption ?? null,
    stocks: row.stocks || { food: 0, wheat: 0, carrot: 0, cabbage: 0 },
    price: row.price ?? 0,
    neighbors: row.neighbors || [],
  });
}

/**
 * @param {object} row
 * @returns {import('../contexts/employment/domain/EmploymentBuildingSnapshot.js').EmploymentBuildingSnapshot}
 */
function toEmploymentSnapshot(row) {
  const employees = row.employees || {};
  return createEmploymentBuildingSnapshot({
    id: instanceIdFromHouseRow(row),
    type: row.type || '',
    x: row.x ?? null,
    y: row.y ?? null,
    roadCount: row.roads ?? 0,
    pop: row.pop ?? 0,
    level: row.level ?? 1,
    worker: employees.worker ?? 0,
    workerNeed: employees.worker_need ?? 0,
    sector: employees.sector ?? 0,
  });
}

/**
 * @param {object} row
 * @param {'country' | 'active' | string} scope
 */
function rowMatchesScope(row, scope) {
  if (scope === 'country') return true;
  const hamletId = scope === 'active' ? getActiveHamletId() : scope;
  return hamletIdOf(row) === hamletId;
}

/**
 * @param {'country' | 'active' | string} [scope='active']
 * @returns {Promise<{
 *   totalPop: number,
 *   famishedPopulation: number,
 *   employment: ReturnType<typeof computeCityEmploymentSummary>,
 * }>}
 */
export async function getHudPopulationScopeSnapshot(scope = 'active') {
  const rows = (await db.houses.toArray()).filter((row) => rowMatchesScope(row, scope));

  const residential = rows
    .filter((row) => isResidentialHouseType(normalizeResidentialType(row.type || '')))
    .map(toHousingSnapshot);

  const totalPop = residential.reduce((sum, house) => sum + (house.pop || 0), 0);
  const { famishedPopulation } = computeCityFamishedPopulation(residential);
  const employment = computeCityEmploymentSummary(rows.map(toEmploymentSnapshot));

  return {
    totalPop,
    famishedPopulation,
    employment,
  };
}
