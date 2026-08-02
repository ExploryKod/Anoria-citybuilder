import { FACTORY_TO_BARN_TRANSFERS } from '../../../domain/catalogs/BarnCommerceCatalog.js';
import { isCommerceFactory } from '../../../domain/manufacturing/FactorySupplyFlowPolicy.js';
import { isOperationalCommerceBarn } from '../../../domain/policies/BarnStockPolicy.js';
import { instanceIdFromHouseRow } from '../../../../../shared/building-identity/index.js';

/**
 * Monthly transfer: commerce factory stocks → Barn-001 commerce hub.
 */
export class TransferFactoryToBarn {
  /**
   * @param {import('../../ports/FactoryBuildingRepository.js').FactoryBuildingRepository} factoryBuildingRepository
   * @param {import('../../../infrastructure/dexie/DexieSupplyBuildingRepository.js').DexieSupplyBuildingRepository} supplyBuildingRepository
   * @param {import('../services/BarnStockOperations.js').BarnStockOperations} barnStockOperations
   */
  constructor(factoryBuildingRepository, supplyBuildingRepository, barnStockOperations) {
    this.factoryRepository = factoryBuildingRepository;
    this.supplyRepository = supplyBuildingRepository;
    this.barnStock = barnStockOperations;
  }

  /**
   * @param {object} [_params]
   * @param {number} [_params.time]
   */
  async execute(_params = {}) {
    const barns = (await this.supplyRepository.findCommerceBarnRows()).filter(
      isOperationalCommerceBarn
    );
    if (barns.length === 0) {
      return { transferred: [], reason: 'no_operational_barn' };
    }

    const targetBarnId = instanceIdFromHouseRow(barns[0]);
    const factories = await this.factoryRepository.findFactories();
    const transfers = [];

    for (const factory of factories) {
      if (!isCommerceFactory(factory)) continue;
      if (factory.isActive === false) continue;
      if ((factory.roads ?? 0) <= 0) continue;

      const factoryId = instanceIdFromHouseRow(factory);
      let factoryUpdates = null;

      for (const line of FACTORY_TO_BARN_TRANSFERS) {
        const container =
          line.factoryField === 'products'
            ? factory.products || {}
            : factory.rawMaterials || {};
        const available = container[line.factoryKey] || 0;
        if (available <= 0) continue;

        const moved = await this.barnStock.creditBarn(
          targetBarnId,
          line.productId,
          available
        );
        if (moved <= 0) continue;

        if (!factoryUpdates) {
          factoryUpdates = {
            rawMaterials: { ...(factory.rawMaterials || {}) },
            products: { ...(factory.products || {}) },
          };
        }

        if (line.factoryField === 'products') {
          factoryUpdates.products[line.factoryKey] = Math.max(
            0,
            (factoryUpdates.products[line.factoryKey] || 0) - moved
          );
        } else {
          factoryUpdates.rawMaterials[line.factoryKey] = Math.max(
            0,
            (factoryUpdates.rawMaterials[line.factoryKey] || 0) - moved
          );
        }

        transfers.push({
          factoryId,
          barnId: targetBarnId,
          productId: line.productId,
          quantity: moved,
        });
      }

      if (factoryUpdates) {
        await this.factoryRepository.updateFields(factoryId, factoryUpdates);
      }
    }

    return { transferred: transfers, reason: transfers.length ? 'ok' : 'nothing_to_transfer' };
  }
}
