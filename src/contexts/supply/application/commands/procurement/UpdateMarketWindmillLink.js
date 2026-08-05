/**
 * Command: persist market `marketTooFar` when no windmill link exists (UI flag).
 */
export class UpdateMarketWindmillLink {
  /**
   * @param {import('../../ports/SupplyBuildingRepository.js').SupplyBuildingRepository} supplyBuildingRepository
   */
  constructor(supplyBuildingRepository) {
    this.supplyBuildingRepository = supplyBuildingRepository;
  }

  /**
   * @param {object} params
   * @param {string} params.marketId
   * @param {boolean} params.hasWindmillLink
   */
  async execute({ marketId, hasWindmillLink }) {
    if (!marketId) {
      return { updated: false, reason: 'market_id_required' };
    }

    await this.supplyBuildingRepository.saveMarketFlags(marketId, {
      marketTooFar: !hasWindmillLink,
      noFarmsNearby: false,
    });

    return { updated: true, marketId, marketTooFar: !hasWindmillLink };
  }
}
