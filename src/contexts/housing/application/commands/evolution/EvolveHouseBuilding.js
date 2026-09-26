import { resolveHouseLevel } from '../../../domain/policies/HouseLevelPolicy.js';
import { residentialGroupForHouseType } from '../../../domain/policies/GroupSkillPolicy.js';

/**
 * Command: evaluate and persist house progression for one residential building.
 *
 * `HouseLevelPolicy` — the house's color (its social category) is permanent,
 * only `level` evolves.
 */
export class EvolveHouseBuilding {
  /**
   * @param {import('../../ports/HousingBuildingRepository.js').HousingBuildingRepository} housingBuildingRepository
   */
  constructor(housingBuildingRepository) {
    this.repository = housingBuildingRepository;
  }

  /**
   * @param {object} params
   * @param {string} params.houseId
   * @param {number} [params.periodKey] Current month index — only needed by
   *   tiers with a `serviceCoverage` requirement (see HouseLevelPolicy.js).
   * @returns {Promise<{
   *   changed: boolean,
   *   houseId?: string,
   *   previousId?: string,
   *   previousType?: string,
   *   targetType?: string,
   *   previousLevel?: 1 | 2,
   *   targetLevel?: 1 | 2,
   *   previousPop?: number,
   *   targetPop?: number,
   *   reason?: string,
   * }>}
   */
  async execute({ houseId, periodKey }) {
    const house = await this.repository.findById(houseId);
    if (!house) {
      return { changed: false, reason: 'house_not_found' };
    }

    return this.#executeLevelResolution(house, periodKey);
  }

  /**
   * @param {import('../../../domain/HousingBuildingSnapshot.js').HousingBuildingSnapshot} house
   * @param {number} [periodKey]
   */
  async #executeLevelResolution(house, periodKey) {
    const resolution = resolveHouseLevel({
      level: house.level,
      pop: house.pop,
      roadCount: house.roadCount,
      residentialGroup: residentialGroupForHouseType(house.type),
      servedFlags: house.servedFlags,
      lastConsumption: house.lastConsumption,
      periodKey,
    });

    if (!resolution.changed) {
      return {
        changed: false,
        houseId: house.id,
        previousType: house.type,
        targetType: house.type,
        previousLevel: resolution.previousLevel,
        targetLevel: resolution.targetLevel,
        previousPop: resolution.previousPop,
        targetPop: resolution.targetPop,
        reason: resolution.reason,
      };
    }

    await this.repository.applyLevelChange({
      houseId: house.id,
      targetLevel: resolution.targetLevel,
      targetPop: resolution.targetPop,
    });

    return {
      changed: true,
      houseId: house.id,
      previousId: house.id,
      previousType: house.type,
      targetType: house.type,
      previousLevel: resolution.previousLevel,
      targetLevel: resolution.targetLevel,
      previousPop: resolution.previousPop,
      targetPop: resolution.targetPop,
      reason: resolution.reason,
      unmetRequirements: resolution.unmetRequirements,
    };
  }
}
