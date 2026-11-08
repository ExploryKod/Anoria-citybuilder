/**
 * Turn-boundary economy owned by the game tick (not scene.update).
 * Persists gameplay snapshot + runs accounting ProcessTurnBudget.
 */

import { getOrCreateCityAssetsContext } from './createCityAssetsContext.js';
import { getOrCreateAccountingContext } from './createAccountingContext.js';
import { getOrCreateConstructionContext } from './createConstructionContext.js';
import { getOrCreateIntelligenceContext } from './createIntelligenceContext.js';
import { getOrCreateHousingContext } from './createHousingContext.js';
import { resolveGetTimeInfo } from './gameTimeBridge.js';
import { MONTHS_PER_YEAR } from '../shared/time/TimeCalendar.js';
import { LINE_LABELS } from '../contexts/accounting/application/services/DebtLines.js';
import { tickPerfEnabled } from '../core/diagnostics/tickPerf.js';
import { DexieCityTradeRepository } from '../contexts/geography/infrastructure/dexie/DexieCityTradeRepository.js';
import { STATE_ARREARS_KINDS } from '../shared/accounting-catalog/StateArrearsCatalog.js';
import { getOrCreateGameplayContext } from './createGameplayContext.js';
import { getOrCreateSupplyContext } from './createSupplyContext.js';
import { ANNOUNCED_PHASES } from '../shared/climate/ClimateCatalog.js';
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
    const afterMonthStartedAt = performance.now();
    const timeInfo = resolveGetTimeInfo()(time);
    const rentArrearsMonths = await getOrCreateAccountingContext().getRentArrearsMonths();
    const rentArrearsMs = performance.now() - afterMonthStartedAt;
    await getOrCreateHousingContext().runMonthlyDepartures({
      monthKey: timeInfo.year * MONTHS_PER_YEAR + timeInfo.monthIndex,
      signals: { rentUnpaid: rentArrearsMonths },
    });
    const departuresMs = performance.now() - afterMonthStartedAt - rentArrearsMs;
    // The houses left empty owe nothing any more: the owner knows it will not be paid (no prosecution in the game).
    await getOrCreateAccountingContext().writeOffVacantRentDebts({ time });
    // A city with no money left, that trades with a partner city, is offered a gift by it (once per game): the player is told and answers from the dépêche.
    const partnerIds = (await new DexieCityTradeRepository().getActiveRelations()).map((relation) => relation.cityId);
    const gift = await getOrCreateAccountingContext().offerBenefactorGift({ time, partnerIds });
    if (gift) await getOrCreateIntelligenceContext().announceMilestone({ milestoneId: 'benefactor-gift', turn: time, params: gift });
    // A year that is not an ordinary one is told when it opens: the fields will yield what it lets them (src/shared/climate).
    if (timeInfo.monthIndex === 0) {
      const climate = await getOrCreateSupplyContext().getClimateOfYear(timeInfo.year);
      if (ANNOUNCED_PHASES.includes(climate.phase)) {
        await getOrCreateIntelligenceContext().announceMilestone({ milestoneId: 'climate-year', turn: time, occurrence: timeInfo.year, params: { year: timeInfo.year, phase: climate.phase, harvestFactor: climate.harvestFactor } });
      }
    }
    // The buildings whose upkeep was not paid this month wear, and the ones worn out may collapse (docs/gameplay/PLAN_COLLAPSE.md).
    await getOrCreateGameplayContext().wearBuildings.execute({ neglected: result.neglectedBuildings ?? [] });
    // A bank whose losses ate its capital keeps running, and the player is told once a month what he can do (recapitalise it, or liquidate it).
    const solvency = await getOrCreateAccountingContext().getBankSolvency();
    // Before that, the supervisor: a bank thin on capital is warned, then has its lending frozen, once a month, so the player can act before it is insolvent.
    if (solvency && ['warning', 'frozen'].includes(solvency.capitalStatus)) {
      await getOrCreateIntelligenceContext().announceMilestone({
        milestoneId: 'bank-capital',
        turn: time,
        occurrence: timeInfo.year * MONTHS_PER_YEAR + timeInfo.monthIndex,
        params: { bankType: solvency.bankType, centralBankType: getOrCreateAccountingContext().getCentralBankType(), status: solvency.capitalStatus, ratio: solvency.ratio },
      });
    }
    if (solvency?.insolvent) {
      await getOrCreateIntelligenceContext().announceMilestone({
        milestoneId: 'bank-insolvent',
        turn: time,
        occurrence: timeInfo.year * MONTHS_PER_YEAR + timeInfo.monthIndex,
        params: { bankType: solvency.bankType, centralBankType: getOrCreateAccountingContext().getCentralBankType(), equity: solvency.equity },
      });
    }
    if (tickPerfEnabled()) {
      const steps = { ...result.stepMs, rentArrears: rentArrearsMs, departures: departuresMs, writeOffRents: performance.now() - afterMonthStartedAt - rentArrearsMs - departuresMs };
      console.info(`[tick-perf] month-end day=${time} ${Object.entries(steps).map(([step, ms]) => `${step}=${ms.toFixed(1)}`).join(' ')}`);
    }
  }
  // A month the State could not pay what it owed (its Treasury was empty): a dépêche says what stayed unpaid, once for the month.
  if (result?.stateUnpaid) {
    const timeInfo = resolveGetTimeInfo()(time);
    await getOrCreateIntelligenceContext().announceMilestone({
      milestoneId: 'state-unpaid',
      turn: time,
      occurrence: timeInfo.year * MONTHS_PER_YEAR + timeInfo.monthIndex,
      params: {
        items: Object.entries(result.stateUnpaid).map(([kind, amount]) => {
          if (!LINE_LABELS[kind]) throw new Error(`[treasury] the State's payment "${kind}" has no label: what stayed unpaid cannot be announced`);
          // Carried: what the State will still pay (its arrears, or the capital a new company waits for); otherwise the payment is lost for good.
          return { label: LINE_LABELS[kind], amount, carried: Boolean(STATE_ARREARS_KINDS[kind]) || kind === 'company_capital_paid' };
        }),
      },
    });
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
