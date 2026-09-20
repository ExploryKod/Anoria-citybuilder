import { getAllCategoriesForRole } from '../../../domain/policies/ResourceRolePolicy.js';
/**
 * Command: clear producer `collectedByHub` UI flags (outside the collection
 * period / day-1 reset).
 */
export class ResetSourcesCollectedFlag {
  /**
   * @param {import('../../ports/SupplyBuildingRepository.js').SupplyBuildingRepository} supplyBuildingRepository
   */
  constructor(supplyBuildingRepository) {
    this.supplyBuildingRepository = supplyBuildingRepository;
  }

  /**
   * @param {object} [params]
   * @param {boolean} [params.onlyIfSet=true] - skip sources already false (fewer writes)
   * @returns {Promise<{ sources: number, cleared: number }>}
   */
  async execute({ onlyIfSet = true } = {}) {
    const sources = await this.supplyBuildingRepository.findByResourceRole('producer', getAllCategoriesForRole('collector'));
    let cleared = 0;

    for (const source of sources) {
      const view = await this.supplyBuildingRepository.findSupplyView(source.id);
      if (!view) continue;
      if (onlyIfSet && view.collectedByHub !== true) continue;

      await this.supplyBuildingRepository.saveSupplyFlags(source.id, {
        collectedByHub: false,
      });
      cleared += 1;
    }

    return { sources: sources.length, cleared };
  }
}
