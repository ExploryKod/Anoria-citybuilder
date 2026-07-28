import { DexieEmploymentBuildingRepository } from '../infrastructure/persistence/dexie/DexieEmploymentBuildingRepository.js';
import { DistributeCityWorkers } from '../contexts/employment/application/commands/DistributeCityWorkers.js';

/**
 * Composition root — Employment bounded context.
 *
 * @param {object} deps
 * @param {import('../js/stores/HousesStore.js').default} deps.housesStore
 */
export function createEmploymentContext({ housesStore }) {
  const employmentBuildingRepository = new DexieEmploymentBuildingRepository(
    housesStore
  );
  const distributeCityWorkersCommand = new DistributeCityWorkers(
    employmentBuildingRepository
  );

  return {
    employmentBuildingRepository,
    distributeCityWorkersCommand,

    /**
     * @param {{ sectorPriorities?: Record<number|string, number> }} [params]
     */
    async distributeCityWorkers(params = {}) {
      return distributeCityWorkersCommand.execute(params);
    },
  };
}

/** @type {ReturnType<typeof createEmploymentContext> | null} */
let sharedEmployment = null;
/** @type {object | null} */
let sharedHousesStore = null;

export function getOrCreateEmploymentContext(housesStore) {
  if (!sharedEmployment || sharedHousesStore !== housesStore) {
    sharedEmployment = createEmploymentContext({ housesStore });
    sharedHousesStore = housesStore;
  }
  return sharedEmployment;
}

/** @internal Tests only */
export function resetEmploymentContextForTests() {
  sharedEmployment = null;
  sharedHousesStore = null;
}
