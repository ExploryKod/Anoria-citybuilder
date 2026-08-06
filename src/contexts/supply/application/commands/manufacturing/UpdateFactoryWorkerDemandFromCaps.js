import {
  computeFactoryTotalWorkerNeed,
} from '../../../domain/manufacturing/FactoryProductWorkerDistributionPolicy.js';

/**
 * Publishes factory worker demand (employees.worker_need) from player line caps.
 * Runs before Employment redistribution so sector priorities see updated needs.
 */
export class UpdateFactoryWorkerDemandFromCaps {
  /**
   * @param {import('../../ports/FactoryBuildingRepository.js').FactoryBuildingRepository} factoryBuildingRepository
   */
  constructor(factoryBuildingRepository) {
    this.repository = factoryBuildingRepository;
  }

  async execute() {
    const factories = await this.repository.findFactories();
    let updated = 0;

    for (const factory of factories) {
      const workerNeed = computeFactoryTotalWorkerNeed(factory);
      const employees = factory.employees || { worker: 0, worker_need: 0 };

      if (employees.worker_need === workerNeed) {
        continue;
      }

      await this.repository.updateFields(this.repository.instanceId(factory), {
        employees: {
          ...employees,
          worker_need: workerNeed,
        },
      });
      updated += 1;
    }

    return { updated, factories: factories.length };
  }
}
