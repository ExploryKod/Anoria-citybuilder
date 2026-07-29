/**
 * Command: mark farm soldToWindmill after a successful windmill transfer (UI sprite).
 */
export class MarkFarmSoldToWindmill {
  /**
   * @param {import('../../ports/SupplyBuildingRepository.js').SupplyBuildingRepository} supplyBuildingRepository
   */
  constructor(supplyBuildingRepository) {
    this.supplyBuildingRepository = supplyBuildingRepository;
  }

  /**
   * @param {object} params
   * @param {string} params.farmId
   * @param {boolean} [params.soldToWindmill=true]
   */
  async execute({ farmId, soldToWindmill = true }) {
    if (!farmId) {
      return { updated: false, reason: 'farm_id_required' };
    }

    await this.supplyBuildingRepository.saveMarketFlags(farmId, {
      soldToWindmill: soldToWindmill === true,
    });

    return { updated: true, farmId, soldToWindmill: soldToWindmill === true };
  }
}
