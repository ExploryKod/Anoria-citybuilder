import { canWindmillCollectFromFarms } from '../../../domain/policies/CollectingMonthPolicy.js';

/**
 * Command: set windmill `isCollecting` from English month (UI flag).
 * December → true for all windmills; other months → false.
 */
export class MarkWindmillCollectingSeason {
  /**
   * @param {import('../../ports/SupplyBuildingRepository.js').SupplyBuildingRepository} supplyBuildingRepository
   */
  constructor(supplyBuildingRepository) {
    this.supplyBuildingRepository = supplyBuildingRepository;
  }

  /**
   * @param {string} month
   * @returns {Promise<{ windmills: number, isCollecting: boolean }>}
   */
  async execute(month) {
    const isCollecting = canWindmillCollectFromFarms(month);
    const windmills = await this.supplyBuildingRepository.findWindmills();

    for (const windmill of windmills) {
      await this.supplyBuildingRepository.saveMarketFlags(windmill.id, {
        isCollecting,
      });
    }

    return { windmills: windmills.length, isCollecting };
  }
}
