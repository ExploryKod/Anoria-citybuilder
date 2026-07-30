import { DexieEmploymentBuildingRepository } from '../contexts/employment/infrastructure/dexie/DexieEmploymentBuildingRepository.js';
import { DistributeCityWorkers } from '../contexts/employment/application/commands/DistributeCityWorkers.js';
import { GetCityEmploymentSummary } from '../contexts/employment/application/queries/GetCityEmploymentSummary.js';

/**
 * Composition root — Employment bounded context.
 *
 * @param {object} [deps]
 * @param {import('../contexts/employment/application/ports/EmploymentBuildingRepository.js').EmploymentBuildingRepository} [deps.employmentBuildingRepository]
 */
export function createEmploymentContext({ employmentBuildingRepository } = {}) {
  const employmentBuildingRepositoryImpl =
    employmentBuildingRepository ?? new DexieEmploymentBuildingRepository();
  const distributeCityWorkersCommand = new DistributeCityWorkers(
    employmentBuildingRepositoryImpl
  );
  const getCityEmploymentSummaryQuery = new GetCityEmploymentSummary(
    employmentBuildingRepositoryImpl
  );

  return {
    employmentBuildingRepository: employmentBuildingRepositoryImpl,
    distributeCityWorkersCommand,
    getCityEmploymentSummaryQuery,

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

export function getOrCreateEmploymentContext() {
  if (!sharedEmployment) {
    sharedEmployment = createEmploymentContext();
  }
  return sharedEmployment;
}

/** @internal Tests only */
export function resetEmploymentContextForTests() {
  sharedEmployment = null;
}
