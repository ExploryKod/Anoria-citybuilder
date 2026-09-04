/**
 * Command: mark a source as collected after a successful hub transfer (UI sprite).
 */
export class MarkSourceCollectedByHub {
  /**
   * @param {import('../../ports/SupplyBuildingRepository.js').SupplyBuildingRepository} supplyBuildingRepository
   */
  constructor(supplyBuildingRepository) {
    this.supplyBuildingRepository = supplyBuildingRepository;
  }

  /**
   * @param {object} params
   * @param {string} params.sourceId
   * @param {boolean} [params.collected=true]
   */
  async execute({ sourceId, collected = true }) {
    if (!sourceId) {
      return { updated: false, reason: 'source_id_required' };
    }

    await this.supplyBuildingRepository.saveSupplyFlags(sourceId, {
      collectedByHub: collected === true,
    });

    return { updated: true, sourceId, collected: collected === true };
  }
}
