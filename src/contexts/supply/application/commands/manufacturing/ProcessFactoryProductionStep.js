import {
  shouldRunCollectStep,
  shouldRunTransformStep,
  shouldRunProduceStep,
} from '../../../domain/manufacturing/FactoryStepPolicy.js';

/**
 * Command: run one collect → transform → produce step for a single factory.
 */
export class ProcessFactoryProductionStep {
  /**
   * @param {import('../../ports/FactoryBuildingRepository.js').FactoryBuildingRepository} factoryBuildingRepository
   * @param {import('./CollectFactoryResources.js').CollectFactoryResources} collectFactoryResources
   * @param {import('./TransformFactoryMaterials.js').TransformFactoryMaterials} transformFactoryMaterials
   * @param {import('./ProduceFactoryGoods.js').ProduceFactoryGoods} produceFactoryGoods
   */
  constructor(
    factoryBuildingRepository,
    collectFactoryResources,
    transformFactoryMaterials,
    produceFactoryGoods
  ) {
    this.repository = factoryBuildingRepository;
    this.collectFactoryResources = collectFactoryResources;
    this.transformFactoryMaterials = transformFactoryMaterials;
    this.produceFactoryGoods = produceFactoryGoods;
  }

  /**
   * @param {object} params
   * @param {object} params.factory - factory row from repository
   * @param {number} params.time
   */
  async execute({ factory, time }) {
    const factoryId = factory.id || factory.name;
    const factoryData = await this.repository.findById(factoryId);
    if (!factoryData) return;

    if ((factoryData.roads ?? 0) <= 0) return;
    if (factoryData.isActive === false) return;

    const lastCollectTurn = factoryData.lastCollectTurn ?? -1;
    const lastTransformTurn = factoryData.lastTransformTurn ?? -1;
    const lastProductionTurn = factoryData.lastProductionTurn ?? -1;

    const updates = {};
    let stepExecuted = false;

    if (
      shouldRunCollectStep({
        time,
        lastCollectTurn,
        lastProductionTurn,
        lastTransformTurn,
      })
    ) {
      await this.collectFactoryResources.execute({ factoryId, time });

      const factoryDataAfterCollect = await this.repository.findById(factoryId);
      const rawMaterialsAfterCollect = factoryDataAfterCollect?.rawMaterials || {};
      updates.previousWoodStock = rawMaterialsAfterCollect.wood || 0;
      updates.previousGoldStock = rawMaterialsAfterCollect.gold || 0;
      updates.previousClayStock = rawMaterialsAfterCollect.clay || 0;
      updates.previousIronStock = rawMaterialsAfterCollect.iron || 0;
      updates.lastCollectTurn = time;
      stepExecuted = true;
    }

    if (
      shouldRunTransformStep({
        time,
        lastCollectTurn,
        lastTransformTurn,
        stepExecuted,
      })
    ) {
      await this.transformFactoryMaterials.execute({ factoryId, time });
      updates.lastTransformTurn = time;
      stepExecuted = true;
    }

    if (
      shouldRunProduceStep({
        time,
        lastTransformTurn,
        lastProductionTurn,
        stepExecuted,
      })
    ) {
      await this.produceFactoryGoods.execute({
        factoryId,
        time,
        lastTransformTurn,
      });
      updates.lastProductionTurn = time;
      stepExecuted = true;
    }

    updates.lastProcessTurn = time;
    if (Object.keys(updates).length > 0) {
      await this.repository.updateFields(factoryId, updates);
    }
  }
}
