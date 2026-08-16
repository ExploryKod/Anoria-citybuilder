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
import {
  allSocialGroups,
  eligibleSectorsForGroup,
  residentialGroupForType,
} from '../contexts/employment/domain/catalogs/HouseGroupSectorEligibilityPolicy.js';

/**
 * Lack replaces unemployment in the HUD on the same scope: they cannot both
 * be the visible problem. A group may still have unemployment while another
 * has lack.
 *
 * @param {{ lack?: number, unemployed?: number, unemploymentPercentage?: number }} [stats]
 * @returns {{ mode: 'lack' | 'unemployment', display: string, count: number }}
 */
export function laborSlotFromStats(stats = {}) {
  const lack = Math.max(0, Math.floor(stats.lack) || 0);
  if (lack > 0) {
    return { mode: 'lack', display: String(lack), count: lack };
  }
  const unemployed = Math.max(0, Math.floor(stats.unemployed) || 0);
  const pct = Math.max(0, Math.floor(stats.unemploymentPercentage) || 0);
  return { mode: 'unemployment', display: `${pct}%`, count: unemployed };
}

/**
 * @param {ReadonlyArray<{ type?: string, pop?: number }>} houses
 * @returns {Record<string, number>}
 */
export function popByGroupFromHouses(houses) {
  /** @type {Record<string, number>} */
  const mapped = {};
  for (const group of allSocialGroups()) {
    mapped[group] = 0;
  }
  for (const house of houses) {
    const group = residentialGroupForType(house.type || '');
    if (!group || mapped[group] == null) continue;
    mapped[group] += house.pop || 0;
  }
  return mapped;
}

/**
 * @param {Record<string, { workerPool?: number, assigned?: number, unemployed?: number }> | undefined} byGroup
 * @param {Record<number, { need?: number }> | undefined} [bySector]
 * @returns {Record<string, { workerPool: number, assigned: number, unemployed: number, unemploymentPercentage: number, lack: number }>}
 */
export function mapEmploymentGroupsForHud(byGroup, bySector) {
  /** @type {Record<string, { workerPool: number, assigned: number, unemployed: number, unemploymentPercentage: number, lack: number }>} */
  const mapped = {};

  for (const group of allSocialGroups()) {
    const stats = byGroup?.[group] ?? { workerPool: 0, assigned: 0, unemployed: 0 };
    const workerPool = Math.max(0, Math.floor(stats.workerPool) || 0);
    const assigned = Math.max(0, Math.floor(stats.assigned) || 0);
    const unemployed = Math.max(0, Math.floor(stats.unemployed) || 0);
    let lack = 0;
    for (const sector of eligibleSectorsForGroup(group)) {
      lack += Math.max(0, Math.floor(bySector?.[sector]?.need) || 0);
    }

    mapped[group] = {
      workerPool,
      assigned,
      unemployed,
      unemploymentPercentage: workerPool > 0 ? Math.round((unemployed / workerPool) * 100) : 0,
      lack,
    };
  }

  return mapped;
}

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
 *   popByGroup: Record<string, number>,
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
    popByGroup: popByGroupFromHouses(residential),
    famishedPopulation,
    employment,
  };
}
