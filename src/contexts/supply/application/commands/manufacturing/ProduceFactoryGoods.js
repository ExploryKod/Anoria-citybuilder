import { listFinishedFactoryCommodities, getFactoryCommodity } from '../../../domain/manufacturing/ProductRecipeCatalog.js';
import {
  factoryMaxStorage,
  canProduceFromRecipe,
} from '../../../domain/manufacturing/FactoryStoragePolicy.js';
import { canFactoryProduceProduct } from '../../../domain/manufacturing/FactorySupplyFlowPolicy.js';
import { isFactoryCommodityProductionEnabled } from '../../../domain/manufacturing/FactoryCommodityProductionPolicy.js';

/**
 * Command: produce finished goods from refined materials at a factory.
 */
export class ProduceFactoryGoods {
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
   * @param {number|null} [params.lastTransformTurn=null]
   */
  async execute({ factoryId, time, lastTransformTurn = null }) {
    const factoryData = await this.repository.findById(factoryId);
    if (!factoryData) return;

    const rawMaterials = factoryData.rawMaterials || {};
    const products = factoryData.products || {};
    const productWorkerDistribution = factoryData.productWorkerDistribution || {};
    const productProductionPercentages = factoryData.productProductionPercentages || {};

    const logs = factoryData.logs || 0;
    const refinedGold = factoryData.refinedGold || 0;
    const refinedClay = factoryData.refinedClay || 0;
    const refinedIron = factoryData.refinedIron || 0;
    const currentProducts = { ...products };

    const availableMaterials = {
      ...rawMaterials,
      logs,
      refinedGold,
      refinedClay,
      refinedIron,
    };

    for (const commodity of listFinishedFactoryCommodities()) {
      const productType = commodity.id;
      const recipe = commodity.recipe;
      if (!recipe) continue;

      if (!canFactoryProduceProduct(factoryData, productType)) {
        continue;
      }
      if (!isFactoryCommodityProductionEnabled(factoryData, productType)) {
        continue;
      }

      const allocatedWorkers = productWorkerDistribution[productType] || 0;
      if (allocatedWorkers === 0) {
        if (currentProducts[productType] && currentProducts[productType] > 0) {
          currentProducts[productType] = 0;
          await this.repository.updateFields(factoryId, { products: currentProducts });
        }
        continue;
      }

      const productionTurns = commodity.productionTurns ?? 1;
      let turnsSinceProduction;

      if (
        lastTransformTurn !== null &&
        commodity.hasTransformation
      ) {
        turnsSinceProduction = time - lastTransformTurn;
      } else {
        const lastProductionTurnForProduct =
          factoryData[`lastProductionTurn_${productType}`] || 0;
        turnsSinceProduction = time - lastProductionTurnForProduct;
      }

      if (turnsSinceProduction < productionTurns) continue;

      const maxWorkersPerProduct = 2;
      let productionPercentage = productProductionPercentages[productType];
      if (productionPercentage === undefined) {
        productionPercentage = Math.floor(
          (allocatedWorkers / maxWorkersPerProduct) * 100
        );
      }

      const baseMaxStorage = factoryMaxStorage(productType);
      const effectiveMaxStorage = Math.floor(
        baseMaxStorage * (productionPercentage / 100)
      );
      const currentStock = currentProducts[productType] || 0;
      const remainingCapacity = Math.max(0, effectiveMaxStorage - currentStock);

      if (remainingCapacity <= 0) continue;
      if (!canProduceFromRecipe(recipe, availableMaterials)) continue;

      const quantityToProduce = this.#computeQuantityToProduce({
        productType,
        recipe,
        logs,
        refinedGold,
        refinedClay,
        refinedIron,
        remainingCapacity,
      });

      if (quantityToProduce <= 0) continue;

