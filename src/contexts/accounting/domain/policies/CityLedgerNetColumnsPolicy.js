import { createCityLedgerYearLines } from '../value-objects/CityLedgerYearLines.js';

/**
 * Split a fiscal-year balance into benefit (positive) and deficit (absolute negative).
 *
 * @param {number} balance
 */
export function splitBalanceIntoBenefitAndDeficit(balance) {
  const value = balance || 0;
  return {
    benefit: value > 0 ? value : 0,
    deficit: value < 0 ? Math.abs(value) : 0,
  };
}

/**
 * Net columns for one fiscal year, rolling prior-year balance into income/expense nets.
 *
 * @param {import('../value-objects/CityLedgerYearLines.js').CityLedgerYearLines} yearLines
 * @param {number} priorYearBalance
 */
export function cityLedgerNetTotalsForYear(yearLines, priorYearBalance) {
  const { benefit, deficit } = splitBalanceIntoBenefitAndDeficit(priorYearBalance);
  const netIncome = yearLines.totalIncome + benefit;
  const netExpenses = yearLines.totalExpenses + deficit;
  return {
    priorYearBenefit: benefit,
    priorYearDeficit: deficit,
    netIncome,
    netExpenses,
    netFlow: netIncome - netExpenses,
  };
}

/**
 * @param {import('../value-objects/CityLedgerYearLines.js').CityLedgerYearLines} yearLines
 * @param {number} priorYearBalance
 */
export function enrichCityLedgerYearLinesWithNetColumns(yearLines, priorYearBalance) {
  const nets = cityLedgerNetTotalsForYear(yearLines, priorYearBalance);
  return createCityLedgerYearLines({
    ...yearLines,
    netIncome: Math.round(nets.netIncome),
    netExpenses: Math.round(nets.netExpenses),
    netFlow: Math.round(nets.netFlow),
  });
}
