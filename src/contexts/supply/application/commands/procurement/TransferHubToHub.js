import { remainingHubCapacity } from '../../../domain/policies/HubCapacityPolicy.js';
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
  getHubLinkForRole,
} from '../../../domain/policies/ResourceRolePolicy.js';

/**
 * Command: a target hub restocks from its linked source hub's allocation
 * bucket (monthly market-from-windmill restock today; resource-agnostic
 * otherwise). WHAT/WHEN come from the target's own 'distributor' role in
 * the catalog; hub-link storage field names come from each side's own
 * `hubLink` catalog fact (target's 'distributor' role, source's 'hub' role)
 * — see ResourceRolePolicy.getHubLinkForRole. This command never names a
 * resource or a link field itself.
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
   * @returns {Promise<{
   *   transferred: boolean,
   *   reason?: string,
   *   transfers: Array<{ sourceId: string, category: string, amount: number }>,
   *   totalUnits: number,
   * }>}
   */
  async execute({ targetId, period }) {
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

    const targetHubLink = getHubLinkForRole(target.type, 'distributor');
    const sourceId = targetHubLink ? target[targetHubLink.sourceLinkField] : undefined;
    if (!sourceId) {
      return { transferred: false, reason: 'no_source_link', transfers: [], totalUnits: 0 };
    }

    const source = await this.supplyBuildingRepository.findById(sourceId);
    if (!source) {
      return { transferred: false, reason: 'source_not_found', transfers: [], totalUnits: 0 };
    }

    const sourceHubLink = getHubLinkForRole(source.type, 'hub');

    if (
      !isOperational({
        roadCount: source.roadCount,
        worker: source.worker,
        workerNeed: source.workerNeed,
      })
    ) {
      return { transferred: false, reason: 'source_not_operational', transfers: [], totalUnits: 0 };
    }

    const links = [...(source[sourceHubLink.linksField] ?? [])];
    const linkIndex = links.findIndex((entry) => entry[sourceHubLink.linkTargetIdField] === targetId);
    if (linkIndex < 0) {
      return { transferred: false, reason: 'target_not_linked', transfers: [], totalUnits: 0 };
    }

    const categories = getCategoriesForRole(target.type, 'distributor');
    const totalKey = getTotalKeyForRole(target.type, 'distributor');

    let targetCapacity = remainingHubCapacity(target.stocks[totalKey], target.maxStock);
    if (targetCapacity <= 0) {
      return { transferred: false, reason: 'target_full', transfers: [], totalUnits: 0 };
    }

    const allocation = links[linkIndex];
    const transfers = [];
    let sourceStock = createResourceStock(source.stocks, categories, totalKey);
    let targetStock = createResourceStock(target.stocks, categories, totalKey);
    const nextAllocated = {};
    for (const category of categories) {
      nextAllocated[category] = Math.max(0, Math.floor(allocation[sourceHubLink.allocationField]?.[category] ?? 0));
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

    links[linkIndex] = { ...allocation, [sourceHubLink.allocationField]: nextAllocated };

    await this.supplyBuildingRepository.saveStocks(sourceId, sourceStock);
    await this.supplyBuildingRepository.saveHubLinkedDistributors(sourceId, links);
    await this.supplyBuildingRepository.saveStocks(targetId, targetStock);

    const totalUnits = transfers.reduce((sum, transfer) => sum + transfer.amount, 0);
    return { transferred: true, transfers, totalUnits };
  }
}
