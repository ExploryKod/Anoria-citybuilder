import { remainingMarketCapacity } from '../../../domain/policies/MarketCapacityPolicy.js';
import { isOperational } from '../../../domain/policies/OperationalGatePolicy.js';
import {
  createResourceStock,
  getCategoryAmount,
  takeCategoryAmount,
  addCategoryAmount,
} from '../../../domain/value-objects/ResourceStock.js';
import { resolveInstanceIdFromNeighborRef } from '../../../../../shared/building-identity/BuildingRecord.js';

/**
 * Command: a hub building collects resource units from a list of source
 * building refs, up to its own remaining capacity (December-only windmill
 * collection today; resource-agnostic otherwise via the `circuit` descriptor).
 */
export class CollectResourceToHub {
  /**
   * @param {import('../../ports/SupplyBuildingRepository.js').SupplyBuildingRepository} supplyBuildingRepository
   */
  constructor(supplyBuildingRepository) {
    this.supplyBuildingRepository = supplyBuildingRepository;
  }

  /**
   * @param {object} params
   * @param {string} params.hubId
   * @param {object[]} params.sourceRefs
   * @param {object} params.period
   * @param {object} params.circuit
   * @returns {Promise<{
   *   collected: boolean,
   *   reason?: string,
   *   transfers: Array<{ sourceId: string, category: string, amount: number }>,
   *   totalUnits: number,
   * }>}
   */
  async execute({ hubId, sourceRefs = [], period, circuit }) {
    if (!circuit.canCollect(period)) {
      return { collected: false, reason: 'not_collection_period', transfers: [], totalUnits: 0 };
    }

    const hub = await this.supplyBuildingRepository.findById(hubId);
    if (!hub) {
      return { collected: false, reason: 'hub_not_found', transfers: [], totalUnits: 0 };
    }

    if (
      !isOperational({
        roadCount: hub.roadCount,
        worker: hub.worker,
        workerNeed: hub.workerNeed,
      })
    ) {
      return { collected: false, reason: 'hub_not_operational', transfers: [], totalUnits: 0 };
    }

    let capacity = remainingMarketCapacity(hub.stocks[circuit.totalKey], hub.maxStock);
    if (capacity <= 0) {
      return { collected: false, reason: 'hub_full', transfers: [], totalUnits: 0 };
    }

    const transfers = [];

    for (const ref of sourceRefs) {
      if (capacity <= 0) break;

      const sourceId = resolveInstanceIdFromNeighborRef(ref);
      if (!sourceId) continue;

      const source = await this.supplyBuildingRepository.findById(sourceId);
      if (!source) continue;

      if (source.roadCount <= 0) continue;

      const category = circuit.resourceCategoryForBuilding(source.type);
      if (!category) continue;

      const available = getCategoryAmount(source.stocks, category);
      const amount = Math.min(available, capacity);
      if (amount <= 0) continue;

      const nextSourceStock = takeCategoryAmount(source.stocks, category, amount, circuit.categories, circuit.totalKey);
      await this.supplyBuildingRepository.saveStocks(sourceId, nextSourceStock);

      capacity -= amount;
      transfers.push({ sourceId, category, amount });
    }

    if (transfers.length === 0) {
      return { collected: false, reason: 'nothing_to_collect', transfers: [], totalUnits: 0 };
    }

    const freshHub = await this.supplyBuildingRepository.findById(hubId);
    let merged = createResourceStock(freshHub?.stocks ?? hub.stocks, circuit.categories, circuit.totalKey);
    for (const transfer of transfers) {
      merged = addCategoryAmount(merged, transfer.category, transfer.amount, circuit.categories, circuit.totalKey);
    }
    const cappedTotal = Math.min(freshHub?.maxStock ?? hub.maxStock, merged[circuit.totalKey]);
    const finalStock = createResourceStock(
      { ...merged, [circuit.totalKey]: cappedTotal },
      circuit.categories,
      circuit.totalKey,
    );
    await this.supplyBuildingRepository.saveStocks(hubId, finalStock);

    const totalUnits = transfers.reduce((sum, transfer) => sum + transfer.amount, 0);
    return { collected: true, transfers, totalUnits };
  }
}
