import { getAllCategoriesForRole, getResourceRoles } from '../../../domain/policies/ResourceRolePolicy.js';
import { matchesSchedule } from '../../../domain/policies/ResourceSchedulePolicy.js';
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
   * @param {object} [params.period] Time context: a source that declares its own `sale` window keeps
   *   its flag while that window is open and loses it once it closes; the others are cleared as before.
   * @param {boolean} [params.onlySaleWindows=false] Only look at the sources that declare a `sale` window.
   * @returns {Promise<{ sources: number, cleared: number }>}
   */
  async execute({ onlyIfSet = true, period = null, onlySaleWindows = false } = {}) {
    const sources = await this.supplyBuildingRepository.findByResourceRole('producer', getAllCategoriesForRole('collector'));
    let cleared = 0;

    for (const source of sources) {
      // Own sale window (a producer with a `sale`): the flag lives exactly as long as it is open.
      const sale = period
        ? getResourceRoles(source.type).find((entry) => entry.role === 'producer' && entry.sale)?.sale
        : null;
      if (onlySaleWindows && !sale) continue;

      const view = await this.supplyBuildingRepository.findSupplyView(source.id);
      if (!view) continue;
      if (onlyIfSet && view.collectedByHub !== true) continue;
      if (sale && matchesSchedule(sale.schedule, period)) continue;

      await this.supplyBuildingRepository.saveSupplyFlags(source.id, {
        collectedByHub: false,
      });
      cleared += 1;
    }

    return { sources: sources.length, cleared };
  }
}
