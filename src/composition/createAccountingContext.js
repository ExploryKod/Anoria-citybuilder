import { TimeManager } from '../js/game/utils/TimeManager.js';
import { GetTreasuryBalance } from '../contexts/accounting/application/queries/treasury/GetTreasuryBalance.js';
import { GetCityLedgerYearComparison } from '../contexts/accounting/application/queries/city-ledger/GetCityLedgerYearComparison.js';
import { GetGeneralLedger } from '../contexts/accounting/application/queries/journal/GetGeneralLedger.js';
import { DexieJournalRepository } from '../contexts/accounting/infrastructure/adapters/persistence/dexie/DexieJournalRepository.js';
import { DexieTreasuryRepository } from '../contexts/accounting/infrastructure/adapters/persistence/dexie/DexieTreasuryRepository.js';
import { LegacyJournalRepository } from '../contexts/accounting/infrastructure/adapters/legacy/LegacyJournalRepository.js';
import { LegacyTreasuryRepository } from '../contexts/accounting/infrastructure/adapters/legacy/LegacyTreasuryRepository.js';
import { LegacyGameTimePort } from '../contexts/accounting/infrastructure/adapters/legacy/LegacyGameTimePort.js';
import journalManager from '../js/stores/JournalManager.js';
import budgetManager from '../js/stores/BudgetManager.js';

/**
 * Composition root — Accounting bounded context.
 *
 * Default: Dexie persistence adapters (Phase 2a).
 * Inject legacy adapters via deps for regression tests against stores.
 *
 * @param {object} [deps]
 * @param {import('../contexts/accounting/application/ports/JournalRepository.js').JournalRepository} [deps.journalRepository]
 * @param {import('../contexts/accounting/application/ports/TreasuryRepository.js').TreasuryRepository} [deps.treasuryRepository]
 * @param {import('../contexts/accounting/application/ports/GameTimePort.js').GameTimePort} [deps.gameTimePort]
 * @param {import('dexie').Dexie} [deps.db]
 */
export function createAccountingContext(deps = {}) {
  const gameTimePort =
    deps.gameTimePort ??
    new LegacyGameTimePort(
      typeof window !== 'undefined' && window.TimeManager
        ? window.TimeManager
        : TimeManager
    );

  const journalRepository =
    deps.journalRepository ??
    new DexieJournalRepository({
      db: deps.db,
      gameTimePort,
    });
  const treasuryRepository =
    deps.treasuryRepository ??
    new DexieTreasuryRepository({ db: deps.db });

  const getTreasuryBalanceQuery = new GetTreasuryBalance(treasuryRepository);
  const getCityLedgerYearComparisonQuery = new GetCityLedgerYearComparison(
    journalRepository,
    treasuryRepository,
    gameTimePort
  );
  const getGeneralLedgerQuery = new GetGeneralLedger(
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
    getGeneralLedgerQuery,

    async getTreasuryBalance() {
      return getTreasuryBalanceQuery.execute();
    },

    async getCityLedgerYearComparison() {
      return getCityLedgerYearComparisonQuery.execute();
    },

    async getGeneralLedger(filters) {
      return getGeneralLedgerQuery.execute(filters);
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

/** @internal Tests — legacy store adapters */
export function createLegacyAccountingContext(deps = {}) {
  return createAccountingContext({
    ...deps,
    journalRepository:
      deps.journalRepository ?? new LegacyJournalRepository(journalManager),
    treasuryRepository:
      deps.treasuryRepository ?? new LegacyTreasuryRepository(budgetManager),
  });
}
