import { remainingHubCapacity } from '../../../domain/policies/HubCapacityPolicy.js';
import { isOperational } from '../../../domain/policies/OperationalGatePolicy.js';
import {
  createResourceStock,
  getCategoryAmount,
  takeCategoryAmount,
  addCategoryAmount,
} from '../../../domain/value-objects/ResourceStock.js';
import { resolveInstanceIdFromNeighborRef } from '../../../../../shared/building-identity/BuildingRecord.js';
import { matchesSchedule } from '../../../domain/policies/ResourceSchedulePolicy.js';
import {
  getCategoriesForRole,
  getRangeForRole,
  getScheduleForRole,
  getTotalKeyForRole,
} from '../../../domain/policies/ResourceRolePolicy.js';
import { isWithinRange } from '../../../domain/policies/ResourceRangePolicy.js';
import { isRoadNeedMet } from '../../../../../shared/building-catalog/resourceRoleQueries.js';

/**
 * Command: a hub building collects resource units from a list of source
 * building refs, up to its own remaining capacity (December-only windmill
 * collection today; resource-agnostic otherwise). WHAT/WHEN come from the
 * hub's own 'collector' role; each source's own 'producer' role says which
 * single category it contributes.
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
   * @returns {Promise<{
   *   collected: boolean,
   *   reason?: string,
   *   transfers: Array<{ sourceId: string, category: string, amount: number }>,
   *   totalUnits: number,
   * }>}
   */
  async execute({ hubId, sourceRefs = [], period }) {
    const hub = await this.supplyBuildingRepository.findById(hubId);
    if (!hub) {
      return { collected: false, reason: 'hub_not_found', transfers: [], totalUnits: 0 };
    }

    const schedule = getScheduleForRole(hub.type, 'collector');
    if (!matchesSchedule(schedule, period)) {
      return { collected: false, reason: 'not_collection_period', transfers: [], totalUnits: 0 };
    }

    if (
      !isOperational({
        type: hub.type,
        roadCount: hub.roadCount,
        worker: hub.worker,
        workerNeed: hub.workerNeed,
      })
    ) {
      return { collected: false, reason: 'hub_not_operational', transfers: [], totalUnits: 0 };
    }

    const categories = getCategoriesForRole(hub.type, 'collector');
    const totalKey = getTotalKeyForRole(hub.type, 'collector');
    // A collector that declares a `range` only collects from sources within it; none means city-wide.
    const range = getRangeForRole(hub.type, 'collector') ?? Infinity;

    let capacity = remainingHubCapacity(hub.stocks[totalKey], hub.maxStock);
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

      if (!isRoadNeedMet(source.type, source.roadCount)) continue;
      if (range !== Infinity && !isWithinRange(hub, source, range)) continue;

      // Only goods this hub collects: a producer of anything else (household
      // gathering, another chain's output) is simply not this hub's business.
      const category =
        getCategoriesForRole(source.type, 'producer').find((candidate) => categories.includes(candidate)) ?? null;
      if (!category) continue;

      const available = getCategoryAmount(source.stocks, category);
      const amount = Math.min(available, capacity);
      if (amount <= 0) continue;

      const nextSourceStock = takeCategoryAmount(source.stocks, category, amount, categories, totalKey);
      await this.supplyBuildingRepository.saveStocks(sourceId, nextSourceStock);

      capacity -= amount;
      transfers.push({ sourceId, category, amount });
    }

    if (transfers.length === 0) {
      return { collected: false, reason: 'nothing_to_collect', transfers: [], totalUnits: 0 };
    }

    const freshHub = await this.supplyBuildingRepository.findById(hubId);
    let merged = createResourceStock(freshHub?.stocks ?? hub.stocks, categories, totalKey);
    for (const transfer of transfers) {
      merged = addCategoryAmount(merged, transfer.category, transfer.amount, categories, totalKey);
    }
    const cappedTotal = Math.min(freshHub?.maxStock ?? hub.maxStock, merged[totalKey]);
    const finalStock = createResourceStock(
      { ...merged, [totalKey]: cappedTotal },
      categories,
      totalKey,
    );
    await this.supplyBuildingRepository.saveStocks(hubId, finalStock);

    const totalUnits = transfers.reduce((sum, transfer) => sum + transfer.amount, 0);
    return { collected: true, transfers, totalUnits };
  }
}
