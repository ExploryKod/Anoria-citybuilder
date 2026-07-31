import { TimeManager } from '../js/game/utils/TimeManager.js';
import { GetTreasuryBalance } from '../contexts/accounting/application/queries/treasury/GetTreasuryBalance.js';
import { GetCityLedgerYearComparison } from '../contexts/accounting/application/queries/city-ledger/GetCityLedgerYearComparison.js';
import { GetGeneralLedger } from '../contexts/accounting/application/queries/journal/GetGeneralLedger.js';
import { RecordLedgerEntry } from '../contexts/accounting/application/commands/journal/RecordLedgerEntry.js';
import { ApplyTreasuryMovement } from '../contexts/accounting/application/commands/treasury/ApplyTreasuryMovement.js';
import { RecordMaintenanceExpense } from '../contexts/accounting/application/services/RecordMaintenanceExpense.js';
import { RecordConstructionExpense } from '../contexts/accounting/application/services/RecordConstructionExpense.js';
import { RecordSalaryExpense } from '../contexts/accounting/application/services/RecordSalaryExpense.js';
import { RecordPayrollTaxIncome } from '../contexts/accounting/application/services/RecordPayrollTaxIncome.js';
import { RecordCitizenTaxIncome } from '../contexts/accounting/application/services/RecordCitizenTaxIncome.js';
import { RecordLoanCapitalIncome } from '../contexts/accounting/application/services/RecordLoanCapitalIncome.js';
import { RecordLoanInterestExpense } from '../contexts/accounting/application/services/RecordLoanInterestExpense.js';
import { RecordLoanRepaymentExpense } from '../contexts/accounting/application/services/RecordLoanRepaymentExpense.js';
import { RecordInfoLoanInstallment } from '../contexts/accounting/application/services/RecordInfoLoanInstallment.js';
import { RecordCommerceImportExpense } from '../contexts/accounting/application/services/RecordCommerceImportExpense.js';
import { RecordCommerceExportIncome } from '../contexts/accounting/application/services/RecordCommerceExportIncome.js';
import { RecordCapitalFundsIncome } from '../contexts/accounting/application/services/RecordCapitalFundsIncome.js';
import { RecordExceptionalExpense } from '../contexts/accounting/application/services/RecordExceptionalExpense.js';
import { RecordCommercialRouteExpense } from '../contexts/accounting/application/services/RecordCommercialRouteExpense.js';
import { RecordConstructionRefundIncome } from '../contexts/accounting/application/services/RecordConstructionRefundIncome.js';
import { RecordBalanceSnapshot } from '../contexts/accounting/application/services/RecordBalanceSnapshot.js';
import { RecordCarryForwardEntry } from '../contexts/accounting/application/services/RecordCarryForwardEntry.js';
import { RecordYearCumulEntries } from '../contexts/accounting/application/services/RecordYearCumulEntries.js';
import { SyncTurnInformativeEntries } from '../contexts/accounting/application/services/SyncTurnInformativeEntries.js';
import { GetTreasuryJournalReconciliation } from '../contexts/accounting/application/queries/reconciliation/GetTreasuryJournalReconciliation.js';
import { LegacyYearEndBalanceAdapter } from '../contexts/accounting/infrastructure/adapters/legacy/LegacyYearEndBalanceAdapter.js';
import { SessionJournalRepository } from '../contexts/accounting/infrastructure/adapters/persistence/session/SessionJournalRepository.js';
import { SessionJournalWriteAdapter } from '../contexts/accounting/infrastructure/adapters/persistence/session/SessionJournalWriteAdapter.js';
import { DexieTreasuryRepository } from '../contexts/accounting/infrastructure/adapters/persistence/dexie/DexieTreasuryRepository.js';
import { LegacyJournalRepository } from '../contexts/accounting/infrastructure/adapters/legacy/LegacyJournalRepository.js';
import { LegacyTreasuryRepository } from '../contexts/accounting/infrastructure/adapters/legacy/LegacyTreasuryRepository.js';
import { LegacyTreasuryWriteAdapter } from '../contexts/accounting/infrastructure/adapters/legacy/LegacyTreasuryWriteAdapter.js';
import { LegacyGameTimePort } from '../contexts/accounting/infrastructure/adapters/legacy/LegacyGameTimePort.js';
import journalManager from '../js/stores/JournalManager.js';
import budgetManager from '../js/stores/BudgetManager.js';

