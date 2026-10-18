import { resolveHouseLevel } from '../../../domain/policies/HouseLevelPolicy.js';
import { residentialGroupForHouseType } from '../../../domain/policies/GroupSkillPolicy.js';
import { getResourceRoles } from '../../../../../shared/building-catalog/resourceRoleQueries.js';

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
    /**
     * Whether a warehouse is within reach of a house's activity — Supply's to say, and Supply is built after Housing, so the
     * composition registers the answer (`setActivityAccessCheck`). Asked before that, it throws: never a quiet "no access".
     * @type {((house: object) => Promise<boolean>) | null}
     */
    this.activityAccessCheck = null;
  }

  /** @param {(house: object) => Promise<boolean>} check */
  setActivityAccessCheck(check) {
    this.activityAccessCheck = check;
  }

  /**
   * The latest record of every need the house consumes, by the field the catalog names it under (`outcomeField` of its
   * consumer roles) — what the tiers' `serviceDemandMet` and `goodsVariety` requirements read.
   */
  #outcomesOf(house) {
    const fields = getResourceRoles(house.type).filter((entry) => entry.role === 'consumer' && entry.outcomeField).map((entry) => entry.outcomeField);
    return Object.fromEntries(fields.map((field) => [field, house[field]]));
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

  async #activityAccessOf(house) {
    if (!this.activityAccessCheck) throw new Error('[housing] the activity-access check was never set: the composition must register it');
    return this.activityAccessCheck(house);
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
      outcomes: this.#outcomesOf(house),
      activityAccess: await this.#activityAccessOf(house),
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
