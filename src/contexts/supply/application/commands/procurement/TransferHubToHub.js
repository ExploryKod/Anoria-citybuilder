import { remainingMarketCapacity } from '../../../domain/policies/MarketCapacityPolicy.js';
import { isOperational } from '../../../domain/policies/OperationalGatePolicy.js';
import {
  createResourceStock,
  getCategoryAmount,
  takeCategoryAmount,
  addCategoryAmount,
} from '../../../domain/value-objects/ResourceStock.js';
import { matchesSchedule } from '../../../domain/policies/ResourceSchedulePolicy.js';
import {
  getCategoriesForRole,
  getScheduleForRole,
  getTotalKeyForRole,
} from '../../../domain/policies/ResourceRolePolicy.js';

/**
 * Command: a target hub restocks from its linked source hub's allocation
 * bucket (monthly market-from-windmill restock today; resource-agnostic
 * otherwise). WHAT/WHEN come from the target's own 'distributor' role in
 * the catalog; `bookkeeping` only carries the hub-link field names, which
 * still vary by caller (see FoodCircuits.js) since the link storage itself
 * isn't generalized across resources yet.
 */
export class TransferHubToHub {
  /**
   * @param {import('../../ports/SupplyBuildingRepository.js').SupplyBuildingRepository} supplyBuildingRepository
   */
  constructor(supplyBuildingRepository) {
    this.supplyBuildingRepository = supplyBuildingRepository;
  }

  /**
   * @param {object} params
   * @param {string} params.targetId
   * @param {object} params.period
   * @param {object} params.bookkeeping - { sourceLinkField, linksField, linkTargetIdField, allocationField, saveLinks(repo, sourceId, links) }
   * @returns {Promise<{
   *   transferred: boolean,
   *   reason?: string,
   *   transfers: Array<{ sourceId: string, category: string, amount: number }>,
   *   totalUnits: number,
   * }>}
   */
  async execute({ targetId, period, bookkeeping }) {
    const target = await this.supplyBuildingRepository.findById(targetId);
    if (!target) {
      return { transferred: false, reason: 'target_not_found', transfers: [], totalUnits: 0 };
    }

    const schedule = getScheduleForRole(target.type, 'distributor');
    if (!matchesSchedule(schedule, period)) {
      return { transferred: false, reason: 'not_transfer_period', transfers: [], totalUnits: 0 };
    }

    if (
      !isOperational({
        roadCount: target.roadCount,
        worker: target.worker,
        workerNeed: target.workerNeed,
      })
    ) {
      return { transferred: false, reason: 'target_not_operational', transfers: [], totalUnits: 0 };
    }

    const sourceId = target[bookkeeping.sourceLinkField];
    if (!sourceId) {
      return { transferred: false, reason: 'no_source_link', transfers: [], totalUnits: 0 };
    }

    const source = await this.supplyBuildingRepository.findById(sourceId);
    if (!source) {
      return { transferred: false, reason: 'source_not_found', transfers: [], totalUnits: 0 };
    }

    if (
      !isOperational({
        roadCount: source.roadCount,
        worker: source.worker,
        workerNeed: source.workerNeed,
      })
    ) {
      return { transferred: false, reason: 'source_not_operational', transfers: [], totalUnits: 0 };
    }

    const links = [...(source[bookkeeping.linksField] ?? [])];
    const linkIndex = links.findIndex((entry) => entry[bookkeeping.linkTargetIdField] === targetId);
    if (linkIndex < 0) {
      return { transferred: false, reason: 'target_not_linked', transfers: [], totalUnits: 0 };
    }

    const categories = getCategoriesForRole(target.type, 'distributor');
    const totalKey = getTotalKeyForRole(target.type, 'distributor');

    let targetCapacity = remainingMarketCapacity(target.stocks[totalKey], target.maxStock);
    if (targetCapacity <= 0) {
      return { transferred: false, reason: 'target_full', transfers: [], totalUnits: 0 };
    }

    const allocation = links[linkIndex];
    const transfers = [];
    let sourceStock = createResourceStock(source.stocks, categories, totalKey);
    let targetStock = createResourceStock(target.stocks, categories, totalKey);
    const nextAllocated = {};
    for (const category of categories) {
      nextAllocated[category] = Math.max(0, Math.floor(allocation[bookkeeping.allocationField]?.[category] ?? 0));
    }

    for (const category of categories) {
      if (targetCapacity <= 0) break;

      const allocated = nextAllocated[category];
      const availableOnSource = getCategoryAmount(sourceStock, category);
      const amount = Math.min(allocated, availableOnSource, targetCapacity);
      if (amount <= 0) continue;

      sourceStock = takeCategoryAmount(sourceStock, category, amount, categories, totalKey);
      targetStock = addCategoryAmount(targetStock, category, amount, categories, totalKey);
      nextAllocated[category] = allocated - amount;
      targetCapacity -= amount;
      transfers.push({ sourceId, category, amount });
    }

    if (transfers.length === 0) {
      return { transferred: false, reason: 'nothing_to_transfer', transfers: [], totalUnits: 0 };
    }

    links[linkIndex] = { ...allocation, [bookkeeping.allocationField]: nextAllocated };

    await this.supplyBuildingRepository.saveStocks(sourceId, sourceStock);
    await bookkeeping.saveLinks(this.supplyBuildingRepository, sourceId, links);
    await this.supplyBuildingRepository.saveStocks(targetId, targetStock);

    const totalUnits = transfers.reduce((sum, transfer) => sum + transfer.amount, 0);
    return { transferred: true, transfers, totalUnits };
  }
}
