import { checkFoodAffluence } from '../../domain/policies/FoodAffluencePolicy.js';

/**
 * Query: food affluence at one house (stocks vs population).
 *
 * Pure read — no repository. Used by legacy UI (food icons, evolution panel).
 * Supply owns stock writes; Housing owns pop-relative interpretation.
 *
 * @see ../../docs/food-affluence.md
 */
export class EvaluateHouseFoodAffluence {
  /**
   * @param {object} params
   * @param {import('../../domain/value-objects/FoodStocks.js').FoodStocks | null | undefined} params.stocks
   * @param {number} [params.population=0]
   * @returns {{
   *   hasFood: boolean,
   *   totalFood: number,
   *   netFood: number,
   *   meetsFoodGoal: boolean,
   *   isInsufficient: boolean,
   * }}
   */
  execute({ stocks, population = 0 }) {
    return checkFoodAffluence(stocks, population);
  }
}
