import { isOperational } from '../../../domain/policies/OperationalGatePolicy.js';
import { addCategoryAmount } from '../../../domain/value-objects/ResourceStock.js';
import { matchesSchedule } from '../../../domain/policies/ResourceSchedulePolicy.js';
import {
  getAmountForRole,
  getCategoriesForRole,
  getScheduleForRole,
  getTotalKeyForRole,
} from '../../../domain/policies/ResourceRolePolicy.js';

/**
 * Command: a building produces resource units into its own stock, gated by
 * its 'producer' role's declarative `schedule` (see buildingEconomy.js /
 * ResourceSchedulePolicy.js) and a once-per-period lock. Resource-agnostic —
 * every fact about WHAT is produced and WHEN comes from the building's own
 * catalog entry; `bookkeeping` only carries the once-per-period lock's
 * storage shape, which still varies by caller (see FoodCircuits.js).
 */
export class ProduceResource {
  /**
   * @param {import('../../ports/SupplyBuildingRepository.js').SupplyBuildingRepository} supplyBuildingRepository
   */
  constructor(supplyBuildingRepository) {
    this.supplyBuildingRepository = supplyBuildingRepository;
  }

  /**
   * @param {object} params
   * @param {string} params.buildingId
   * @param {object} params.period - time context (season, month, year, monthIndex, ...)
   * @param {object} params.bookkeeping - { periodKey(period), lastProducedField, saveProductionMetadata(repo, buildingId, period) }
   * @returns {Promise<{
   *   produced: boolean,
   *   reason?: string,
   *   buildingId?: string,
   *   category?: string,
   *   amount?: number,
   * }>}
   */
  async execute({ buildingId, period, bookkeeping }) {
    const building = await this.supplyBuildingRepository.findById(buildingId);
    if (!building) {
      return { produced: false, reason: 'building_not_found' };
    }

    const schedule = getScheduleForRole(building.type, 'producer');
    if (!matchesSchedule(schedule, period)) {
      return { produced: false, reason: 'not_production_period' };
    }

    if (
      !isOperational({
        roadCount: building.roadCount,
        worker: building.worker,
        workerNeed: building.workerNeed,
      })
    ) {
      return { produced: false, reason: 'not_operational' };
    }

    const periodKey = bookkeeping.periodKey(period);
    if (building[bookkeeping.lastProducedField] === periodKey) {
      return { produced: false, reason: 'already_produced_this_period' };
    }

    const categories = getCategoriesForRole(building.type, 'producer');
    const category = categories[0] ?? null;
    if (!category) {
      return { produced: false, reason: 'unknown_resource_category' };
    }

    const amount = getAmountForRole(building.type, 'producer') ?? 0;
    const totalKey = getTotalKeyForRole(building.type, 'producer');
    const nextStock = addCategoryAmount(building.stocks, category, amount, categories, totalKey);
    await this.supplyBuildingRepository.saveStocks(buildingId, nextStock);
    await bookkeeping.saveProductionMetadata(this.supplyBuildingRepository, buildingId, period);

    return { produced: true, buildingId, category, amount };
  }
}
