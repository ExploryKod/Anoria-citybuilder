import { computeMonthlyGatheringCredit } from '../../../domain/policies/HouseSubsistencePolicy.js';

/**
 * Command: inhabited house gains monthly foraged fruit and hunted game —
 * bypasses farms/markets entirely (see `HouseSubsistencePolicy`).
 */
export class ProduceHouseSubsistenceFood {
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
   *   produced: boolean,
   *   reason?: string,
   *   houseId?: string,
   *   pop?: number,
   *   credited?: { fruit: number, game: number },
   *   food?: number,
   * }>}
   */
  async execute({ houseId, monthIndex }) {
    const house = await this.supplyBuildingRepository.findById(houseId);
    if (!house) {
      return { produced: false, reason: 'house_not_found' };
    }

    const month = Number.isFinite(monthIndex) ? Math.floor(monthIndex) : 0;
    if (house.lastSubsistenceMonth === month) {
      return { produced: false, reason: 'already_produced_this_month' };
    }

    const pop = Number.isFinite(house.pop) ? Math.max(0, Math.floor(house.pop)) : 0;
    if (pop <= 0) {
      return { produced: false, reason: 'no_population' };
    }

    const { nextStock, credited } = computeMonthlyGatheringCredit({
      pop,
      stocks: house.stocks,
    });

    await this.supplyBuildingRepository.saveStocks(houseId, nextStock);
    await this.supplyBuildingRepository.saveSubsistenceMetadata(houseId, {
      lastSubsistenceMonth: month,
    });

    return {
      produced: true,
      houseId,
      pop,
      credited,
      food: nextStock.food,
    };
  }
}
