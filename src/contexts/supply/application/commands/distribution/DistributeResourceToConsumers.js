import { isOperational } from '../../../domain/policies/OperationalGatePolicy.js';
import {
  createResourceStock,
  getCategoryAmount,
  takeCategoryAmount,
  addCategoryAmount,
} from '../../../domain/value-objects/ResourceStock.js';
import { resolveInstanceIdFromNeighborRef } from '../../../../../shared/building-identity/BuildingRecord.js';
import { distributeRoundRobin } from '../../services/RoundRobinDistribution.js';
import { matchesSchedule } from '../../../domain/policies/ResourceSchedulePolicy.js';
import { isLockedForPeriod, buildLockUpdate } from '../../../domain/policies/PeriodLockPolicy.js';
import {
  getCategoriesForRole,
  getScheduleForRole,
  getTotalKeyForRole,
  getConsumptionModeForRole,
  getPeriodLockForRole,
  computeConsumerDeficit,
} from '../../../domain/policies/ResourceRolePolicy.js';
import { getCategoriesForTotalKey, isRoadNeedMet } from '../../../../../shared/building-catalog/resourceRoleQueries.js';

/**
 * Command: a source building distributes resource units to consumers in
 * range (market-to-houses monthly food sale today; resource-agnostic
 * otherwise). Round-robin: each pass, every eligible consumer may take 1
 * unit per still-available category. Every fact about WHAT is distributed
 * and WHEN comes from the source's own 'distributor' role in the catalog —
 * no circuit descriptor needed.
 *
 * The source's `consumption` mode picks one of two entirely different
 * transfer shapes: 'quantity' (default, below `#distributeQuantity`) moves
 * a depleting numeric stock; 'flag' (`#distributeFlag`) has no stock at
 * all — it just marks each newly-reached consumer "served this period" on
 * ITS OWN 'consumer'-role `periodLock` (e.g. a chapel's faith service
 * reaching nearby houses), reusing the exact once-per-period lock
 * ConsumeResource already relies on for food. Same `{ distributed,
 * transfers, totalUnits }` return shape either way, so callers (walker
 * events, traceability) don't need to know which mode ran.
 */
export class DistributeResourceToConsumers {
  /**
   * @param {import('../../ports/SupplyBuildingRepository.js').SupplyBuildingRepository} supplyBuildingRepository
   */
  constructor(supplyBuildingRepository) {
    this.supplyBuildingRepository = supplyBuildingRepository;
  }

