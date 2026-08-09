import { computePopulationAfterGrowth } from '../../../domain/policies/PopulationGrowthPolicy.js';
import {
  computeMonthlyFamineDeathsAtHouse,
  didHouseGoHungryLastConsumption,
} from '../../../domain/policies/FamineConsequencesPolicy.js';

/**
 * Command: apply monthly population growth (and optional famine mortality) for one house.
 */
export class GrowHousePopulation {
  /**
   * @param {import('../../ports/HousingBuildingRepository.js').HousingBuildingRepository} housingBuildingRepository
   */
  constructor(housingBuildingRepository) {
    this.repository = housingBuildingRepository;
  }

  /**
   * @param {object} params
   * @param {string} params.houseId
   * @param {number} params.monthIndex
   * @param {boolean} [params.applyFamineLimits=false]
   * @returns {Promise<{
   *   changed: boolean,
   *   houseId?: string,
   *   pop?: number,
   *   previousPop?: number,
   *   reason?: string,
   *   deaths?: number,
   * }>}
   */
  async execute({ houseId, monthIndex, applyFamineLimits = false }) {
    const house = await this.repository.findById(houseId);
    if (!house) {
      return { changed: false, reason: 'house_not_found', deaths: 0 };
    }

    const previousPop = house.pop;
    let deaths = 0;
    let workingPop = previousPop;

    if (applyFamineLimits && didHouseGoHungryLastConsumption(house.lastConsumption)) {
      if (house.lastFamineDeathMonth !== monthIndex) {
        deaths = computeMonthlyFamineDeathsAtHouse({
          pop: workingPop,
          lastConsumption: house.lastConsumption,
        });
        if (deaths > 0) {
          workingPop = Math.max(0, workingPop - deaths);
          await this.repository.savePopulation(houseId, {
            pop: workingPop,
            lastPopulationGrowthMonth: house.lastPopulationGrowthMonth,
            lastFamineDeathMonth: monthIndex,
          });
        } else {
          await this.repository.savePopulation(houseId, {
            pop: workingPop,
            lastPopulationGrowthMonth: house.lastPopulationGrowthMonth,
            lastFamineDeathMonth: monthIndex,
          });
        }
      }

      return {
        changed: deaths > 0 || workingPop !== previousPop,
        houseId,
        pop: workingPop,
        previousPop,
        reason: 'famine_blocked_growth',
        deaths,
      };
    }

    const outcome = computePopulationAfterGrowth({
      type: house.type,
      level: house.level,
      currentPop: workingPop,
      roadCount: house.roadCount,
      monthIndex,
      lastPopulationGrowthMonth: house.lastPopulationGrowthMonth,
    });

    if (!outcome.changed) {
      return {
        changed: false,
        houseId,
        pop: workingPop,
        reason: outcome.reason,
        deaths: 0,
      };
    }

    await this.repository.savePopulation(houseId, {
      pop: outcome.pop,
      lastPopulationGrowthMonth: outcome.lastPopulationGrowthMonth,
    });

    return {
      changed: true,
      houseId,
      pop: outcome.pop,
      previousPop,
      reason: outcome.reason,
      deaths: 0,
    };
  }
}
