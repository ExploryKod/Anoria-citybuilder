/**
 * Behavior tests — SaveBudgetTurnEnrichment command (budget_turn_* UI cache).
 */

import Dexie from 'dexie';
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { BudgetTurnEnrichmentRepository } from '../../../src/contexts/accounting/infrastructure/adapters/persistence/dexie/BudgetTurnEnrichmentRepository.js';
import { DexieTreasuryRepository } from '../../../src/contexts/accounting/infrastructure/adapters/persistence/dexie/DexieTreasuryRepository.js';
import { GetTreasurySnapshot } from '../../../src/contexts/accounting/application/queries/treasury/GetTreasurySnapshot.js';
import { GetFinancialHealth } from '../../../src/contexts/accounting/application/queries/treasury/GetFinancialHealth.js';
import { SaveBudgetTurnEnrichment } from '../../../src/contexts/accounting/application/commands/budget-turn-enrichment/SaveBudgetTurnEnrichment.js';
import { buildBudgetTurnEnrichmentSnapshot } from '../../../src/contexts/accounting/domain/policies/BudgetTurnEnrichmentPolicy.js';
import { InitializeTreasury } from '../../../src/contexts/accounting/application/commands/treasury/InitializeTreasury.js';
import { SessionJournalRepository } from '../../../src/contexts/accounting/infrastructure/adapters/persistence/session/SessionJournalRepository.js';
import { JournalManager } from '../../../src/js/acl/accountingSessionJournal.js';
import { resetSessionLedgerBufferForTests } from '../../../src/js/acl/accountingSessionJournal.js';

function createTestDb() {
  const testDb = new Dexie('testBudgetTurnEnrichmentDb');
  testDb.version(1).stores({
    budget: 'name',
    journal: '++id, turn, date, type, amount, description',
  });
  return testDb;
}

describe('Accounting — SaveBudgetTurnEnrichment', () => {
  let testDb;
  let enrichmentRepository;
  let saveBudgetTurnEnrichment;

  beforeEach(async () => {
    resetSessionLedgerBufferForTests();
    testDb = createTestDb();
    await testDb.open();

    const treasuryRepository = new DexieTreasuryRepository({ db: testDb });
    enrichmentRepository = new BudgetTurnEnrichmentRepository(testDb);
    const getTreasurySnapshot = new GetTreasurySnapshot(treasuryRepository);
    const getFinancialHealth = new GetFinancialHealth(getTreasurySnapshot);
    saveBudgetTurnEnrichment = new SaveBudgetTurnEnrichment(
      enrichmentRepository,
      getTreasurySnapshot,
      getFinancialHealth
    );

    const journalManager = new JournalManager();
    journalManager.db = testDb;
    const journalRepository = new SessionJournalRepository({
      sessionJournalStore: journalManager,
      gameTimePort: { getTimeInfo: () => ({ year: 0, monthIndex: 0, month: 'Janvier' }) },
    });
    const initializeTreasury = new InitializeTreasury(
      treasuryRepository,
      journalRepository,
      { execute: async () => {} }
    );
    await initializeTreasury.execute(500);
  });

  afterEach(async () => {
    await testDb.delete();
    await testDb.close();
  });

  test('buildBudgetTurnEnrichmentSnapshot copies treasury fields and game enrichment', () => {
    const snapshot = buildBudgetTurnEnrichmentSnapshot({
      turn: 6,
      treasurySnapshot: {
        funds: 420,
        income: 100,
        expenses: 40,
        netFlow: 60,
        dailyIncome: 10,
        dailyExpenses: 4,
        totalTaxes: 30,
        totalBuildingMaintenance: 12,
        totalInvestments: 8,
        totalLoanInterestExpenses: 5,
        totalLoanRepayments: 2,
        taxBreakdown: { citizen: 30 },
        maintenanceBreakdown: { roads: 12 },
      },
      financialHealth: { status: 'healthy', message: 'OK' },
      additionalData: { population: 25, buildingCounts: { houses: 3 } },
    });

    expect(snapshot.turn).toBe(6);
    expect(snapshot.funds).toBe(420);
    expect(snapshot.population).toBe(25);
    expect(snapshot.buildingCounts).toEqual({ houses: 3 });
    expect(snapshot.financialHealth.status).toBe('healthy');
  });

  test('SaveBudgetTurnEnrichment persists budget_turn row in Dexie', async () => {
    const row = await saveBudgetTurnEnrichment.execute({
      turn: 9,
      additionalData: { population: 12, buildingCounts: { farms: 2 } },
    });

    expect(row.name).toBe('budget_turn_9');
    expect(row.turn).toBe(9);
    expect(row.population).toBe(12);
    expect(row.funds).toBeGreaterThan(0);

    const stored = await testDb.budget.get('budget_turn_9');
    expect(stored).toBeTruthy();
    expect(stored.buildingCounts).toEqual({ farms: 2 });
  });

  test('SaveBudgetTurnEnrichment upserts existing turn row', async () => {
    await saveBudgetTurnEnrichment.execute({
      turn: 12,
      additionalData: { population: 5 },
    });

    await saveBudgetTurnEnrichment.execute({
      turn: 12,
      additionalData: { population: 8 },
    });

    const rows = await testDb.budget.where('name').equals('budget_turn_12').toArray();
    expect(rows).toHaveLength(1);
    expect(rows[0].population).toBe(8);
  });

  test('getEnrichmentAtTurn reads persisted snapshot', async () => {
    await saveBudgetTurnEnrichment.execute({
      turn: 15,
      additionalData: { population: 20 },
    });

    const enrichment = await enrichmentRepository.getEnrichmentAtTurn(15);
    expect(enrichment?.turn).toBe(15);
    expect(enrichment?.population).toBe(20);
    expect(enrichment?.financialHealth).toBeTruthy();
  });
});
