import {
  applyHouseFoodConsumption,
} from '../../../domain/policies/HouseConsumptionPolicy.js';

/**
 * Command: house consumes food baskets for its population (once per month).
 *
 * Consumption draws from gathering stocks (fruit, game) first, then market
 * crops (wheat, carrot, cabbage). Gathering is credited earlier in the
 * monthly cycle via `ProduceHouseSubsistenceFood`.
 */
export class ConsumeHouseFood {
  /**
   * @param {import('../../ports/SupplyBuildingRepository.js').SupplyBuildingRepository} supplyBuildingRepository
   */
  constructor(supplyBuildingRepository) {
    this.supplyBuildingRepository = supplyBuildingRepository;
  }

  /**
   * @param {object} params
   * @param {string} params.houseId
   * @param {number} params.monthIndex
   * @returns {Promise<{
   *   consumed: boolean,
   *   reason?: string,
   *   houseId?: string,
   *   pop?: number,
   *   demand?: number,
   *   unfed?: number,
   *   consumedByCategory?: Record<string, number>,
   *   crops?: Record<string, number>,
   * }>}
   */
  async execute({ houseId, monthIndex }) {
    const house = await this.supplyBuildingRepository.findById(houseId);
    if (!house) {
      return { consumed: false, reason: 'house_not_found' };
    }

    const month = Number.isFinite(monthIndex) ? Math.floor(monthIndex) : 0;
    if (house.lastConsumptionMonth === month) {
      return { consumed: false, reason: 'already_consumed_this_month' };
    }

    const pop = Number.isFinite(house.pop) ? Math.max(0, Math.floor(house.pop)) : 0;
    if (pop <= 0) {
      return { consumed: false, reason: 'no_population' };
    }

    const level = house.level ?? 1;
    const { nextStock, consumed, demanded, unfed, totalUnfed } = applyHouseFoodConsumption({
      stock: house.stocks,
      population: pop,
      level,
    });

    await this.supplyBuildingRepository.saveStocks(houseId, nextStock);
    await this.supplyBuildingRepository.saveConsumptionMetadata(houseId, {
      lastConsumptionMonth: month,
    });

    // Save detailed consumption record
    await this.supplyBuildingRepository.saveConsumptionRecord(houseId, {
      month: monthIndex,
      consumed,
      demanded,
      unfed,
      totalUnfed,
    });

    return {
      consumed: true,
      houseId,
      pop,
      demand: Object.values(demanded).reduce((sum, qty) => sum + qty, 0),
      unfed: totalUnfed,
      consumedByCategory: consumed,
      crops: { ...consumed },
    };
  }
}
