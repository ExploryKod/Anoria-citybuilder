import { resolveHouseEvolution } from '../../../domain/policies/HouseEvolutionPolicy.js';
import { resolveHouseLevel } from '../../../domain/policies/HouseLevelPolicy.js';
import { isPalaceHouseType } from '../../../domain/policies/HouseCapacityPolicy.js';

/**
 * Command: evaluate and persist house progression for one residential building.
 *
 * - Palace (`House-2Story`): frozen legacy path — `resolveHouseEvolution`
 *   (color ladder), unchanged. // TODO(elites)
 * - Blue/Red/Purple: `HouseLevelPolicy` — color is permanent, only `level`
 *   (1 <-> 2) evolves.
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
   *   previousLevel?: 1 | 2,
   *   targetLevel?: 1 | 2,
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

    if (isPalaceHouseType(house.type)) {
      return this.#executePalaceEvolution(house);
    }

    return this.#executeLevelResolution(house);
  }

  /** @param {import('../../../domain/HousingBuildingSnapshot.js').HousingBuildingSnapshot} house */
  async #executePalaceEvolution(house) {
    const resolution = resolveHouseEvolution({
      type: house.type,
      pop: house.pop,
      roadCount: house.roadCount,
      stocks: house.stocks,
    });

    if (!resolution.changed) {
      return {
        changed: false,
        houseId: house.id,
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

  /** @param {import('../../../domain/HousingBuildingSnapshot.js').HousingBuildingSnapshot} house */
  async #executeLevelResolution(house) {
    const resolution = resolveHouseLevel({
      level: house.level,
      pop: house.pop,
      roadCount: house.roadCount,
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
    };
  }
}
