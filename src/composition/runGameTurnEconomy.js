/**
 * Turn-boundary economy owned by the game tick (not scene.update).
 * Persists gameplay snapshot + runs accounting ProcessTurnBudget.
 */

import { getOrCreateCityAssetsContext } from './createCityAssetsContext.js';
import { getOrCreateAccountingContext } from './createAccountingContext.js';
import { getOrCreateConstructionContext } from './createConstructionContext.js';
import { getOrCreateIntelligenceContext } from './createIntelligenceContext.js';
import { getOrCreateHousingContext } from './createHousingContext.js';
import { getOrCreateEmploymentContext } from './createEmploymentContext.js';
import { getOrCreateSupplyContext } from './createSupplyContext.js';
import { resolveGetTimeInfo } from './gameTimeBridge.js';
import { MONTHS_PER_YEAR } from '../shared/time/TimeCalendar.js';
import { getCumulativeDeaths } from './gameplayMortalityState.js';

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
    deads: getCumulativeDeaths(),
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
  const result = await getOrCreateAccountingContext().processTurnBudget({
    time,
    totalPop,
  });
  // The month's accounts are closed: inhabitants leave the houses whose distress the catalog names (a rent they cannot pay, ...).
  if (result?.monthSettled === true) {
    // The companies liquidated this month close: they let their workers go and their stock is gone (the journal has already sold it).
    for (const companyId of result.liquidated ?? []) {
      await getOrCreateEmploymentContext().closeWorkplace(companyId, time);
      await getOrCreateSupplyContext().clearStock(companyId);
    }
    const timeInfo = resolveGetTimeInfo()(time);
    await getOrCreateHousingContext().runMonthlyDepartures({
      monthKey: timeInfo.year * MONTHS_PER_YEAR + timeInfo.monthIndex,
      signals: { rentUnpaid: await getOrCreateAccountingContext().getRentArrearsMonths() },
    });
    // The houses left empty owe nothing any more: the owner knows it will not be paid (no prosecution in the game).
    await getOrCreateAccountingContext().writeOffVacantRentDebts({ time });
  }
  // November without a tax collector: a dépêche says so, once for the year (the modal shows it at the end of the tick).
  if (result?.citizenTaxUncollectedYear != null) {
    await getOrCreateIntelligenceContext().announceMilestone({
      milestoneId: 'tax-uncollected',
      turn: time,
      occurrence: result.citizenTaxUncollectedYear,
    });
  }
  return result;
}
