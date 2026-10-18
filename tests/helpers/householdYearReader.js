import { buildingFinanceFigures } from '../../src/contexts/accounting/domain/policies/BuildingFinancePolicy.js';

/**
 * Test double of the settlement's `readHouseholdYear` dep, for the tests that keep the lines a settlement writes in a plain array: the same
 * income and withheld tax as the app reads off a household's personal account (a line with no year or month is taken as one of `year`, month 1).
 * @param {Array<{ type: string, amount: number, accountBuildingId?: string | null, accountKind?: string | null, year?: number, month?: number }>} journal
 * @param {number} [year]
 */
export function householdYearReaderOf(journal, year = 1) {
  return async (houseId) => {
    const entries = journal.map((line) => ({ ...line, year: line.year ?? year, month: line.month ?? 1 }));
    const figures = buildingFinanceFigures(entries, houseId, { year, accountKind: 'particulier', salesNature: null });
    return {
      incomeYearToDate:
        figures.wagesReceived + figures.publicWageReceived + figures.benefitReceived + figures.participationReceived + figures.dividendReceived - figures.employeeContributionPaid,
      taxWithheldYearToDate: Math.round((figures.incomeTax - figures.incomeTaxRefunded) * 100) / 100,
    };
  };
}
