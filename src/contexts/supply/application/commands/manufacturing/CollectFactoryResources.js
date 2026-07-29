import { FACTORY_RESOURCE_TYPES } from '../../../domain/manufacturing/ProductRecipeCatalog.js';
import { effectiveFactoryStorage } from '../../../domain/manufacturing/FactoryTransformPolicy.js';

/**
 * Command: collect raw materials from nature items into a factory.
 */
export class CollectFactoryResources {
  /**
   * @param {import('../../ports/FactoryBuildingRepository.js').FactoryBuildingRepository} factoryBuildingRepository
   * @param {import('../../../infrastructure/presentation/SupplyProductionJournal.js').SupplyProductionJournal} productionJournal
   */
  constructor(factoryBuildingRepository, productionJournal) {
    this.repository = factoryBuildingRepository;
    this.productionJournal = productionJournal;
  }

  /**
   * @param {object} params
   * @param {string} params.factoryId
   * @param {number} params.time
   */
  async execute({ factoryId, time }) {
    const factoryData = await this.repository.findById(factoryId);
    if (!factoryData) return { collected: false };

    const currentRawMaterials = factoryData.rawMaterials || {};
    const productWorkerDistribution = factoryData.productWorkerDistribution || {};
    const productProductionPercentages = factoryData.productProductionPercentages || {};

    const newRawMaterials = { ...currentRawMaterials };
    let collected = false;
    const natureItems = await this.repository.listNatureItems();

    for (const resourceType of FACTORY_RESOURCE_TYPES) {
      const allocatedWorkers = productWorkerDistribution[resourceType] || 0;
      if (allocatedWorkers === 0) {
        if (currentRawMaterials[resourceType] > 0) {
          newRawMaterials[resourceType] = 0;
          collected = true;
        }
        continue;
      }

      const remainingCapacity = effectiveFactoryStorage({
        allocatedWorkers,
        currentStock: currentRawMaterials[resourceType] || 0,
        storageType: resourceType,
        productionPercentage: productProductionPercentages[resourceType],
      });

      if (remainingCapacity <= 0) continue;
      if (resourceType === 'clay') continue;

      let totalCollected = 0;

      for (const natureItem of natureItems) {
        if (totalCollected >= remainingCapacity) break;

        const freshNatureItem = await this.repository.findById(natureItem.name);
        if (!freshNatureItem) continue;

        const stocks = freshNatureItem.stocks || {};
        const available = stocks[resourceType] || 0;
        if (available <= 0) continue;

        const type = freshNatureItem.type || '';
        const fromTree = resourceType === 'wood' && type.includes('Tree');
        const fromBoulder =
          (resourceType === 'rock' ||
            resourceType === 'iron' ||
            resourceType === 'gold') &&
          type.includes('Boulder');

        if (!fromTree && !fromBoulder) continue;

        const toCollect = Math.min(available, remainingCapacity - totalCollected, 1);
        if (toCollect <= 0) continue;

        const newStocks = {
          ...stocks,
          [resourceType]: Math.max(0, available - toCollect),
        };

        await this.repository.updateFields(freshNatureItem.name, { stocks: newStocks });
        natureItem.stocks = newStocks;
        totalCollected += toCollect;
      }

      if (totalCollected > 0) {
        newRawMaterials[resourceType] =
          (newRawMaterials[resourceType] || 0) + totalCollected;
        collected = true;
      }
    }

    if (!collected) return { collected: false };

    await this.repository.updateFields(factoryId, { rawMaterials: newRawMaterials });

    const woodCollected =
      (newRawMaterials.wood || 0) - (currentRawMaterials.wood || 0);
    if (woodCollected > 0) {
      await this.#journalWoodCollect(factoryId, time, woodCollected);
    }

    return { collected: true };
  }

  async #journalWoodCollect(factoryId, time, woodCollected) {
    const factoryDataAfterUpdate = await this.repository.findById(factoryId);
    if (!factoryDataAfterUpdate) return;

    try {
      await this.productionJournal.addProductionEntry(
        time,
        this.repository.instanceId(factoryDataAfterUpdate),
        'collect_wood',
        'wood',
        woodCollected,
        {
          wood: factoryDataAfterUpdate.rawMaterials?.wood || 0,
          logs: factoryDataAfterUpdate.logs || 0,
          furniture: factoryDataAfterUpdate.products?.furniture || 0,
        }
      );
    } catch (error) {
      console.error(
        '[CollectFactoryResources] Error adding production entry (collect_wood):',
        error
      );
    }
  }
}
