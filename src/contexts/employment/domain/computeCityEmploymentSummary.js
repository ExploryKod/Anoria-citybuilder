import {
  hasRoadAccess,
  isEligibleWorkplace,
  isLaborSource,
} from './policies/BuildingRolePolicy.js';
import {
  elitePopFromHouse,
  workerPopFromHouse,
} from './policies/LaborPoolPolicy.js';
import { computePopulationBreakdown } from '../../../shared/population/computePopulationBreakdown.js';

/**
 * Pure read model: city-wide employment summary from building snapshots.
 *
 * @param {ReadonlyArray<import('./EmploymentBuildingSnapshot.js').EmploymentBuildingSnapshot>} buildings
 * @returns {{
 *   workerPool: number,
 *   elitePool: number,
 *   totalPopulation: number,
 *   civilServantCount: number,
 *   laborPool: number,
 *   activeCitizenCount: number,
 *   activePopulationCount: number,
 *   totalAssigned: number,
 *   totalNeed: number,
 *   unemployed: number,
 *   unemploymentPercentage: number,
 *   lack: number,
 *   understaffedBuildingIds: ReadonlyArray<string>,
 *   bySector: Readonly<Record<number, { workerNeed: number, workers: number, need: number }>>,
 * }}
 */
export function computeCityEmploymentSummary(buildings) {
  let workerPool = 0;
  let elitePool = 0;
  let totalAssigned = 0;
  let totalNeed = 0;
  let lack = 0;
  /** @type {string[]} */
  const understaffedBuildingIds = [];
  /** @type {Record<number, { workerNeed: number, workers: number, need: number }>} */
  const bySector = {};

  for (const building of buildings) {
    if (isLaborSource(building) && hasRoadAccess(building)) {
      workerPool += workerPopFromHouse(building.type, building.pop);
      elitePool += elitePopFromHouse(building.type, building.pop);
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
  }

  const population = computePopulationBreakdown({
    workerPool,
    elitePool,
    totalAssigned,
  });

  return Object.freeze({
    workerPool,
    elitePool,
    totalPopulation: population.totalPopulation,
    civilServantCount: population.civilServantCount,
    laborPool: population.laborPool,
    activeCitizenCount: population.activeCitizenCount,
    activePopulationCount: population.activePopulationCount,
    totalAssigned,
    totalNeed,
    unemployed: population.unemployed,
    unemploymentPercentage: population.unemploymentPercentage,
    lack,
    understaffedBuildingIds: Object.freeze([...understaffedBuildingIds]),
    bySector: Object.freeze(bySector),
  });
}
