/**
 * HUD population read models — country-wide vs scoped hamlet.
 * Composition-only: reads Dexie directly, reuses domain policies.
 */

import db from '../core/persistence/dexie/db.js';
import { createEmptyStocks } from '../shared/building-catalog/resourceRoleQueries.js';
import { hamletIdOf, getActiveHamletId } from '../core/persistence/hamlet/hamletSession.js';
import { sumShortfallCauses } from '../contexts/employment/domain/policies/EmploymentShortfallPolicy.js';
import { computeCityFamishedPopulation, computeCityHungerRisk } from '../contexts/housing/domain/policies/FamishedPopulationPolicy.js';
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
 * What a labour cell of the HUD says: the unemployment (a percentage) and the vacant posts (a count), both when both exist. They are not
 * exclusive: citizens out of work and posts left empty at the same time is a mismatch of skills, which the player must see, so showing only the
 * vacancies hid the unemployed.
 *
 * @param {{ lack?: number, unemployed?: number, unemploymentPercentage?: number }} [stats]
 * @returns {{ mode: 'lack' | 'unemployment' | 'both', display: string, count: number, unemployed: number, lack: number }}
 */
export function laborSlotFromStats(stats = {}) {
  const lack = Math.max(0, Math.floor(stats.lack) || 0);
  const unemployed = Math.max(0, Math.floor(stats.unemployed) || 0);
  const pct = Math.max(0, Math.floor(stats.unemploymentPercentage) || 0);
  if (lack > 0 && unemployed > 0) {
    return { mode: 'both', display: `${pct}% · ${lack}`, count: lack, unemployed, lack };
  }
  if (lack > 0) {
    return { mode: 'lack', display: String(lack), count: lack, unemployed, lack };
  }
  return { mode: 'unemployment', display: `${pct}%`, count: unemployed, unemployed, lack };
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
    supplyShortfall: row.supplyShortfall ?? null,
    stocks: row.stocks || createEmptyStocks(),
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
    workerSources: employees.workerSources ?? {},
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
 *   disettePopulation: number,
 *   penuriePopulation: number,
 *   hungerRisk: { disette: number, penurie: number },
 *   employment: ReturnType<typeof computeCityEmploymentSummary>,
 * }>}
 */
export async function getHudPopulationScopeSnapshot(scope = 'active') {
  const rows = (await db.houses.toArray()).filter((row) => rowMatchesScope(row, scope));

  const residential = rows
    .filter((row) => isResidentialHouseType(normalizeResidentialType(row.type || '')))
    .map(toHousingSnapshot);

  const totalPop = residential.reduce((sum, house) => sum + (house.pop || 0), 0);
  const { famishedPopulation, disettePopulation, penuriePopulation } = computeCityFamishedPopulation(residential);
  const hungerRisk = computeCityHungerRisk(residential);
  const employment = computeCityEmploymentSummary(rows.map(toEmploymentSnapshot));

  // Why people are out of work and posts empty is worked out hamlet by hamlet (workers do not commute): the country is the sum of its hamlets.
  let employmentCauses = employment.causes;
  if (scope === 'country') {
    const rowsByHamlet = new Map();
    for (const row of rows) {
      const hamletId = hamletIdOf(row);
      rowsByHamlet.set(hamletId, [...(rowsByHamlet.get(hamletId) ?? []), row]);
    }
    employmentCauses = sumShortfallCauses(
      [...rowsByHamlet.values()].map((hamletRows) => computeCityEmploymentSummary(hamletRows.map(toEmploymentSnapshot)).causes)
    );
  }

  return {
    totalPop,
    popByGroup: popByGroupFromHouses(residential),
    famishedPopulation,
    disettePopulation,
    penuriePopulation,
    hungerRisk,
    employment,
    employmentCauses,
  };
}
