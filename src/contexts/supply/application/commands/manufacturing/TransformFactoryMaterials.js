import { computeTransformAmount } from '../../../domain/manufacturing/FactoryTransformPolicy.js';

const TRANSFORM_STEPS = [
  {
    workerKey: 'wood',
    previousStockKey: 'previousWoodStock',
    rawMaterialKey: 'wood',
    outputField: 'logs',
    storageType: 'logs',
    journalEvent: 'transform_wood_to_logs',
    journalProduct: 'logs',
    remainingStocks: (factory) => ({
      wood: factory.rawMaterials?.wood || 0,
      logs: factory.logs || 0,
      furniture: factory.products?.furniture || 0,
    }),
    extraUpdateFields: (amount, time) => ({
      lastTransformationMessage: `Les bûcherons ont transformé ${amount} bois en bûches`,
      lastTransformationTurn: time,
      lastTransformationAmount: amount,
    }),
  },
  {
    workerKey: 'gold',
    previousStockKey: 'previousGoldStock',
    rawMaterialKey: 'gold',
    outputField: 'refinedGold',
    storageType: 'refinedGold',
    journalEvent: 'transform_gold_to_refined_gold',
    journalProduct: 'refinedGold',
    remainingStocks: (factory) => ({
      gold: factory.rawMaterials?.gold || 0,
      refinedGold: factory.refinedGold || 0,
      jewelry: factory.products?.jewelry || 0,
    }),
  },
  {
    workerKey: 'clay',
    previousStockKey: 'previousClayStock',
    rawMaterialKey: 'clay',
    outputField: 'refinedClay',
    storageType: 'refinedClay',
    journalEvent: 'transform_clay_to_refined_clay',
    journalProduct: 'refinedClay',
    remainingStocks: (factory) => ({
      clay: factory.rawMaterials?.clay || 0,
      refinedClay: factory.refinedClay || 0,
      pottery: factory.products?.pottery || 0,
    }),
  },
  {
    workerKey: 'iron',
    previousStockKey: 'previousIronStock',
    rawMaterialKey: 'iron',
    outputField: 'refinedIron',
    storageType: 'refinedIron',
    journalEvent: 'transform_iron_to_refined_iron',
    journalProduct: 'refinedIron',
    remainingStocks: (factory) => ({
      iron: factory.rawMaterials?.iron || 0,
      refinedIron: factory.refinedIron || 0,
      weapons: factory.products?.weapons || 0,
    }),
  },
];

/**
 * Command: transform raw materials into refined intermediate goods (logs, refinedGold, …).
 */
export class TransformFactoryMaterials {
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
    for (const step of TRANSFORM_STEPS) {
      await this.#runTransform(factoryId, time, step);
    }
  }

  /**
   * @param {string} factoryId
   * @param {number} time
   * @param {typeof TRANSFORM_STEPS[number]} step
   */
  async #runTransform(factoryId, time, step) {
    const factoryData = await this.repository.findById(factoryId);
    if (!factoryData) return;

    const productWorkerDistribution = factoryData.productWorkerDistribution || {};
    const allocatedWorkers = productWorkerDistribution[step.workerKey] || 0;
    if (allocatedWorkers <= 0) return;

    const previousStock = factoryData[step.previousStockKey] || 0;
    if (previousStock <= 0) return;

    const rawMaterials = factoryData.rawMaterials || {};
    const currentOutputStock = factoryData[step.outputField] || 0;
    const currentRawStock = rawMaterials[step.rawMaterialKey] || 0;

    const amountToTransform = computeTransformAmount({
      allocatedWorkers,
      previousStock,
      currentRawStock,
      currentOutputStock,
      storageType: step.storageType,
    });

    if (amountToTransform <= 0) return;

    const newOutput = currentOutputStock + amountToTransform;
    const newRawMaterials = {
      ...rawMaterials,
      [step.rawMaterialKey]: Math.max(
        0,
        (rawMaterials[step.rawMaterialKey] || 0) - amountToTransform
      ),
    };

    const updateFields = {
      [step.outputField]: newOutput,
      rawMaterials: newRawMaterials,
      ...(step.extraUpdateFields?.(amountToTransform, time) ?? {}),
    };

    await this.repository.updateFields(factoryId, updateFields);

    const factoryDataAfterUpdate = await this.repository.findById(factoryId);
    if (!factoryDataAfterUpdate) return;

    try {
      await this.productionJournal.addProductionEntry(
        time,
        this.repository.publishedId(factoryData),
        step.journalEvent,
        step.journalProduct,
        amountToTransform,
        step.remainingStocks(factoryDataAfterUpdate)
      );
    } catch (error) {
      console.error(
        `[TransformFactoryMaterials] Error adding production entry (${step.journalEvent}):`,
        error
      );
    }
  }
}
