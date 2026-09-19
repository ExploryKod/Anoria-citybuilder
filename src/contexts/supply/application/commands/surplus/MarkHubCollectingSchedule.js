import { matchesSchedule } from '../../../domain/policies/ResourceSchedulePolicy.js';
import { getScheduleForRole } from '../../../domain/policies/ResourceRolePolicy.js';

/**
 * Command: set every hub's `isCollecting` (UI flag) from its own 'collector'
 * role schedule (see buildingEconomy.js) — whatever cadence the catalog
 * declares, no hardcoded month.
 */
export class MarkHubCollectingSchedule {
  /**
   * @param {import('../../ports/SupplyBuildingRepository.js').SupplyBuildingRepository} supplyBuildingRepository
   */
  constructor(supplyBuildingRepository) {
    this.supplyBuildingRepository = supplyBuildingRepository;
  }

  /**
   * @param {string} month
   * @returns {Promise<{ hubs: number, isCollecting: boolean }>}
   */
  async execute(month) {
    const hubs = await this.supplyBuildingRepository.findByResourceRole('hub');
    let isCollecting = false;

    for (const hub of hubs) {
      const schedule = getScheduleForRole(hub.type, 'collector');
      const hubIsCollecting = matchesSchedule(schedule, { month });
      isCollecting = isCollecting || hubIsCollecting;
      await this.supplyBuildingRepository.saveSupplyFlags(hub.id, {
        isCollecting: hubIsCollecting,
      });
    }

    return { hubs: hubs.length, isCollecting };
  }
}
