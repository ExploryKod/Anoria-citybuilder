import { DexieEmploymentBuildingRepository } from '../contexts/employment/infrastructure/dexie/DexieEmploymentBuildingRepository.js';
import { DistributeCityWorkers } from '../contexts/employment/application/commands/DistributeCityWorkers.js';
import { GetCityEmploymentSummary } from '../contexts/employment/application/queries/GetCityEmploymentSummary.js';
import { LocalStorageSectorPriorityRepository } from '../contexts/employment/infrastructure/browser/LocalStorageSectorPriorityRepository.js';
import {
  getStoredOrDefaultPriorities,
  mergeAllSectorPriorities,
  resolveSectorPriorityValue,
  swapSectorPriority,
} from '../contexts/employment/domain/policies/SectorPriorityPolicy.js';
import { getEmploymentSectorName } from '../contexts/employment/domain/catalogs/EmploymentSectorCatalog.js';

/**
 * Composition root — Employment bounded context.
 *
 * @param {object} [deps]
 * @param {import('../contexts/employment/application/ports/EmploymentBuildingRepository.js').EmploymentBuildingRepository} [deps.employmentBuildingRepository]
 * @param {(house: { type?: string, level?: number }, skillKey: string) => boolean} [deps.citizenProvidesSkill]
 */
export function createEmploymentContext({ employmentBuildingRepository, citizenProvidesSkill } = {}) {
  const employmentBuildingRepositoryImpl =
    employmentBuildingRepository ?? new DexieEmploymentBuildingRepository();
  const sectorPriorityRepository =
    new LocalStorageSectorPriorityRepository();
  const distributeCityWorkersCommand = new DistributeCityWorkers(
    employmentBuildingRepositoryImpl,
    { citizenProvidesSkill },
  );
  const getCityEmploymentSummaryQuery = new GetCityEmploymentSummary(
    employmentBuildingRepositoryImpl
  );

  return {
    employmentBuildingRepository: employmentBuildingRepositoryImpl,
    sectorPriorityRepository,
    distributeCityWorkersCommand,
    getCityEmploymentSummaryQuery,

    ensureSectorPrioritiesInitialized() {
      sectorPriorityRepository.ensureInitialized();
    },

    getSectorPriority(sector) {
      const userPriorities = sectorPriorityRepository.loadUserPriorities();
      return resolveSectorPriorityValue(sector, userPriorities);
    },

    getAllSectorPriorities() {
      const userPriorities = sectorPriorityRepository.loadUserPriorities();
      return getStoredOrDefaultPriorities(userPriorities);
    },

    getMergedSectorPriorities() {
      const userPriorities = sectorPriorityRepository.loadUserPriorities();
      return mergeAllSectorPriorities(userPriorities);
    },

    updateSectorPrioritySync(sector, newPriority) {
      const userPriorities = sectorPriorityRepository.loadUserPriorities();
      const updated = swapSectorPriority(sector, newPriority, userPriorities);
      sectorPriorityRepository.saveUserPriorities(updated);
    },

    getSectorName(sector) {
      return getEmploymentSectorName(sector);
    },

    /**
     * @param {{ sectorPriorities?: Record<number|string, number> }} [params]
     */
    async distributeCityWorkers(params = {}) {
      return distributeCityWorkersCommand.execute(params);
    },

    /** @returns {Promise<import('../contexts/employment/domain/computeCityEmploymentSummary.js').ReturnType<typeof import('../contexts/employment/domain/computeCityEmploymentSummary.js').computeCityEmploymentSummary>>} */
    async getCityEmploymentSummary() {
      return getCityEmploymentSummaryQuery.execute();
    },
  };
}

/** @type {ReturnType<typeof createEmploymentContext> | null} */
let sharedEmployment = null;

/**
 * @param {object} [deps]
 * @param {(house: { type?: string, level?: number }, skillKey: string) => boolean} [deps.citizenProvidesSkill]
 */
export function getOrCreateEmploymentContext(deps = {}) {
  if (!sharedEmployment) {
    sharedEmployment = createEmploymentContext(deps);
  }
  return sharedEmployment;
}

/** @internal Tests only */
export function resetEmploymentContextForTests() {
  sharedEmployment = null;
}
