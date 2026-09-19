/**
 * Command: persist a distributor's `noSourcesNearby` flag from neighbor
 * discovery (UI flag).
 */
export class UpdateDistributorSourceProximity {
  /**
   * @param {import('../../ports/SupplyBuildingRepository.js').SupplyBuildingRepository} supplyBuildingRepository
   */
  constructor(supplyBuildingRepository) {
    this.supplyBuildingRepository = supplyBuildingRepository;
  }

  /**
   * @param {object} params
   * @param {string} params.distributorId
   * @param {boolean} params.hasSourcesNearby
   */
  async execute({ distributorId, hasSourcesNearby }) {
    if (!distributorId) {
      return { updated: false, reason: 'distributor_id_required' };
    }

    await this.supplyBuildingRepository.saveSupplyFlags(distributorId, {
      noSourcesNearby: !hasSourcesNearby,
    });

    return { updated: true, distributorId, noSourcesNearby: !hasSourcesNearby };
  }
}
