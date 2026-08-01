import { resolveHouseEvolution } from '../../../domain/policies/HouseEvolutionPolicy.js';

/**
 * Command: evaluate and persist house type evolution for one residential building.
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
   * @returns {Promise<{
   *   changed: boolean,
   *   houseId?: string,
   *   previousId?: string,
   *   previousType?: string,
   *   targetType?: string,
   *   previousPop?: number,
   *   targetPop?: number,
   *   reason?: string,
   * }>}
   */
  async execute({ houseId }) {
    const house = await this.repository.findById(houseId);
    if (!house) {
      return { changed: false, reason: 'house_not_found' };
    }

    const resolution = resolveHouseEvolution({
      type: house.type,
      pop: house.pop,
      roadCount: house.roadCount,
      stocks: house.stocks,
    });

    if (!resolution.changed) {
      return {
        changed: false,
        houseId,
        previousType: resolution.previousType,
        targetType: resolution.targetType,
        previousPop: resolution.previousPop,
        targetPop: resolution.targetPop,
        reason: resolution.reason,
      };
    }

    const { newId, previousId } = await this.repository.applyEvolution({
      oldId: house.id,
      targetType: resolution.targetType,
      targetPop: resolution.targetPop,
    });

    return {
      changed: true,
      houseId: newId,
      previousId,
      previousType: resolution.previousType,
      targetType: resolution.targetType,
      previousPop: resolution.previousPop,
      targetPop: resolution.targetPop,
      reason: resolution.reason,
    };
  }
}
