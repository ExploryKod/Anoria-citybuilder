/**
 * Orchestration: winery/factory collect → transform → produce (one step per tick).
 */
export class RunCityFactoryProductionCycle {
  /**
   * @param {import('../../ports/FactoryBuildingRepository.js').FactoryBuildingRepository} factoryBuildingRepository
   * @param {import('./ProcessFactoryProductionStep.js').ProcessFactoryProductionStep} processFactoryProductionStep
   */
  constructor(factoryBuildingRepository, processFactoryProductionStep) {
    this.repository = factoryBuildingRepository;
    this.processFactoryProductionStep = processFactoryProductionStep;
  }

  /**
   * @param {object} params
   * @param {object} params.city
   * @param {number} [params.time=0]
   */
  async execute({ city, time = 0 }) {
    try {
      const factories = await this.repository.findFactories();
      for (const factory of factories) {
        await this.processFactoryProductionStep.execute({ factory, time });
      }
    } catch (_error) {
      // Preserve legacy silent failure
    }
  }
}
