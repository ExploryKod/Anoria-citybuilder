/**
 * Behavior tests — financial statements (journal-primary, CR + bilan linked).
 */

import Dexie from 'dexie';
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { GetIncomeStatement } from '../../../src/contexts/accounting/application/queries/financial-statements/GetIncomeStatement.js';
import { GetBalanceSheet } from '../../../src/contexts/accounting/application/queries/financial-statements/GetBalanceSheet.js';
import {
  GetFinancialStatementsAtTurn,
  GetFinancialStatementsHistory,
  GetIncomeStatementForFiscalYear,
} from '../../../src/contexts/accounting/application/queries/financial-statements/GetFinancialStatementsAtTurn.js';
import { DexieJournalRepository } from '../../../src/contexts/accounting/infrastructure/adapters/persistence/dexie/DexieJournalRepository.js';
import { DexieTreasuryRepository } from '../../../src/contexts/accounting/infrastructure/adapters/persistence/dexie/DexieTreasuryRepository.js';
import { BudgetTurnEnrichmentRepository } from '../../../src/contexts/accounting/infrastructure/adapters/persistence/dexie/BudgetTurnEnrichmentRepository.js';
import { GetTreasurySnapshot } from '../../../src/contexts/accounting/application/queries/treasury/GetTreasurySnapshot.js';
import { InitializeTreasury } from '../../../src/contexts/accounting/application/commands/treasury/InitializeTreasury.js';
import { TreasuryLoanPortfolio } from '../../../src/contexts/accounting/application/services/TreasuryLoanPortfolio.js';
import { LegacyGameTimePort } from '../../../src/contexts/accounting/infrastructure/adapters/legacy/LegacyGameTimePort.js';
import { RecordCapitalFundsIncome } from '../../../src/contexts/accounting/application/services/RecordCapitalFundsIncome.js';
import { SessionJournalWriteAdapter } from '../../../src/contexts/accounting/infrastructure/adapters/persistence/session/SessionJournalWriteAdapter.js';
import { RecordLedgerEntry } from '../../../src/contexts/accounting/application/commands/journal/RecordLedgerEntry.js';
import { JournalManager } from '../../../src/js/acl/accountingSessionJournal.js';
import { resetSessionLedgerBufferForTests } from '../../../src/js/acl/accountingSessionJournal.js';

function createTestDb() {
  const testDb = new Dexie('testFinancialStatementsDb');
  testDb.version(1).stores({
    budget: 'name',
    journal: '++id, turn, date, type, amount, description',
  });
  return testDb;
}

class TestGameTimePort extends LegacyGameTimePort {
  getTimeInfo(turn) {
    const monthIndex = turn % 12;
    return { year: Math.floor(turn / 12), monthIndex, month: `M${monthIndex}` };
  }
}

class FakeCityAssetsPort {
  async getCityBuildingValuation() {
    return { totalValue: 300, pricesByType: { 'House-Blue': 30 } };
  }
}