/**
 * Composition root — Accounting bounded context.
 *
 * Default: session journal buffer + Dexie treasury (Phase 3½ slice 1).
 * Inject legacy adapters via deps for regression tests against stores.
 *
 * @param {object} [deps]
 * @param {import('../contexts/accounting/application/ports/JournalRepository.js').JournalRepository} [deps.journalRepository]
 * @param {import('../contexts/accounting/application/ports/TreasuryRepository.js').TreasuryRepository} [deps.treasuryRepository]
 * @param {import('../contexts/accounting/application/ports/JournalWritePort.js').JournalWritePort} [deps.journalWritePort]
 * @param {import('../contexts/accounting/application/ports/TreasuryWritePort.js').TreasuryWritePort} [deps.treasuryWritePort]
 * @param {import('../contexts/accounting/application/ports/GameTimePort.js').GameTimePort} [deps.gameTimePort]
 * @param {import('../js/stores/JournalManager.js').JournalManager} [deps.journalManager]
 * @param {import('../js/stores/BudgetManager.js').BudgetManager} [deps.budgetManager]
 * @param {import('dexie').Dexie} [deps.db]
 */
export function createAccountingContext(deps = {}) {
  const journalManagerInstance = deps.journalManager ?? journalManager;
  const budgetManagerInstance = deps.budgetManager ?? budgetManager;

  const gameTimePort =
    deps.gameTimePort ??
    new LegacyGameTimePort(
      typeof window !== 'undefined' && window.TimeManager
        ? window.TimeManager
        : TimeManager
    );

  const journalWritePort =
    deps.journalWritePort ??
    new SessionJournalWriteAdapter(journalManagerInstance);
  const treasuryWritePort =
    deps.treasuryWritePort ??
    new LegacyTreasuryWriteAdapter(budgetManagerInstance);

  const recordLedgerEntryCommand = new RecordLedgerEntry(
    journalWritePort,
    gameTimePort
  );
  const applyTreasuryMovementCommand = new ApplyTreasuryMovement(
    treasuryWritePort
  );
  const recordMaintenanceExpense = new RecordMaintenanceExpense(
    recordLedgerEntryCommand,
    applyTreasuryMovementCommand
  );
  const recordConstructionExpense = new RecordConstructionExpense(
    recordLedgerEntryCommand,
    applyTreasuryMovementCommand
  );
  const recordSalaryExpense = new RecordSalaryExpense(
    recordLedgerEntryCommand,
    applyTreasuryMovementCommand
  );
  const recordPayrollTaxIncome = new RecordPayrollTaxIncome(
    recordLedgerEntryCommand,
    applyTreasuryMovementCommand
  );
  const recordCitizenTaxIncome = new RecordCitizenTaxIncome(
    recordLedgerEntryCommand,
    applyTreasuryMovementCommand
  );
  const recordLoanCapitalIncome = new RecordLoanCapitalIncome(
    recordLedgerEntryCommand,
    applyTreasuryMovementCommand
  );
  const recordLoanInterestExpense = new RecordLoanInterestExpense(
    recordLedgerEntryCommand,
    applyTreasuryMovementCommand
  );
  const recordLoanRepaymentExpense = new RecordLoanRepaymentExpense(
    recordLedgerEntryCommand,
    applyTreasuryMovementCommand
  );
  const recordInfoLoanInstallment = new RecordInfoLoanInstallment(
    recordLedgerEntryCommand
  );
  const recordCommerceImportExpense = new RecordCommerceImportExpense(
    recordLedgerEntryCommand,
    applyTreasuryMovementCommand
  );
  const recordCommerceExportIncome = new RecordCommerceExportIncome(
    recordLedgerEntryCommand,
    applyTreasuryMovementCommand
  );
  const recordCapitalFundsIncome = new RecordCapitalFundsIncome(
    recordLedgerEntryCommand
  );
  const recordExceptionalExpense = new RecordExceptionalExpense(
    recordLedgerEntryCommand,
    applyTreasuryMovementCommand
  );
  const recordCommercialRouteExpense = new RecordCommercialRouteExpense(
    recordLedgerEntryCommand,
    applyTreasuryMovementCommand
  );
  const recordConstructionRefundIncome = new RecordConstructionRefundIncome(
    recordLedgerEntryCommand,
    applyTreasuryMovementCommand
  );
  const recordBalanceSnapshot = new RecordBalanceSnapshot(journalWritePort);

  const journalRepository =
    deps.journalRepository ??
    new SessionJournalRepository({
      journalManager: journalManagerInstance,
      gameTimePort,
    });
  const treasuryRepository =
    deps.treasuryRepository ??
    new DexieTreasuryRepository({ db: deps.db });

  const yearEndBalancePort = deps.yearEndBalancePort ?? new LegacyYearEndBalanceAdapter();
  const recordCarryForwardEntry = new RecordCarryForwardEntry(
    recordLedgerEntryCommand,
    gameTimePort,
    journalRepository,
    yearEndBalancePort
  );
  const recordYearCumulEntries = new RecordYearCumulEntries(
    recordLedgerEntryCommand,
    gameTimePort,
    journalRepository
  );
  const syncTurnInformativeEntries = new SyncTurnInformativeEntries(
    recordBalanceSnapshot,
    recordYearCumulEntries,
    recordCarryForwardEntry,
    gameTimePort
  );
  const getTreasuryJournalReconciliationQuery = new GetTreasuryJournalReconciliation(
    treasuryRepository,
    journalRepository
  );

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
    journalWritePort,
    treasuryWritePort,
    gameTimePort,
    recordLedgerEntryCommand,
    applyTreasuryMovementCommand,
    recordMaintenanceExpense,
    recordConstructionExpense,
    recordSalaryExpense,
    recordPayrollTaxIncome,
    recordCitizenTaxIncome,
    recordLoanCapitalIncome,
    recordLoanInterestExpense,
    recordLoanRepaymentExpense,
    recordInfoLoanInstallment,
    recordCommerceImportExpense,
    recordCommerceExportIncome,
    recordCapitalFundsIncome,
    recordExceptionalExpense,
    recordCommercialRouteExpense,
    recordConstructionRefundIncome,
    recordBalanceSnapshot,
    recordCarryForwardEntry,
    recordYearCumulEntries,
    syncTurnInformativeEntries,
    getTreasuryBalanceQuery,
    getTreasuryJournalReconciliationQuery,
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

    async getTreasuryJournalReconciliation(options) {
      return getTreasuryJournalReconciliationQuery.execute(options);
    },

    /** @param {Parameters<RecordBalanceSnapshot['execute']>[0]} params */
    async recordBalanceSnapshot(params) {
      return recordBalanceSnapshot.execute(params);
    },

    /** @param {Parameters<SyncTurnInformativeEntries['execute']>[0]} params */
    async syncTurnInformativeEntries(params) {
      return syncTurnInformativeEntries.execute(params);
    },

    /** @param {Parameters<RecordMaintenanceExpense['execute']>[0]} params */
    async recordMaintenanceExpense(params) {
      return recordMaintenanceExpense.execute(params);
    },

    /** @param {Parameters<RecordConstructionExpense['execute']>[0]} params */
    async recordConstructionExpense(params) {
      return recordConstructionExpense.execute(params);
    },

    /** @param {Parameters<RecordSalaryExpense['execute']>[0]} params */
    async recordSalaryExpense(params) {
      return recordSalaryExpense.execute(params);
    },

    /** @param {Parameters<RecordPayrollTaxIncome['execute']>[0]} params */
    async recordPayrollTaxIncome(params) {
      return recordPayrollTaxIncome.execute(params);
    },

    /** @param {Parameters<RecordCitizenTaxIncome['execute']>[0]} params */
    async recordCitizenTaxIncome(params) {
      return recordCitizenTaxIncome.execute(params);
    },

    /** @param {Parameters<RecordLoanCapitalIncome['execute']>[0]} params */
    async recordLoanCapitalIncome(params) {
      return recordLoanCapitalIncome.execute(params);
    },

    /** @param {Parameters<RecordLoanInterestExpense['execute']>[0]} params */
    async recordLoanInterestExpense(params) {
      return recordLoanInterestExpense.execute(params);
    },

    /** @param {Parameters<RecordLoanRepaymentExpense['execute']>[0]} params */
    async recordLoanRepaymentExpense(params) {
      return recordLoanRepaymentExpense.execute(params);
    },

    /** @param {Parameters<RecordInfoLoanInstallment['execute']>[0]} params */
    async recordInfoLoanInstallment(params) {
      return recordInfoLoanInstallment.execute(params);
    },

    /** @deprecated Use recordInfoLoanInstallment */
    async recordLoanDefaultInstallment(params) {
      return recordInfoLoanInstallment.execute(params);
    },

    /** @param {Parameters<RecordCommerceImportExpense['execute']>[0]} params */
    async recordCommerceImportExpense(params) {
      return recordCommerceImportExpense.execute(params);
    },

    /** @param {Parameters<RecordCommerceExportIncome['execute']>[0]} params */
    async recordCommerceExportIncome(params) {
      return recordCommerceExportIncome.execute(params);
    },

    /** @param {Parameters<RecordCapitalFundsIncome['execute']>[0]} params */
    async recordCapitalFundsIncome(params) {
      return recordCapitalFundsIncome.execute(params);
    },

    /** @param {Parameters<RecordExceptionalExpense['execute']>[0]} params */
    async recordExceptionalExpense(params) {
      return recordExceptionalExpense.execute(params);
    },

    /** @param {Parameters<RecordCommercialRouteExpense['execute']>[0]} params */
    async recordCommercialRouteExpense(params) {
      return recordCommercialRouteExpense.execute(params);
    },

    /** @param {Parameters<RecordConstructionRefundIncome['execute']>[0]} params */
    async recordConstructionRefundIncome(params) {
      return recordConstructionRefundIncome.execute(params);
    },

    /** @param {Parameters<RecordLedgerEntry['execute']>[0]} params */
    async recordLedgerEntry(params) {
      return recordLedgerEntryCommand.execute(params);
    },
  };
}

/** @type {ReturnType<typeof createAccountingContext> | null} */
let sharedAccounting = null;

export function getOrCreateAccountingContext(deps = {}) {
  if (!sharedAccounting) {
    sharedAccounting = createAccountingContext(deps);
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