  /**
   * @param {object} params
   * @param {string} params.sourceId
   * @param {object[]} params.consumerRefs
   * @param {object} params.period
   * @param {string} [params.category] Any good of the source's 'distributor' entry to hand out, when it has several.
   * @returns {Promise<{
   *   distributed: boolean,
   *   reason?: string,
   *   transfers: Array<{ consumerId: string, category: string, amount: number }>,
   *   totalUnits: number,
   * }>}
   */
  async execute({ sourceId, consumerRefs = [], period, category }) {
    const source = await this.supplyBuildingRepository.findById(sourceId);
    if (!source) {
      return { distributed: false, reason: 'source_not_found', transfers: [], totalUnits: 0 };
    }

    const schedule = getScheduleForRole(source.type, 'distributor', category);
    if (!matchesSchedule(schedule, period)) {
      return { distributed: false, reason: 'not_distribution_period', transfers: [], totalUnits: 0 };
    }

    if (
      !isOperational({
        type: source.type,
        roadCount: source.roadCount,
        worker: source.worker,
        workerNeed: source.workerNeed,
      })
    ) {
      return { distributed: false, reason: 'source_not_operational', transfers: [], totalUnits: 0 };
    }

    const categories = getCategoriesForRole(source.type, 'distributor', category);

    const consumerIds = [
      ...new Set(
        consumerRefs.map(resolveInstanceIdFromNeighborRef).filter((id) => typeof id === 'string' && id.length > 0),
      ),
    ];
    if (consumerIds.length === 0) {
      return { distributed: false, reason: 'no_consumers', transfers: [], totalUnits: 0 };
    }

    if (getConsumptionModeForRole(source.type, 'distributor', category) === 'flag') {
      return this.#distributeFlag({ categories, consumerIds, period });
    }

    const totalKey = getTotalKeyForRole(source.type, 'distributor', category);
    // A stock is rebuilt with EVERY good filed under its total, not just the ones this
    // distributor moves: a house also holds what it gathered (fruit, game), and rebuilding
    // it from the distributor's goods alone wiped those while the total kept counting them.
    const filedUnderTotal = getCategoriesForTotalKey(totalKey);
    const stockCategories = filedUnderTotal.length > 0 ? filedUnderTotal : categories;
    const sourceStock = createResourceStock(source.stocks, stockCategories, totalKey);
    const availableTotal = categories.reduce(
      (sum, category) => sum + getCategoryAmount(sourceStock, category),
      0,
    );
    if (availableTotal <= 0) {
      return { distributed: false, reason: 'source_empty', transfers: [], totalUnits: 0 };
    }

    const { transfers, sourceStock: nextSourceStock } = await distributeRoundRobin({
      categories,
      sourceStock,
      consumerIds,
      isEligible: (consumer) => isRoadNeedMet(consumer.type, consumer.roadCount),
      // What each house still needs OF THIS GOOD: its need for these goods, not its first need.
      getCap: (consumer) => computeConsumerDeficit(consumer, categories[0]),
      repository: this.supplyBuildingRepository,
      createStock: (raw) => createResourceStock(raw, stockCategories, totalKey),
      takeCategory: (stock, category, amount) =>
        takeCategoryAmount(stock, category, amount, stockCategories, totalKey),
      addCategory: (stock, category, amount) =>
        addCategoryAmount(stock, category, amount, stockCategories, totalKey),
      getAmount: getCategoryAmount,
    });

    if (transfers.length === 0) {
      return { distributed: false, reason: 'nothing_distributed', transfers: [], totalUnits: 0 };
    }

    await this.supplyBuildingRepository.saveStocks(sourceId, nextSourceStock);

    const totalUnits = transfers.reduce((sum, transfer) => sum + transfer.amount, 0);
    return { distributed: true, transfers, totalUnits };
  }

  /**
   * 'flag' mode: no stock anywhere. Marks each newly-reached, road-connected
   * consumer "served this period" via ITS OWN 'consumer'-role `periodLock`
   * (looked up per consumer type, filtered to this category + 'flag' — see
   * ResourceRolePolicy — since a consumer can also hold an unrelated
   * 'quantity' consumer entry, e.g. a house's food consumption). A consumer
   * already served this period, or with no matching 'flag' consumer entry
   * at all, is simply skipped — not an error.
   *
   * @param {object} params
   * @param {string[]} params.categories Single-category by convention for a
   *   'flag' distributor (a service represents one need, not a bundle).
   * @param {string[]} params.consumerIds
   * @param {object} params.period
   */
  async #distributeFlag({ categories, consumerIds, period }) {
    const category = categories[0] ?? null;
    if (!category) {
      return { distributed: false, reason: 'unknown_resource_category', transfers: [], totalUnits: 0 };
    }

    const transfers = [];
    for (const consumerId of consumerIds) {
      const consumer = await this.supplyBuildingRepository.findById(consumerId);
      if (!consumer || !isRoadNeedMet(consumer.type, consumer.roadCount)) continue;

      const periodLock = getPeriodLockForRole(consumer.type, 'consumer', category, 'flag');
      if (!periodLock || isLockedForPeriod(consumer, periodLock, period, category)) continue;

      await this.supplyBuildingRepository.updateBuildingFields(
        consumerId,
        buildLockUpdate(consumer, periodLock, period, category)
      );
      transfers.push({ consumerId, category, amount: 1 });
    }

    if (transfers.length === 0) {
      return { distributed: false, reason: 'nothing_distributed', transfers: [], totalUnits: 0 };
    }

    return { distributed: true, transfers, totalUnits: transfers.length };
  }
}