      const consumption = this.#consumeMaterials({
        recipe,
        quantityToProduce,
        rawMaterials,
        logs,
        refinedGold,
        refinedClay,
        refinedIron,
      });

      currentProducts[productType] =
        (currentProducts[productType] || 0) + quantityToProduce;

      await this.repository.updateFields(factoryId, {
        products: currentProducts,
        rawMaterials: consumption.rawMaterials,
        logs: consumption.logs,
        refinedGold: consumption.refinedGold,
        refinedClay: consumption.refinedClay,
        refinedIron: consumption.refinedIron,
        [`lastProductionTurn_${productType}`]: time,
      });

      if (
        getFactoryCommodity(productType)?.hasTransformation &&
        quantityToProduce > 0
      ) {
        await this.#journalProduction({
          factoryId,
          productType,
          time,
          quantityToProduce,
          lastTransformTurn,
          consumption,
        });
      }
    }
  }

  #computeQuantityToProduce({
    productType,
    recipe,
    logs,
    refinedGold,
    refinedClay,
    refinedIron,
    remainingCapacity,
  }) {
    if (productType === 'furniture') {
      const logsNeededPerUnit = recipe.logs || 4;
      return Math.min(Math.floor(logs / logsNeededPerUnit), remainingCapacity);
    }
    if (productType === 'jewelry') {
      const refinedGoldNeededPerUnit = recipe.refinedGold || 4;
      return Math.min(
        Math.floor(refinedGold / refinedGoldNeededPerUnit),
        remainingCapacity
      );
    }
    if (productType === 'pottery') {
      const refinedClayNeededPerUnit = recipe.refinedClay || 4;
      return Math.min(
        Math.floor(refinedClay / refinedClayNeededPerUnit),
        remainingCapacity
      );
    }
    if (productType === 'weapons') {
      const refinedIronNeededPerUnit = recipe.refinedIron || 4;
      return Math.min(
        Math.floor(refinedIron / refinedIronNeededPerUnit),
        remainingCapacity
      );
    }
    return Math.min(1, remainingCapacity);
  }

  #consumeMaterials({
    recipe,
    quantityToProduce,
    rawMaterials,
    logs,
    refinedGold,
    refinedClay,
    refinedIron,
  }) {
    const newRawMaterials = { ...rawMaterials };
    let newLogs = logs;
    let newRefinedGold = refinedGold;
    let newRefinedClay = refinedClay;
    let newRefinedIron = refinedIron;

    const consumed = {
      logsConsumed: 0,
      refinedGoldConsumed: 0,
      refinedClayConsumed: 0,
      refinedIronConsumed: 0,
    };

    for (const [material, amount] of Object.entries(recipe)) {
      const totalAmount = amount * quantityToProduce;
      if (material === 'logs') {
        consumed.logsConsumed = totalAmount;
        newLogs = Math.max(0, newLogs - totalAmount);
      } else if (material === 'refinedGold') {
        consumed.refinedGoldConsumed = totalAmount;
        newRefinedGold = Math.max(0, newRefinedGold - totalAmount);
      } else if (material === 'refinedClay') {
        consumed.refinedClayConsumed = totalAmount;
        newRefinedClay = Math.max(0, newRefinedClay - totalAmount);
      } else if (material === 'refinedIron') {
        consumed.refinedIronConsumed = totalAmount;
        newRefinedIron = Math.max(0, newRefinedIron - totalAmount);
      } else {
        newRawMaterials[material] = Math.max(
          0,
          (newRawMaterials[material] || 0) - totalAmount
        );
      }
    }

    return {
      rawMaterials: newRawMaterials,
      logs: newLogs,
      refinedGold: newRefinedGold,
      refinedClay: newRefinedClay,
      refinedIron: newRefinedIron,
      ...consumed,
    };
  }

  async #journalProduction({
    factoryId,
    productType,
    time,
    quantityToProduce,
    lastTransformTurn,
    consumption,
  }) {
    const factoryDataAfterUpdate = await this.repository.findById(factoryId);
    if (!factoryDataAfterUpdate) return;

    const remainingStocks = {
      wood: factoryDataAfterUpdate.rawMaterials?.wood || 0,
      logs: factoryDataAfterUpdate.logs || 0,
      furniture: factoryDataAfterUpdate.products?.furniture || 0,
      gold: factoryDataAfterUpdate.rawMaterials?.gold || 0,
      refinedGold: factoryDataAfterUpdate.refinedGold || 0,
      jewelry: factoryDataAfterUpdate.products?.jewelry || 0,
      clay: factoryDataAfterUpdate.rawMaterials?.clay || 0,
      refinedClay: factoryDataAfterUpdate.refinedClay || 0,
      pottery: factoryDataAfterUpdate.products?.pottery || 0,
      iron: factoryDataAfterUpdate.rawMaterials?.iron || 0,
      refinedIron: factoryDataAfterUpdate.refinedIron || 0,
      weapons: factoryDataAfterUpdate.products?.weapons || 0,
    };

    const eventByProduct = {
      furniture: 'produce_furniture',
      jewelry: 'produce_jewelry',
      pottery: 'produce_pottery',
      weapons: 'produce_weapons',
    };

    const materialPriceByProduct = {
      furniture: () =>
        this.productionJournal.getPrice('logs') * consumption.logsConsumed,
      jewelry: () =>
        this.productionJournal.getPrice('refinedGold') *
        consumption.refinedGoldConsumed,
      pottery: () =>
        this.productionJournal.getPrice('refinedClay') *
        consumption.refinedClayConsumed,
      weapons: () =>
        this.productionJournal.getPrice('refinedIron') *
        consumption.refinedIronConsumed,
    };

    const materialConsumedByProduct = {
      furniture: consumption.logsConsumed,
      jewelry: consumption.refinedGoldConsumed,
      pottery: consumption.refinedClayConsumed,
      weapons: consumption.refinedIronConsumed,
    };

    try {
      const materialPrice = materialPriceByProduct[productType]?.() ?? 0;
      const productPrice =
        this.productionJournal.getPrice(productType) * quantityToProduce;
      const totalPrice = materialPrice + productPrice;

      let productionTurns = null;
      if (lastTransformTurn !== null && lastTransformTurn !== undefined) {
        const productionTurnsCount = getFactoryCommodity(productType)?.productionTurns ?? 1;
        productionTurns = [];
        for (let i = 1; i <= productionTurnsCount; i++) {
          productionTurns.push(lastTransformTurn + i);
        }
      }

      await this.productionJournal.addProductionEntry(
        time,
        this.repository.instanceId(factoryDataAfterUpdate),
        eventByProduct[productType],
        productType,
        quantityToProduce,
        remainingStocks,
        materialConsumedByProduct[productType],
        totalPrice,
        productionTurns
      );
    } catch (error) {
      console.error(
        `[ProduceFactoryGoods] Error adding production entry (${productType}):`,
        error
      );
    }
  }
}
