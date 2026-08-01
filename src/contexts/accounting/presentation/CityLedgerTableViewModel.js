import { splitBalanceIntoBenefitAndDeficit } from '../domain/policies/CityLedgerNetColumnsPolicy.js';

/**
 * Label suffixes for the net-flow row (César 3 livret).
 *
 * @param {number} thisYearNetFlow
 * @param {number} lastYearNetFlow
 */
export function cityLedgerNetFlowLabelSuffixes(thisYearNetFlow, lastYearNetFlow) {
  /** @type {string[]} */
  const suffixes = [];

  if (lastYearNetFlow < 0) {
    suffixes.push('n-1: déficit');
  } else if (lastYearNetFlow > 0) {
    suffixes.push('n-1: bénéfice');
  }

  if (thisYearNetFlow < 0) {
    suffixes.push('n: déficit');
  } else if (thisYearNetFlow > 0) {
    suffixes.push('n: bénéfice');
  }

  return suffixes;
}

/**
 * @param {import('../domain/read-models/CityLedgerComparison.js').CityLedgerComparison} comparison
 */
export function buildCityLedgerTableViewModel(comparison) {
  const { thisYear, lastYear, twoYearsAgo } = comparison;
  const lastYearSplit = splitBalanceIntoBenefitAndDeficit(lastYear.balance);
  const twoYearsAgoSplit = splitBalanceIntoBenefitAndDeficit(twoYearsAgo.balance);

  return {
    thisYear,
    lastYear,
    twoYearsAgo,
    benefitLastYear: lastYearSplit.benefit,
    deficitLastYear: lastYearSplit.deficit,
    twoYearsAgoBenefit: twoYearsAgoSplit.benefit,
    twoYearsAgoDeficit: twoYearsAgoSplit.deficit,
    netFlowLabelSuffixes: cityLedgerNetFlowLabelSuffixes(thisYear.netFlow, lastYear.netFlow),
    debt: comparison.debt,
    message: comparison.message,
  };
}