describe('Accounting — financial statements (journal-primary)', () => {
  let testDb;
  let journalRepository;
  let gameTimePort;
  let getIncomeStatement;
  let getBalanceSheet;
  let getFinancialStatementsAtTurn;
  let getFinancialStatementsHistory;
  let treasuryRepository;

  beforeEach(async () => {
    resetSessionLedgerBufferForTests();
    testDb = createTestDb();
    await testDb.open();

    gameTimePort = new TestGameTimePort({});
    journalRepository = new DexieJournalRepository({ db: testDb, gameTimePort });

    const journalManager = new JournalManager();
    journalManager.db = testDb;
    const journalWritePort = new SessionJournalWriteAdapter(journalManager);
    const recordLedgerEntry = new RecordLedgerEntry(journalWritePort, gameTimePort);
    const recordCapitalFundsIncome = new RecordCapitalFundsIncome(recordLedgerEntry);

    treasuryRepository = new DexieTreasuryRepository({ db: testDb });
    const initializeTreasury = new InitializeTreasury(
      treasuryRepository,
      journalRepository,
      recordCapitalFundsIncome
    );
    const getTreasurySnapshot = new GetTreasurySnapshot(
      treasuryRepository,
      initializeTreasury
    );
    const treasuryLoanPortfolio = new TreasuryLoanPortfolio(
      treasuryRepository,
      getTreasurySnapshot
    );
    const budgetTurnEnrichmentRepository = new BudgetTurnEnrichmentRepository(testDb);

    getFinancialStatementsAtTurn = new GetFinancialStatementsAtTurn(
      journalRepository,
      gameTimePort,
      new FakeCityAssetsPort(),
      budgetTurnEnrichmentRepository,
      treasuryLoanPortfolio,
      getTreasurySnapshot
    );
    getFinancialStatementsHistory = new GetFinancialStatementsHistory(
      getFinancialStatementsAtTurn,
      journalRepository,
      getTreasurySnapshot
    );

    const getIncomeStatementForFiscalYear = new GetIncomeStatementForFiscalYear(
      journalRepository
    );
    getIncomeStatement = new GetIncomeStatement(getIncomeStatementForFiscalYear);
    getBalanceSheet = new GetBalanceSheet(getFinancialStatementsAtTurn, getTreasurySnapshot);

    await initializeTreasury.execute(500);

    const now = new Date().toISOString();
    await testDb.journal.bulkAdd([
      { turn: 0, date: now, type: 'capital_funds', amount: 500, description: 'Capital de départ' },
      { turn: 12, date: now, type: 'citizen_tax', amount: 200, description: 'Impôt' },
      { turn: 13, date: now, type: 'salary', amount: 100, description: 'Salaires' },
      { turn: 14, date: now, type: 'maintenance', amount: 50, description: 'Maintenance' },
      { turn: 14, date: now, type: 'balance', amount: 550, description: 'Solde trésorerie' },
    ]);

    const current = await treasuryRepository.getNormalizedBudgetRow();
    await treasuryRepository.saveBudgetRow({ ...current, turn: 14, funds: 550 });
  });

  afterEach(async () => {
    if (testDb) {
      await testDb.delete();
    }
  });

  test('GetIncomeStatement aggregates journal by fiscal year', async () => {
    const statement = await getIncomeStatement.execute({ fiscalYear: 1 });

    expect(statement.totalProducts).toBe(200);
    expect(statement.totalCharges).toBe(150);
    expect(statement.netResult).toBe(50);
  });

  test('GetBalanceSheet at current turn is journal-linked and balanced', async () => {
    const sheet = await getBalanceSheet.execute();

    expect(sheet.assets.cash).toBe(550);
    expect(sheet.assets.tangibleGross).toBe(300);
    expect(sheet.liabilities.shareCapital).toBe(500);
    expect(sheet.liabilities.netResult).toBe(50);
    expect(sheet.balanced).toBe(true);
    expect(sheet.assets.total).toBe(sheet.liabilities.total);
  });

  test('GetFinancialStatementsAtTurn links CR netResult to balance sheet', async () => {
    const bundle = await getFinancialStatementsAtTurn.execute(14);

    expect(bundle.incomeStatement.totalProducts).toBe(200);
    expect(bundle.incomeStatement.totalCharges).toBe(150);
    expect(bundle.incomeStatement.netResult).toBe(50);
    expect(bundle.balanceSheet.liabilities.netResult).toBe(bundle.incomeStatement.netResult);
    expect(bundle.balanceSheet.assets.cash).toBe(550);
    expect(bundle.atTurn).toBe(14);
  });

  test('GetFinancialStatementsHistory returns checkpoints including current turn', async () => {
    const bundles = await getFinancialStatementsHistory.execute({ everyNTurns: 3 });

    expect(bundles.length).toBeGreaterThan(0);
    const last = bundles[bundles.length - 1];
    expect(last.atTurn).toBe(14);
    expect(last.balanceSheet.liabilities.netResult).toBe(last.incomeStatement.netResult);
  });

  test('enrichment cache supplements UI fields without affecting CR totals', async () => {
    await testDb.budget.put({
      name: 'budget_turn_14',
      turn: 14,
      funds: 550,
      population: 42,
      taxBreakdown: { 'House-Blue': 100 },
      loanDebt: 0,
      date: new Date().toISOString(),
    });

    const bundle = await getFinancialStatementsAtTurn.execute(14);

    expect(bundle.source).toBe('journal+cache');
    expect(bundle.enrichment?.population).toBe(42);
    expect(bundle.incomeStatement.netResult).toBe(50);
    expect(bundle.balanceSheet.liabilities.netResult).toBe(50);
  });
});
