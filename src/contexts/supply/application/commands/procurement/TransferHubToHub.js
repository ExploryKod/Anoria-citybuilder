import { remainingMarketCapacity } from '../../../domain/policies/MarketCapacityPolicy.js';
import { isOperational } from '../../../domain/policies/OperationalGatePolicy.js';
import {
  createResourceStock,
  getCategoryAmount,
  takeCategoryAmount,
  addCategoryAmount,
} from '../../../domain/value-objects/ResourceStock.js';

/**
 * Command: a target hub restocks from its linked source hub's allocation
 * bucket (monthly market-from-windmill restock today; resource-agnostic
 * otherwise via the `circuit` descriptor).
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
   * @param {object} params.circuit
   * @returns {Promise<{
   *   transferred: boolean,
   *   reason?: string,
   *   transfers: Array<{ sourceId: string, category: string, amount: number }>,
   *   totalUnits: number,
   * }>}
   */
  async execute({ targetId, period, circuit }) {
    if (!circuit.canTransfer(period)) {
      return { transferred: false, reason: 'not_transfer_period', transfers: [], totalUnits: 0 };
    }

    const target = await this.supplyBuildingRepository.findById(targetId);
    if (!target) {
      return { transferred: false, reason: 'target_not_found', transfers: [], totalUnits: 0 };
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

    const sourceId = target[circuit.sourceLinkField];
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

    const links = [...(source[circuit.linksField] ?? [])];
    const linkIndex = links.findIndex((entry) => entry[circuit.linkTargetIdField] === targetId);
    if (linkIndex < 0) {
      return { transferred: false, reason: 'target_not_linked', transfers: [], totalUnits: 0 };
    }

    let targetCapacity = remainingMarketCapacity(target.stocks[circuit.totalKey], target.maxStock);
    if (targetCapacity <= 0) {
      return { transferred: false, reason: 'target_full', transfers: [], totalUnits: 0 };
    }

    const allocation = links[linkIndex];
    const transfers = [];
    let sourceStock = createResourceStock(source.stocks, circuit.categories, circuit.totalKey);
    let targetStock = createResourceStock(target.stocks, circuit.categories, circuit.totalKey);
    const nextAllocated = {};
    for (const category of circuit.categories) {
      nextAllocated[category] = Math.max(0, Math.floor(allocation[circuit.allocationField]?.[category] ?? 0));
    }

    for (const category of circuit.categories) {
      if (targetCapacity <= 0) break;

      const allocated = nextAllocated[category];
      const availableOnSource = getCategoryAmount(sourceStock, category);
      const amount = Math.min(allocated, availableOnSource, targetCapacity);
      if (amount <= 0) continue;

      sourceStock = takeCategoryAmount(sourceStock, category, amount, circuit.categories, circuit.totalKey);
      targetStock = addCategoryAmount(targetStock, category, amount, circuit.categories, circuit.totalKey);
      nextAllocated[category] = allocated - amount;
      targetCapacity -= amount;
      transfers.push({ sourceId, category, amount });
    }

    if (transfers.length === 0) {
      return { transferred: false, reason: 'nothing_to_transfer', transfers: [], totalUnits: 0 };
    }

    links[linkIndex] = { ...allocation, [circuit.allocationField]: nextAllocated };

    await this.supplyBuildingRepository.saveStocks(sourceId, sourceStock);
    await circuit.saveLinks(this.supplyBuildingRepository, sourceId, links);
    await this.supplyBuildingRepository.saveStocks(targetId, targetStock);

    const totalUnits = transfers.reduce((sum, transfer) => sum + transfer.amount, 0);
    return { transferred: true, transfers, totalUnits };
  }
}
