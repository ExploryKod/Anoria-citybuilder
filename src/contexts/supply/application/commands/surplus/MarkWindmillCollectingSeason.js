import { matchesSchedule } from '../../../domain/policies/ResourceSchedulePolicy.js';
import { getScheduleForRole } from '../../../domain/policies/ResourceRolePolicy.js';

/**
 * Command: set windmill `isCollecting` (UI flag) from its own 'collector'
 * role schedule (see buildingEconomy.js) — December today, whatever the
 * catalog declares tomorrow.
 */
export class MarkWindmillCollectingSeason {
  /**
   * @param {import('../../ports/SupplyBuildingRepository.js').SupplyBuildingRepository} supplyBuildingRepository
   */
  constructor(supplyBuildingRepository) {
    this.supplyBuildingRepository = supplyBuildingRepository;
  }

  /**
   * @param {string} month
   * @returns {Promise<{ windmills: number, isCollecting: boolean }>}
   */
  async execute(month) {
    const windmills = await this.supplyBuildingRepository.findWindmills();
    let isCollecting = false;

    for (const windmill of windmills) {
      const schedule = getScheduleForRole(windmill.type, 'collector');
      const windmillIsCollecting = matchesSchedule(schedule, { month });
      isCollecting = isCollecting || windmillIsCollecting;
      await this.supplyBuildingRepository.saveMarketFlags(windmill.id, {
        isCollecting: windmillIsCollecting,
      });
    }

    return { windmills: windmills.length, isCollecting };
  }
}
