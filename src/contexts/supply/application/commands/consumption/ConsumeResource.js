import { takeAcrossCategories } from '../../../domain/value-objects/ResourceStock.js';
import { matchesSchedule } from '../../../domain/policies/ResourceSchedulePolicy.js';
import { isLockedForPeriod, buildLockUpdate } from '../../../domain/policies/PeriodLockPolicy.js';
import {
  computeConsumerDemand,
  getCategoriesForRole,
  getScheduleForRole,
  getTotalKeyForRole,
  getPeriodLockForRole,
  getRoleEntry,
} from '../../../domain/policies/ResourceRolePolicy.js';

/**
 * Command: a building consumes resource units for its population (once per
 * period), gated by its 'consumer' role's declarative `schedule` and
 * `periodLock` (see PeriodLockPolicy.js). `amount` on that role is read as a
 * per-capita rate (demand = pop × amount) — the only way 'consumer'
 * interprets `amount` differently from producer/collector/distributor, which
 * treat it as a flat quantity. Drains the total (whichever categories have
 * stock), not a specific one — "was demand met" (`totalUnfed`) is the
 * primary answer, but `categoriesTaken` also records which distinct
 * categories contributed this period, for a diet-variety-style need (see
 * HouseTierRequirementPolicy.js's `goodsVariety` kind) without this command
 * needing to know that concept exists.
 *
 * Only ever targets the 'quantity'-consumption consumer entry — a building
 * can also hold a 'flag'-consumption consumer entry (a service coverage
 * need, e.g. Chapel's faith service) with no stock to drain at all; that
 * entry is handled entirely inside DistributeResourceToConsumers.js and
 * never reaches this command.
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
   * @param {string} [params.category] Any good of the need to consume when the building has several (a diet, the goods it
   *   wears out); the primary need by default.
   * @returns {Promise<{
   *   consumed: boolean,
   *   reason?: string,
   *   buildingId?: string,
   *   pop?: number,
   *   demand?: number,
   *   taken?: number,
   *   totalUnfed?: number,
   *   categoriesTaken?: string[],
 *   takenByCategory?: Record<string, number>,
   * }>}
   */
  async execute({ buildingId, period, category }) {
    const building = await this.supplyBuildingRepository.findById(buildingId);
    if (!building) {
      return { consumed: false, reason: 'building_not_found' };
    }

    const schedule = getScheduleForRole(building.type, 'consumer', category, 'quantity');
    if (!matchesSchedule(schedule, period)) {
      return { consumed: false, reason: 'not_consumption_period' };
    }

    const periodLock = getPeriodLockForRole(building.type, 'consumer', category, 'quantity');
    if (isLockedForPeriod(building, periodLock, period)) {
      return { consumed: false, reason: 'already_consumed_this_period' };
    }

    const pop = Number.isFinite(building.pop) ? Math.max(0, Math.floor(building.pop)) : 0;
    if (pop <= 0) {
      return { consumed: false, reason: 'no_population' };
    }

    const categories = getCategoriesForRole(building.type, 'consumer', category, 'quantity');
    const totalKey = getTotalKeyForRole(building.type, 'consumer', category, 'quantity');
    const demand = computeConsumerDemand(building, category);

    const { nextStock, taken, categoriesTaken, takenByCategory } = takeAcrossCategories(building.stocks, categories, totalKey, demand);
    const totalUnfed = Math.max(0, Math.ceil(demand - taken));

    await this.supplyBuildingRepository.saveStocks(buildingId, nextStock);
    if (periodLock) {
      // What the building used up is filed under the field this need declares (`outcomeField`), so that one
      // need's outcome (its diet) is never overwritten by another's (the goods it wears out).
      const { outcomeField } = getRoleEntry(building.type, 'consumer', { category, consumption: 'quantity' });
      if (!outcomeField) {
        throw new Error(`[ConsumeResource] "${building.type}" consumer of ${categories.join(', ')} declares no outcomeField`);
      }
      await this.supplyBuildingRepository.updateBuildingFields(
        buildingId,
        buildLockUpdate(building, periodLock, period, categories[0], {
          [outcomeField]: { month: period.monthIndex, demand, taken, totalUnfed, categoriesTaken, takenByCategory },
        })
      );
    }

    return { consumed: true, buildingId, pop, demand, taken, totalUnfed, categoriesTaken, takenByCategory };
  }
}
