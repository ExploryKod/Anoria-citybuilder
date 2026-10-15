import { incomeStatementOf } from '../../src/contexts/accounting/domain/policies/BuildingFinancePolicy.js';

/**
 * Test double of the settlement's `readCompanyYear` dep, for the tests that keep the lines a settlement writes in a plain array (the
 * `recordLedgerEntry` params: `type`, `amount`, `accountBuildingId`, `accountKind`): the same compte de résultat as the app's, over those
 * lines (a line with no year or month is taken as one of `year`, month 1).
 * @param {Array<{ type: string, amount: number, accountBuildingId?: string | null, accountKind?: string | null, year?: number, month?: number }>} journal
 * @param {number} [year]
 */
export function companyYearReaderOf(journal, year = 1) {
  return async (buildingId, _year, accountKind = null) => {
    const entries = journal.map((line) => ({ ...line, year: line.year ?? year, month: line.month ?? 1 }));
    // Every sale is read as a sale of goods: the account differs, the result does not.
    const statement = incomeStatementOf(entries, buildingId, { year, accountKind, salesNature: 'merchandise' });
    return {
      rcaiYearToDate: statement.results.current,
      taxPaidYearToDate: statement.sections.find((section) => section.id === 'profitTax').total,
    };
  };
}
