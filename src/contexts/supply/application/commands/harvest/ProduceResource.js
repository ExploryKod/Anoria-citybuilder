import { isOperational } from '../../../domain/policies/OperationalGatePolicy.js';
import { addCategoryAmount } from '../../../domain/value-objects/ResourceStock.js';
import { matchesSchedule } from '../../../domain/policies/ResourceSchedulePolicy.js';
import { isLockedForPeriod, buildLockUpdate } from '../../../domain/policies/PeriodLockPolicy.js';
import { getResourceRoles } from '../../../domain/policies/ResourceRolePolicy.js';
import { getCategoriesForTotalKey } from '../../../../../shared/building-catalog/resourceRoleQueries.js';

/**
 * Command: a building produces resource units into its own stock, gated by
 * each of its 'producer' entries' declarative `schedule` and `periodLock`
 * (see buildingEconomy.js / ResourceSchedulePolicy.js / PeriodLockPolicy.js).
 * Fully resource-agnostic — every fact about WHAT is produced, HOW MUCH,
 * WHEN, and the once-per-period lock comes from the building's own catalog
 * entries; this command never names a resource or a lock field itself.
 *
 * A building can hold several 'producer' entries (a house that gathers, a
 * workshop with two outputs); each is evaluated independently. Two catalog
 * facts refine an entry:
 *   - `scale: 'building' | 'population'` — an entry declaring `scale` belongs
 *     to inhabitants: it needs at least one, and `'population'` multiplies
 *     `amount` by their number (`'building'` = flat amount per building).
 *   - `requiresOperational: false` — lifts the road/staffing gate.
 * An entry with a `totalKey` writes through the full set of categories
 * filed under that aggregate, so the aggregate stays consistent and the
 * building's other goods are untouched.
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
   * @returns {Promise<{
   *   produced: boolean,
   *   reason?: string,
   *   buildingId?: string,
   *   category?: string,
   *   amount?: number,
   * }>}
   */
  async execute({ buildingId, period }) {
    let building = await this.supplyBuildingRepository.findById(buildingId);
    if (!building) {
      return { produced: false, reason: 'building_not_found' };
    }

    const entries = getResourceRoles(building.type).filter((entry) => entry.role === 'producer');
    if (entries.length === 0 || !entries[0].categories?.[0]) {
      return { produced: false, reason: 'unknown_resource_category' };
    }

    const credited = {};
    let firstFailure = null;

    for (const entry of entries) {
      const category = entry.categories?.[0] ?? null;
      if (!category) {
        firstFailure ??= 'unknown_resource_category';
        continue;
      }

      if (!matchesSchedule(entry.schedule, period)) {
        firstFailure ??= 'not_production_period';
        continue;
      }

      if (
        entry.requiresOperational !== false &&
        !isOperational({
          roadCount: building.roadCount,
          worker: building.worker,
          workerNeed: building.workerNeed,
        })
      ) {
        firstFailure ??= 'not_operational';
        continue;
      }

      if (isLockedForPeriod(building, entry.periodLock, period, category)) {
        firstFailure ??= 'already_produced_this_period';
        continue;
      }

      let amount = entry.amount ?? 0;
      if (entry.scale) {
        const pop = Number.isFinite(building.pop) ? Math.max(0, Math.floor(building.pop)) : 0;
        if (pop <= 0) {
          firstFailure ??= 'no_population';
          continue;
        }
        if (entry.scale === 'population') amount *= pop;
      }

      const sharesTotal = Boolean(entry.totalKey);
      const shapeCategories = sharesTotal ? getCategoriesForTotalKey(entry.totalKey) : [category];
      const totalKey = sharesTotal ? entry.totalKey : category;

      let nextStock = building.stocks;
      for (const produced of entry.categories) {
        nextStock = addCategoryAmount(nextStock, produced, amount, shapeCategories, totalKey);
        credited[produced] = (credited[produced] ?? 0) + amount;
      }

      const stocksToSave = sharesTotal ? { ...building.stocks, ...nextStock } : nextStock;
      await this.supplyBuildingRepository.saveStocks(buildingId, stocksToSave);

      const lockUpdate = entry.periodLock
        ? buildLockUpdate(building, entry.periodLock, period, category)
        : null;
      if (lockUpdate) {
        await this.supplyBuildingRepository.updateBuildingFields(buildingId, lockUpdate);
      }

      building = { ...building, stocks: stocksToSave, ...(lockUpdate ?? {}) };
    }

    const categories = Object.keys(credited);
    if (categories.length === 0) {
      return { produced: false, reason: firstFailure ?? 'unknown_resource_category' };
    }

    return {
      produced: true,
      buildingId,
      category: categories[0],
      amount: credited[categories[0]],
    };
  }
}
