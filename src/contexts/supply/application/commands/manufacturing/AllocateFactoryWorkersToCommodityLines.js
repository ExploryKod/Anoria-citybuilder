import {
  computeFactoryProductWorkerDistribution,
  computeFactoryProductProductionPercentages,
} from '../../../domain/manufacturing/FactoryProductWorkerDistributionPolicy.js';

/**
 * Splits city-assigned factory workers (employees.worker) across commodity lines by cap demand.
 * Runs after Employment redistribution.
 */
export class AllocateFactoryWorkersToCommodityLines {
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
      const distribution = computeFactoryProductWorkerDistribution(factory);
      const percentages = computeFactoryProductProductionPercentages(factory, distribution);

      await this.repository.updateFields(this.repository.instanceId(factory), {
        productWorkerDistribution: distribution,
        productProductionPercentages: percentages,
      });
      updated += 1;
    }

    return { updated, factories: factories.length };
  }
}
