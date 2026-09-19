/**
 * Command: set a single hub's `isCollecting` flag (operational gate result).
 */
export class SetHubCollectingFlag {
  /**
   * @param {import('../../ports/SupplyBuildingRepository.js').SupplyBuildingRepository} supplyBuildingRepository
   */
  constructor(supplyBuildingRepository) {
    this.supplyBuildingRepository = supplyBuildingRepository;
  }

  /**
   * @param {object} params
   * @param {string} params.hubId
   * @param {boolean} params.isCollecting
   */
  async execute({ hubId, isCollecting }) {
    if (!hubId) {
      return { updated: false, reason: 'hub_id_required' };
    }

    await this.supplyBuildingRepository.saveSupplyFlags(hubId, {
      isCollecting: isCollecting === true,
    });

    return { updated: true, hubId, isCollecting: isCollecting === true };
  }
}
