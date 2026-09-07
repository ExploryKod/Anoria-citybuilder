import { takeAcrossCategories } from '../../../domain/value-objects/ResourceStock.js';
import { matchesSchedule } from '../../../domain/policies/ResourceSchedulePolicy.js';
import { isLockedForPeriod, buildLockUpdate } from '../../../domain/policies/PeriodLockPolicy.js';
import {
  getAmountForRole,
  getCategoriesForRole,
  getScheduleForRole,
  getTotalKeyForRole,
  getPeriodLockForRole,
} from '../../../domain/policies/ResourceRolePolicy.js';

/**
 * Command: a building consumes resource units for its population (once per
 * period), gated by its 'consumer' role's declarative `schedule` and
 * `periodLock` (see PeriodLockPolicy.js). `amount` on that role is read as a
 * per-capita rate (demand = pop × amount) — the only way 'consumer'
 * interprets `amount` differently from producer/collector/distributor, which
 * treat it as a flat quantity. Drains the total (whichever categories have
 * stock), not a specific one — this only answers "was demand met," not
 * "which food."
 */
export class ConsumeResource {
  /**
   * @param {import('../../ports/SupplyBuildingRepository.js').SupplyBuildingRepository} supplyBuildingRepository
   */
  constructor(supplyBuildingRepository) {
    this.supplyBuildingRepository = supplyBuildingRepository;
  }

  /**
   * @param {object} params
   * @param {string} params.buildingId
   * @param {object} params.period
   * @returns {Promise<{
   *   consumed: boolean,
   *   reason?: string,
   *   buildingId?: string,
   *   pop?: number,
   *   demand?: number,
   *   taken?: number,
   *   totalUnfed?: number,
   * }>}
   */
  async execute({ buildingId, period }) {
    const building = await this.supplyBuildingRepository.findById(buildingId);
    if (!building) {
      return { consumed: false, reason: 'building_not_found' };
    }

    const schedule = getScheduleForRole(building.type, 'consumer');
    if (!matchesSchedule(schedule, period)) {
      return { consumed: false, reason: 'not_consumption_period' };
    }

    const periodLock = getPeriodLockForRole(building.type, 'consumer');
    if (isLockedForPeriod(building, periodLock, period)) {
      return { consumed: false, reason: 'already_consumed_this_period' };
    }

    const pop = Number.isFinite(building.pop) ? Math.max(0, Math.floor(building.pop)) : 0;
    if (pop <= 0) {
      return { consumed: false, reason: 'no_population' };
    }

    const perCapita = getAmountForRole(building.type, 'consumer') ?? 0;
    const categories = getCategoriesForRole(building.type, 'consumer');
    const totalKey = getTotalKeyForRole(building.type, 'consumer');
    const demand = pop * perCapita;

    const { nextStock, taken } = takeAcrossCategories(building.stocks, categories, totalKey, demand);
    const totalUnfed = Math.max(0, Math.ceil(demand - taken));

    await this.supplyBuildingRepository.saveStocks(buildingId, nextStock);
    if (periodLock) {
      await this.supplyBuildingRepository.updateBuildingFields(
        buildingId,
        buildLockUpdate(periodLock, period, { lastConsumption: { month: period.monthIndex, demand, taken, totalUnfed } })
      );
    }

    return { consumed: true, buildingId, pop, demand, taken, totalUnfed };
  }
}
