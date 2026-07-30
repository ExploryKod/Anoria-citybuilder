import { createFinancialStatusMessage } from '../value-objects/FinancialStatusMessage.js';

/**
 * Domain policy — financial status message from city-ledger year balances.
 *
 * @param {import('../value-objects/CityLedgerYearLines.js').CityLedgerYearLines} thisYear
 * @param {import('../value-objects/CityLedgerYearLines.js').CityLedgerYearLines} lastYear
 * @returns {import('../value-objects/FinancialStatusMessage.js').FinancialStatusMessage}
 */
export function financialStatusMessageForCityLedger(thisYear, lastYear) {
  if (thisYear.balance < 0) {
    return createFinancialStatusMessage({
      text: "La ville fonctionne avec un déficit cette année. Il est recommandé d'augmenter les revenus ou de réduire les dépenses.",
      type: 'danger',
    });
  }

  if (thisYear.balance > lastYear.balance) {
    return createFinancialStatusMessage({
      text: "La situation financière s'améliore par rapport à l'année dernière.",
      type: 'success',
    });
  }

  return createFinancialStatusMessage({
    text: 'La situation financière est stable.',
    type: 'info',
  });
}

/**
 * Domain policy — which balance applies to a fiscal year in the city-ledger.
 *
 * @param {object|null|undefined} journalYearSummary
 * @param {number} treasuryBalance — used only for the current fiscal year
 * @param {boolean} isCurrentYear
 */
export function cityLedgerBalanceForYear(
  journalYearSummary,
  treasuryBalance,
  isCurrentYear
) {
  if (isCurrentYear) {
    return treasuryBalance;
  }
  if (
    journalYearSummary &&
    journalYearSummary.netFlow !== undefined &&
    journalYearSummary.income &&
    journalYearSummary.expenses
  ) {
    return journalYearSummary.netFlow;
  }
  return 0;
}
