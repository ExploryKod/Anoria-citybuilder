/**
 * Query (CQRS read): what the farms of the city can expect over a year against what its citizens eat and what its granaries can keep (see
 * FoodForecastPolicy.js). Every figure comes from the catalog and from the buildings standing now: the yield of each farm, the citizens' monthly
 * need, the capacity and the per-good ceiling of each working granary (its storage orders). Read-only, nothing is persisted.
 */
import { isOperational } from '../../domain/policies/OperationalGatePolicy.js';
import { getCategoriesForRole, listRoleEntries } from '../../domain/policies/ResourceRolePolicy.js';
import { getShelfLifeMonths } from '../../../../shared/resource-catalog/ResourceCategoryCatalog.js';
import { getHubProductRemainingInbound, normalizeHubStorageOrders } from '../../domain/policies/HubStorageOrdersPolicy.js';
import { foodForecastOf } from '../../domain/policies/FoodForecastPolicy.js';
import { getAnnualSupplyEntry, getPerCapitaDemand, getSuppliedCategories } from '../../../../shared/building-catalog/resourceRoleQueries.js';
import { MONTHS_PER_YEAR } from '../../../../shared/time/TimeCalendar.js';

export class DescribeFoodForecast {
  /**
   * @param {import('../ports/SupplyBuildingRepository.js').SupplyBuildingRepository} supplyBuildingRepository
   */
  constructor(supplyBuildingRepository) {
    this.supplyBuildingRepository = supplyBuildingRepository;
  }

  /**
   * @returns {Promise<ReturnType<typeof foodForecastOf> & { farms: number }>}
   */
  async execute() {
    const supplied = getSuppliedCategories();
    const farms = (await this.supplyBuildingRepository.findByResourceRole('producer', supplied)).filter((farm) => getAnnualSupplyEntry(farm.type));
    const houses = await this.supplyBuildingRepository.findByResourceRole('consumer', supplied);
    const granaries = (await this.supplyBuildingRepository.findByResourceRole('hub', supplied)).filter((hub) =>
      isOperational({ type: hub.type, roadCount: hub.roadCount, worker: hub.worker, workerNeed: hub.workerNeed })
    );

    const harvestByCategory = {};
    for (const farm of farms) {
      const entry = getAnnualSupplyEntry(farm.type);
      const category = entry.categories[0];
      harvestByCategory[category] = (harvestByCategory[category] ?? 0) + entry.amount;
    }

    const demand = houses.reduce((sum, house) => sum + (house.pop ?? 0) * getPerCapitaDemand(house.type) * MONTHS_PER_YEAR, 0);

    const byCategory = {};
    let total = 0;
    for (const granary of granaries) {
      const goods = getCategoriesForRole(granary.type, 'hub');
      const orders = normalizeHubStorageOrders(granary.hubStorageOrders, goods);
      total += granary.maxStock;
      const granaryEntry = listRoleEntries(granary.type, 'hub').find((entry) => entry.categories.some((category) => goods.includes(category)));
      for (const category of Object.keys(harvestByCategory)) {
        // An empty granary: what a good can still go in is the room its own ceiling gives it (nil when the granary refuses or empties it).
        const room = getHubProductRemainingInbound({ productId: category, productIds: goods, orders, stocks: {}, totalCapacity: granary.maxStock });
        // A good that goes bad before the next harvest feeds the citizens only for the part of the year it lasts.
        const lifeMonths = getShelfLifeMonths(category) * (granaryEntry?.shelfLifeFactor ?? 1);
        byCategory[category] = (byCategory[category] ?? 0) + Math.floor(room * Math.min(1, lifeMonths / MONTHS_PER_YEAR));
      }
    }

    return { farms: farms.length, ...foodForecastOf({ harvestByCategory, demand, storage: { byCategory, total } }) };
  }
}
