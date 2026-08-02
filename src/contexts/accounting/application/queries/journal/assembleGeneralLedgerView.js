import {
  buildMonthlyFinancialSummary,
  buildYearlyFinancialSummary,
} from '../../../infrastructure/adapters/persistence/dexie/journalAggregations.js';
import {
  filterLedgerEntriesByTypes,
  orderGeneralLedgerEntries,
} from '../../../domain/policies/GeneralLedgerPresentationPolicy.js';
import {
  createGeneralLedgerEntry,
  createGeneralLedgerMonth,
  createGeneralLedgerYear,
} from '../../../domain/read-models/GeneralLedgerView.js';

/**
 * Application helper — assembles GeneralLedgerView from journal entries.
 * Totals always match visible entries (filtered or not).
 *
 * @param {object} params
 * @param {Array<object>} params.entries
 * @param {(turn: number) => object|null} params.getTimeInfo
 * @param {number} params.currentYear
 * @param {number} params.currentTreasuryBalance
 * @param {string[]|null|undefined} [params.types]
 */
export function assembleGeneralLedgerView({
  entries,
  getTimeInfo,
  currentYear,
  currentTreasuryBalance,
  types = null,
}) {
  const typeFilterActive = Boolean(types && types.length > 0);
  const monthlyData = buildMonthlyFinancialSummary(entries, getTimeInfo);
  const yearlyData = buildYearlyFinancialSummary(monthlyData);

  const years = yearlyData
    .map((yearData) => {
      const months = yearData.months
        .map((monthData) => {
          const incomeEntries = filterLedgerEntriesByTypes(
            monthData.income.entries,
            types
          );
          const expenseEntries = filterLedgerEntriesByTypes(
            monthData.expenses.entries,
            types
          );
          const orderedEntries = orderGeneralLedgerEntries(
            incomeEntries,
            expenseEntries
          ).map(createGeneralLedgerEntry);

          if (orderedEntries.length === 0) {
            return null;
          }

          const incomeTotal = incomeEntries.reduce((sum, e) => sum + e.amount, 0);
          const expensesTotal = expenseEntries.reduce(
            (sum, e) => sum + e.amount,
            0
          );

          return createGeneralLedgerMonth({
            year: monthData.year,
            month: monthData.month,
            monthName: monthData.monthName,
            incomeTotal,
            expensesTotal,
            netFlow: incomeTotal - expensesTotal,
            entries: orderedEntries,
          });
        })
        .filter(Boolean);

      if (months.length === 0) {
        return null;
      }

      const incomeTotal = months.reduce((sum, m) => sum + m.incomeTotal, 0);
      const expensesTotal = months.reduce((sum, m) => sum + m.expensesTotal, 0);
      const netFlow = incomeTotal - expensesTotal;
      const isCurrentYear = yearData.year === currentYear;

      return createGeneralLedgerYear({
        year: yearData.year,
        incomeTotal,
        expensesTotal,
        netFlow,
        isCurrentYear,
        treasuryBalance: isCurrentYear ? currentTreasuryBalance : null,
        months,
      });
    })
    .filter(Boolean);

  return {
    currentYear,
    currentTreasuryBalance,
    typeFilterActive,
    years,
  };
}
