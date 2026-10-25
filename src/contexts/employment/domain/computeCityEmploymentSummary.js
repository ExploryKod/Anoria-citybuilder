import {
  hasRoadAccess,
  isEligibleWorkplace,
  isLaborSource,
} from './policies/BuildingRolePolicy.js';
import {
  workerPopFromHouse,
} from './policies/LaborPoolPolicy.js';
import { computeHouseholdEmploymentStatus } from '../../../shared/population/computePopulationBreakdown.js';
import {
  allSocialGroups,
  eligibleSectorsForGroup,
  residentialGroupForType,
} from './catalogs/HouseGroupSectorEligibilityPolicy.js';
import { getRequiredSkillForBuilding } from './policies/WorkplaceSkillRequirementPolicy.js';
import { employmentShortfallCauses } from './policies/EmploymentShortfallPolicy.js';
import { residentsSeekingWork } from '../../../shared/population/workforceQueries.js';

/**
 * Pure read model: city-wide employment summary from building snapshots.
 *
 * @param {ReadonlyArray<import('./EmploymentBuildingSnapshot.js').EmploymentBuildingSnapshot>} buildings
 * @returns {{
 *   workerPool: number,
 *   totalPopulation: number,
 *   totalAssigned: number,
 *   totalNeed: number,
 *   unemployed: number,
 *   unemploymentPercentage: number,
 *   lack: number,
 *   understaffedBuildingIds: ReadonlyArray<string>,
 *   bySector: Readonly<Record<number, { workerNeed: number, workers: number, need: number }>>,
 *   bySkill: Readonly<Record<string, { workerNeed: number, workers: number, need: number }>>,
 *   byGroup: Readonly<Record<string, { workerPool: number, assigned: number, seeking: number, unemployed: number, unemployedNoRoad: number, poolByLevel: Readonly<Record<number, number>> }>>,
 * }}
 */
export function computeCityEmploymentSummary(buildings) {
  let workerPool = 0;
  let totalAssigned = 0;
  let totalNeed = 0;
  let lack = 0;
  /** @type {string[]} */
  const understaffedBuildingIds = [];
  /** @type {Record<number, { workerNeed: number, workers: number, need: number }>} */
  const bySector = {};
  /** @type {Record<string, { workerNeed: number, workers: number, need: number }>} */
  const bySkill = {};

  // Every house's workers, wherever they work — the one tally the city's unemployed count shares with a
  // household's own (HouseholdPublicPayPolicy, HouseResidentsPolicy): never a second, independent count.
  /** @type {Map<string, number>} */
  const workersByHouseId = new Map();
  for (const building of buildings) {
    for (const [houseId, count] of Object.entries(building.workerSources ?? {})) {
      workersByHouseId.set(houseId, (workersByHouseId.get(houseId) ?? 0) + count);
    }
  }

  for (const building of buildings) {
    if (isLaborSource(building) && hasRoadAccess(building)) {
      workerPool += workerPopFromHouse(building.type, building.pop, building.level);
    }

    if (!isEligibleWorkplace(building)) {
      continue;
    }

    const worker = building.worker || 0;
    const need = building.workerNeed || 0;
    const sector = building.sector || 0;

    totalAssigned += worker;
    totalNeed += need;
    lack += Math.max(0, need - worker);

    if (worker === 0 && need > 0) {
      understaffedBuildingIds.push(building.id);
    }

    if (!bySector[sector]) {
      bySector[sector] = { workerNeed: 0, workers: 0, need: 0 };
    }
    bySector[sector].workerNeed += need;
    bySector[sector].workers += worker;
    bySector[sector].need = Math.max(0, bySector[sector].workerNeed - bySector[sector].workers);

    const skillId = getRequiredSkillForBuilding(building.type);
    if (skillId) {
      if (!bySkill[skillId]) {
        bySkill[skillId] = { workerNeed: 0, workers: 0, need: 0 };
      }
      bySkill[skillId].workerNeed += need;
      bySkill[skillId].workers += worker;
      bySkill[skillId].need = Math.max(0, bySkill[skillId].workerNeed - bySkill[skillId].workers);
    }
  }

  // The city's unemployed are the sum of each house's own count — never a city-wide floor, and never
  // filtered by road access: a disconnected house's residents still count (they're just unreachable by a
  // workplace, see workerPool above).
  let totalPopulation = 0;
  let seekingWork = 0;
  let unemployed = 0;
  let unemployedNoRoad = 0;
  for (const building of buildings) {
    if (!isLaborSource(building)) continue;
    // Only the residents who look for a job can be out of work (the administrators do not, see workforceQueries.js).
    const seekingHere = residentsSeekingWork(building.type, building.pop);
    const { unemployed: unemployedHere } = computeHouseholdEmploymentStatus({
      pop: seekingHere,
      workers: workersByHouseId.get(building.id) ?? 0,
    });
    totalPopulation += building.pop;
    seekingWork += seekingHere;
    unemployed += unemployedHere;
    if (!hasRoadAccess(building)) unemployedNoRoad += unemployedHere;
  }
  // The rate of unemployment is over the residents who look for a job, not the whole population: the administrators would dilute it (the classes' own rates are over their workers).
  const unemploymentPercentage = seekingWork > 0 ? Math.round((unemployed / seekingWork) * 100) : 0;

  const byGroup = computeEmploymentByGroup(buildings, workersByHouseId);

  return Object.freeze({
    workerPool,
    totalPopulation,
    totalAssigned,
    totalNeed,
    unemployed,
    unemploymentPercentage,
    lack,
    // Why they are out of work and why posts are empty (worked out for this one hamlet's counts).
    causes: employmentShortfallCauses({ unemployed, unemployedNoRoad, lack }),
    understaffedBuildingIds: Object.freeze([...understaffedBuildingIds]),
    bySector: Object.freeze(bySector),
    bySkill: Object.freeze(bySkill),
    byGroup,
  });
}

