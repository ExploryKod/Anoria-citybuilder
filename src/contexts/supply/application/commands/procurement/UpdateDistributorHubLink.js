/**
 * Command: persist a distributor's `distributorTooFar` flag when no hub link
 * exists (UI flag).
 */
export class UpdateDistributorHubLink {
  /**
   * @param {import('../../ports/SupplyBuildingRepository.js').SupplyBuildingRepository} supplyBuildingRepository
   */
  constructor(supplyBuildingRepository) {
    this.supplyBuildingRepository = supplyBuildingRepository;
  }

  /**
   * @param {object} params
   * @param {string} params.distributorId
   * @param {boolean} params.hasHubLink
   */
  async execute({ distributorId, hasHubLink }) {
    if (!distributorId) {
      return { updated: false, reason: 'distributor_id_required' };
    }

    await this.supplyBuildingRepository.saveSupplyFlags(distributorId, {
      distributorTooFar: !hasHubLink,
      noSourcesNearby: false,
    });

    return { updated: true, distributorId, distributorTooFar: !hasHubLink };
  }
}
