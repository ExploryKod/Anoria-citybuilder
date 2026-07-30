import { synchronizeFactoryWorkerDistribution } from './synchronizeFactoryWorkerDistribution.js';

/**
 * Thin ECS adapter — monthly worker redistribution via Employment BC.
 * Runs after housing.evolution so labor pools reflect latest pop/type.
 */
export function createEmploymentRedistributeSystem({
  employment,
  getSectorPriorities,
}) {
  return async function employmentRedistribute(_world, context = {}) {
    await employment.distributeCityWorkers({
      sectorPriorities: getSectorPriorities(),
    });
    await synchronizeFactoryWorkerDistribution();
  };
}
