import journalManager from '../js/stores/JournalManager.js';
import budgetManager from '../js/stores/BudgetManager.js';
import { TimeManager } from '../js/game/utils/TimeManager.js';
import { GetTreasuryBalance } from '../contexts/accounting/application/queries/treasury/GetTreasuryBalance.js';
import { GetCityLedgerYearComparison } from '../contexts/accounting/application/queries/city-ledger/GetCityLedgerYearComparison.js';
import { LegacyJournalRepository } from '../contexts/accounting/infrastructure/adapters/legacy/LegacyJournalRepository.js';
import { LegacyTreasuryRepository } from '../contexts/accounting/infrastructure/adapters/legacy/LegacyTreasuryRepository.js';
import { LegacyGameTimePort } from '../contexts/accounting/infrastructure/adapters/legacy/LegacyGameTimePort.js';

/**
 * Composition root — Accounting bounded context (Phase 1).
 *
 * @param {object} [deps]
 * @param {import('../contexts/accounting/application/ports/JournalRepository.js').JournalRepository} [deps.journalRepository]
 * @param {import('../contexts/accounting/application/ports/TreasuryRepository.js').TreasuryRepository} [deps.treasuryRepository]
 * @param {import('../contexts/accounting/application/ports/GameTimePort.js').GameTimePort} [deps.gameTimePort]
 */
export function createAccountingContext(deps = {}) {
  const journalRepository =
    deps.journalRepository ?? new LegacyJournalRepository(journalManager);
  const treasuryRepository =
    deps.treasuryRepository ?? new LegacyTreasuryRepository(budgetManager);
  const gameTimePort =
    deps.gameTimePort ??
    new LegacyGameTimePort(
      typeof window !== 'undefined' && window.TimeManager
        ? window.TimeManager
        : TimeManager
    );

  const getTreasuryBalanceQuery = new GetTreasuryBalance(treasuryRepository);
  const getCityLedgerYearComparisonQuery = new GetCityLedgerYearComparison(
    journalRepository,
    treasuryRepository,
    gameTimePort
  );

  return {
    journalRepository,
    treasuryRepository,
    gameTimePort,
    getTreasuryBalanceQuery,
    getCityLedgerYearComparisonQuery,

    async getTreasuryBalance() {
      return getTreasuryBalanceQuery.execute();
    },

    async getCityLedgerYearComparison() {
      return getCityLedgerYearComparisonQuery.execute();
    },
  };
}

/** @type {ReturnType<typeof createAccountingContext> | null} */
let sharedAccounting = null;

export function getOrCreateAccountingContext() {
  if (!sharedAccounting) {
    sharedAccounting = createAccountingContext();
  }
  return sharedAccounting;
}

/** @internal Tests only */
export function resetAccountingContextForTests() {
  sharedAccounting = null;
}
