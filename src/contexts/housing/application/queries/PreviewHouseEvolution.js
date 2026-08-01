import {
  canEvolveToPurple,
  canEvolveToPalace,
} from '../../domain/policies/HouseEvolutionPolicy.js';
import { countAvailableCropTypes } from '../../domain/policies/FoodAffluencePolicy.js';

/**
 * Query: preview next evolution step for info panel (no persistence).
 */
export class PreviewHouseEvolution {
  /**
   * @param {object} params
   * @param {import('../../domain/value-objects/FoodStocks.js').FoodStocks | null | undefined} params.stocks
   * @param {number} params.population
   * @param {string} params.buildingType
   * @param {boolean} params.hasRoadAccess
   * @returns {{
   *   toPurple: { canEvolve: boolean, reason?: string },
   *   toPalace: { canEvolve: boolean, reason?: string },
   *   availableCropTypesCount: number,
   * }}
   */
  execute({ stocks, population, buildingType, hasRoadAccess }) {
    return {
      toPurple: canEvolveToPurple({
        stocks,
        population,
        buildingType,
        hasRoadAccess,
      }),
      toPalace: canEvolveToPalace({
        stocks,
        population,
        buildingType,
      }),
      availableCropTypesCount: countAvailableCropTypes(stocks),
    };
  }
}
