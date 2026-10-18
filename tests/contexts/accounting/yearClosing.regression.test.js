/**
 * Regression: purging old years must not change the treasury, the years' sub-totals, or an open loan.
 * (A purge once removed the lines of the old years, and the treasury, derived from the journal, dropped with them.)
 */
import { describe, test, expect } from '@jest/globals';
import sessionJournalStore, { resetSessionLedgerBufferForTests } from '../../../src/composition/accountingSessionJournal.js';
import { getTreasurySnapshot, resetAccountingContextForTests } from '../../../src/composition/accountingOps.js';
import { getOrCreateAccountingContext } from '../../../src/composition/createAccountingContext.js';
import { useGameTurnForTests } from '../../../src/composition/sessionRuntime.js';

describe('year closing — a purge keeps the treasury, the sub-totals and the open loans', () => {
  test('after purging eight years, the balance, a closed year and the loan are unchanged', async () => {
    resetSessionLedgerBufferForTests();
    resetAccountingContextForTests();
    getOrCreateAccountingContext({});

    await sessionJournalStore.addJournalEntry(0, 'capital_funds', 500, 'Capital', null, { businessKey: 'capital_funds:0' });
    await sessionJournalStore.addJournalEntry(2, 'loan_capital', 300, 'Prêt', null, {
      loanId: 'loan_1',
      loan: { id: 'loan_1', type: 'bank', remainingTurns: 90 },
    });
    for (let year = 0; year < 8; year += 1) {
      await sessionJournalStore.addJournalEntry(year * 12 + 3, 'payroll_tax', 100, 'impôt');
      await sessionJournalStore.addJournalEntry(year * 12 + 5, 'salary', 60, 'salaire');
    }
    useGameTurnForTests(8 * 12);

    const balanceBefore = (await getTreasurySnapshot()).funds;
    const yearOneBefore = (await sessionJournalStore.getYearlyFinancialSummary()).find((y) => y.year === 1);
    const loansBefore = (await getTreasurySnapshot()).loans;

    const result = await sessionJournalStore.cleanupOldJournalYears(5);
    expect(result.closed).toBeGreaterThan(0);

    const snapshot = await getTreasurySnapshot();
    expect(snapshot.funds).toBe(balanceBefore);
    expect(snapshot.loans).toEqual(loansBefore);

    const yearOneAfter = (await sessionJournalStore.getYearlyFinancialSummary()).find((y) => y.year === 1);
    expect(yearOneAfter.income.total).toBe(yearOneBefore.income.total);
    expect(yearOneAfter.expenses.total).toBe(yearOneBefore.expenses.total);
    expect(yearOneAfter.netFlow).toBe(yearOneBefore.netFlow);
  });

  test('a purge moves neither the city\'s balance nor a company\'s: each account is closed apart', async () => {
    resetSessionLedgerBufferForTests();
    resetAccountingContextForTests();
    const accounting = getOrCreateAccountingContext({});

    await sessionJournalStore.addJournalEntry(0, 'capital_funds', 500, 'Capital', null, { businessKey: 'capital_funds:0' });
    for (let year = 0; year < 8; year += 1) {
      await sessionJournalStore.addJournalEntry(year * 12 + 3, 'payroll_tax', 100, 'impôt');
      await sessionJournalStore.addJournalEntry(year * 12 + 4, 'producer_revenue', 80, 'ventes', null, { accountBuildingId: 'farm' });
      await sessionJournalStore.addJournalEntry(year * 12 + 5, 'corporate_tax', 12, 'IS', null, { accountBuildingId: 'farm' });
    }
    useGameTurnForTests(8 * 12);

    const cityBefore = (await getTreasurySnapshot()).funds;
    const farmBefore = await accounting.getBuildingAccountBalance('farm');

    const result = await sessionJournalStore.cleanupOldJournalYears(5);
    expect(result.closed).toBeGreaterThan(0);

    expect((await getTreasurySnapshot()).funds).toBe(cityBefore);
    expect(await accounting.getBuildingAccountBalance('farm')).toBe(farmBefore);
  });
});
