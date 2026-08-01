/**
 * Turn-boundary economy owned by the game tick (not scene.update).
 * Persists gameplay snapshot + runs accounting ProcessTurnBudget.
 */

import { getOrCreateCityAssetsContext } from './createCityAssetsContext.js';
import { getOrCreateAccountingContext } from './createAccountingContext.js';
import { getOrCreateConstructionContext } from './createConstructionContext.js';

/**
 * @param {object} params
 * @param {{ addGameItems: (row: object) => Promise<unknown> }} params.gameStore
 * @param {{ getCityPopulationSummary: () => Promise<{ totalPop?: number }> }} params.housing
 * @param {number} params.time
 * @returns {Promise<{ totalPop: number }>}
 */
export async function persistGameplayTurn({ gameStore, housing, time }) {
  const popSummary = await housing.getCityPopulationSummary();
  const totalPop = popSummary.totalPop ?? 0;
  const { totalValue } = await getOrCreateCityAssetsContext().getCityBuildingValuation();
  const totalImmoExpenses = totalValue || 0;

  await gameStore.addGameItems({
    name: time === 0 ? 'gameplay_init' : `gameplay_${time}`,
    turn: time,
    population: totalPop,
    maxPop: 5000,
    deads: 0,
    foodAvailable: 0,
    foodNeeded: 0,
    salaries: 0,
    salesTax: 0.2,
    citizenTax: 0.2,
    markets: 0,
    foodMarkets: 0,
    goodsMarkets: 0,
    goodsNeeded: 0,
    goodsAvailable: 0,
    foodSales: 0,
    goodSales: 0,
    lastImmoExpense: totalImmoExpenses || 0,
  });

  return { totalPop };
}

/**
 * @param {object} params
 * @param {{ size: number }} params.city
 * @param {object[][]} params.buildings
 * @param {number} params.time
 * @param {number} params.totalPop
 * @returns {Promise<object | undefined>}
 */
export async function processGameTurnBudget({ city, buildings, time, totalPop }) {
  getOrCreateConstructionContext().bindSceneBuildingGrid({ city, buildings });
  return getOrCreateAccountingContext().processTurnBudget({
    time,
    totalPop,
  });
}
