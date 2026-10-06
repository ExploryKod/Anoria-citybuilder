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
import { unitPriceOf } from '../../../../../shared/resource-catalog/ValueChainCatalog.js';

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
   * @param {{ fundsOf: (consumerId: string) => Promise<number> }} consumerMoney what each consumer can spend now, from its
   *   personal account: a consumer buys only what it can pay
   */
  constructor(supplyBuildingRepository, consumerMoney) {
    if (!consumerMoney || typeof consumerMoney.fundsOf !== 'function') {
      throw new Error('[supply] the distribution needs the consumers\' money (fundsOf)');
    }
    this.supplyBuildingRepository = supplyBuildingRepository;
    this.consumerMoney = consumerMoney;
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
    // An empty source still reports every consumer's shortage: the round-robin hands out nothing and says what is missing.
    const { transfers, sourceStock: nextSourceStock, unmet } = await distributeRoundRobin({
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
      money: {
        fundsOf: (consumerId) => this.consumerMoney.fundsOf(consumerId),
        priceOf: (category) => unitPriceOf(source.type, category),
      },
    });

    await this.#recordShortfalls({ unmet, totalKey, period });

    if (transfers.length === 0) {
      return {
        distributed: false,
        reason: availableTotal <= 0 ? 'source_empty' : 'nothing_distributed',
        transfers: [],
        totalUnits: 0,
      };
    }

    await this.supplyBuildingRepository.saveStocks(sourceId, nextSourceStock);

    const totalUnits = transfers.reduce((sum, transfer) => sum + transfer.amount, 0);
    return { distributed: true, transfers, totalUnits };
  }

  /**
   * What each consumer is still missing, for the month, and why: unpaid (its personal account could not pay) or shortage
   * (the source ran out). A day is counted once: each pass replaces the day's figure, the last pass being the final state.
   * The month's figures are kept on the consumer, the completed month being the one the consumption records report.
   * @param {{ unmet: Array<{ consumerId: string, unpaidUnits: number, shortageUnits: number }>, totalKey: string, period: { year: number, monthIndex: number, turn: number } }} params
   */
  async #recordShortfalls({ unmet, totalKey, period }) {
    for (const entry of unmet) {
      const consumer = await this.supplyBuildingRepository.findById(entry.consumerId);
      if (!consumer) throw new Error(`[supply] consumer ${entry.consumerId} of a shortfall is not in the city`);
      const stored = consumer.supplyShortfall ?? null;
      const sameMonth = Boolean(stored?.current) && stored.current.year === period.year && stored.current.monthIndex === period.monthIndex;
      const current = sameMonth ? stored.current : { year: period.year, monthIndex: period.monthIndex, byNeed: {} };
      const previous = sameMonth ? stored.previous ?? null : stored?.current ?? null;
      const before = current.byNeed[totalKey] ?? { unpaid: 0, shortage: 0, turn: null, dayUnpaid: 0, dayShortage: 0 };
      const sameDay = before.turn === period.turn;
      const byNeed = {
        ...current.byNeed,
        [totalKey]: {
          unpaid: before.unpaid - (sameDay ? before.dayUnpaid : 0) + entry.unpaidUnits,
          shortage: before.shortage - (sameDay ? before.dayShortage : 0) + entry.shortageUnits,
          turn: period.turn,
          dayUnpaid: entry.unpaidUnits,
          dayShortage: entry.shortageUnits,
        },
      };
      await this.supplyBuildingRepository.updateBuildingFields(entry.consumerId, {
        supplyShortfall: { current: { ...current, byNeed }, previous },
      });
    }
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

      // A house whose bill for this service was not paid is not served this month: the reason is kept on the house.
      const cutOff = await this.consumerMoney.isServiceCutOff({
        houseId: consumerId,
        service: category,
        year: period.year,
        monthIndex: period.monthIndex,
      });
      if (cutOff) {
        const sameMonth = consumer.serviceCutOff?.year === period.year && consumer.serviceCutOff?.monthIndex === period.monthIndex;
        const categories = sameMonth ? [...new Set([...consumer.serviceCutOff.categories, category])] : [category];
        await this.supplyBuildingRepository.updateBuildingFields(consumerId, {
          serviceCutOff: { year: period.year, monthIndex: period.monthIndex, categories },
        });
        continue;
      }

      // Served: any cut-off kept from an earlier month is over.
      await this.supplyBuildingRepository.updateBuildingFields(
        consumerId,
        buildLockUpdate(consumer, periodLock, period, category, consumer.serviceCutOff ? { serviceCutOff: null } : {})
      );
      transfers.push({ consumerId, category, amount: 1 });
    }

    if (transfers.length === 0) {
      return { distributed: false, reason: 'nothing_distributed', transfers: [], totalUnits: 0 };
    }

    return { distributed: true, transfers, totalUnits: transfers.length };
  }
}
