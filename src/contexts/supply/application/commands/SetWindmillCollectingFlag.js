/**
 * Command: set a single windmill `isCollecting` flag (operational gate result).
 */
export class SetWindmillCollectingFlag {
  /**
   * @param {import('../ports/SupplyBuildingRepository.js').SupplyBuildingRepository} supplyBuildingRepository
   */
  constructor(supplyBuildingRepository) {
    this.supplyBuildingRepository = supplyBuildingRepository;
  }

  /**
   * @param {object} params
   * @param {string} params.windmillId
   * @param {boolean} params.isCollecting
   */
  async execute({ windmillId, isCollecting }) {
    if (!windmillId) {
      return { updated: false, reason: 'windmill_id_required' };
    }

    await this.supplyBuildingRepository.saveMarketFlags(windmillId, {
      isCollecting: isCollecting === true,
    });

    return { updated: true, windmillId, isCollecting: isCollecting === true };
  }
}
