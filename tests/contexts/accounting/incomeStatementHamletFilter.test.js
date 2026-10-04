import { describe, expect, test } from '@jest/globals';
import { GetFinancialStatementsAtTurn } from '../../../src/contexts/accounting/application/queries/financial-statements/GetFinancialStatementsAtTurn.js';

const ENTRIES = [
  { id: 1, hamletId: 'hamlet-a', turn: 1, date: '2026-01-02', type: 'citizen_tax', amount: 10, month: 1, year: 2026, description: 'A' },
  { id: 2, hamletId: 'hamlet-b', turn: 1, date: '2026-01-02', type: 'citizen_tax', amount: 20, month: 1, year: 2026, description: 'B' },
];

function statementsQuery() {
  return new GetFinancialStatementsAtTurn(
    { getJournalEntries: async () => ENTRIES },
    { getTimeInfo: () => ({ year: 2026, monthIndex: 0 }) },
    { getCityBuildingValuation: async () => 0 },
    { getEnrichmentAtTurn: async () => null },
    { getActiveLoans: async () => [] },
    { execute: async () => ({ turn: 5 }) }
  );
}

describe('income statement hamlet filter', () => {
  test('a hamlet restricts the income statement and leaves the balance sheet city-wide', async () => {
    const query = statementsQuery();

    const city = await query.execute(5);
    const hamlet = await query.execute(5, { hamletId: 'hamlet-a' });

    expect(hamlet.incomeStatement).not.toEqual(city.incomeStatement);
    expect(hamlet.balanceSheet).toEqual(city.balanceSheet);
  });
});