/**
 * Per-group breakdown, additive to the global aggregate above — the global formula/semantics stay unchanged.
 * - `workerPool` / `assigned` / `poolByLevel`: the group's pool (the houses a road reaches) and the workers of the sectors open to it; `poolByLevel`
 *   splits the pool by the level of the house it comes from, a house grants a skill from its tier on. They say who could staff a post.
 * - `seeking` / `unemployed` / `unemployedNoRoad`: the group's residents who look for a job, those of them out of work and those whose house no road
 *   connects — tallied house by house exactly like the city's own (`workersByHouseId`), so the classes add up to the city and the rate has the same
 *   denominator.
 *
 * @param {ReadonlyArray<import('./EmploymentBuildingSnapshot.js').EmploymentBuildingSnapshot>} buildings
 * @param {ReadonlyMap<string, number>} workersByHouseId every house's workers, wherever they work
 * @returns {Readonly<Record<string, { workerPool: number, assigned: number, seeking: number, unemployed: number, unemployedNoRoad: number, poolByLevel: Readonly<Record<number, number>> }>>}
 */
function computeEmploymentByGroup(buildings, workersByHouseId) {
  /** @type {Record<string, { workerPool: number, assigned: number, seeking: number, unemployed: number, unemployedNoRoad: number, poolByLevel: Record<number, number> }>} */
  const byGroup = {};

  for (const group of allSocialGroups()) {
    const eligibleSectors = new Set(eligibleSectorsForGroup(group));

    let groupWorkerPool = 0;
    let groupAssigned = 0;
    let seeking = 0;
    let unemployed = 0;
    let unemployedNoRoad = 0;
    /** @type {Record<number, number>} */
    const poolByLevel = {};

    for (const building of buildings) {
      if (isLaborSource(building) && residentialGroupForType(building.type) === group) {
        const seekingHere = residentsSeekingWork(building.type, building.pop);
        const { unemployed: unemployedHere } = computeHouseholdEmploymentStatus({
          pop: seekingHere,
          workers: workersByHouseId.get(building.id) ?? 0,
        });
        seeking += seekingHere;
        unemployed += unemployedHere;
        if (!hasRoadAccess(building)) unemployedNoRoad += unemployedHere;
      }

      if (
        isLaborSource(building) &&
        hasRoadAccess(building) &&
        residentialGroupForType(building.type) === group
      ) {
        const workers = workerPopFromHouse(building.type, building.pop, building.level);
        groupWorkerPool += workers;
        poolByLevel[building.level] = (poolByLevel[building.level] ?? 0) + workers;
      }

      if (isEligibleWorkplace(building) && eligibleSectors.has(building.sector || 0)) {
        groupAssigned += building.worker || 0;
      }
    }

    byGroup[group] = {
      workerPool: groupWorkerPool,
      assigned: groupAssigned,
      seeking,
      unemployed,
      unemployedNoRoad,
      poolByLevel: Object.freeze(poolByLevel),
    };
  }

  return Object.freeze(byGroup);
}
