/**
 * Command: persist market `noFarmsNearby` from neighbor discovery (UI flag).
 */
export class UpdateMarketFarmProximity {
  /**
   * @param {import('../ports/SupplyBuildingRepository.js').SupplyBuildingRepository} supplyBuildingRepository
   */
  constructor(supplyBuildingRepository) {
    this.supplyBuildingRepository = supplyBuildingRepository;
  }

  /**
   * @param {object} params
   * @param {string} params.marketId
   * @param {boolean} params.hasFarmsNearby
   */
  async execute({ marketId, hasFarmsNearby }) {
    if (!marketId) {
      return { updated: false, reason: 'market_id_required' };
    }

    await this.supplyBuildingRepository.saveMarketFlags(marketId, {
      noFarmsNearby: !hasFarmsNearby,
    });

    return { updated: true, marketId, noFarmsNearby: !hasFarmsNearby };
  }
}
