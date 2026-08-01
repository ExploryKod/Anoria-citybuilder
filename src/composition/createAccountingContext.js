import { getOrCreateGameSessionContext } from '../composition/createGameSessionContext.js';
import { getWorkSectionManager, getAppService, getTimeManager, getTimeInfo } from '../js/acl/appRuntime.js';
import { GetTreasuryBalance } from '../contexts/accounting/application/queries/treasury/GetTreasuryBalance.js';
import { GetTreasurySnapshot } from '../contexts/accounting/application/queries/treasury/GetTreasurySnapshot.js';
import { GetFinancialHealth } from '../contexts/accounting/application/queries/treasury/GetFinancialHealth.js';
import { InitializeTreasury } from '../contexts/accounting/application/commands/treasury/InitializeTreasury.js';
import { ForceReinitializeTreasury } from '../contexts/accounting/application/commands/treasury/ForceReinitializeTreasury.js';
import { UpdateTreasuryTurn } from '../contexts/accounting/application/commands/treasury/UpdateTreasuryTurn.js';
import { TreasuryLoanPortfolio } from '../contexts/accounting/application/services/TreasuryLoanPortfolio.js';
import { GetCityLedgerYearComparison } from '../contexts/accounting/application/queries/city-ledger/GetCityLedgerYearComparison.js';
import { GetGeneralLedger } from '../contexts/accounting/application/queries/journal/GetGeneralLedger.js';
import { GetIncomeStatement } from '../contexts/accounting/application/queries/financial-statements/GetIncomeStatement.js';
import { GetBalanceSheet } from '../contexts/accounting/application/queries/financial-statements/GetBalanceSheet.js';
import {
  GetFinancialStatementsAtTurn,
  GetFinancialStatementsHistory,
  GetIncomeStatementForFiscalYear,
} from '../contexts/accounting/application/queries/financial-statements/GetFinancialStatementsAtTurn.js';
import { BudgetTurnEnrichmentRepository } from '../contexts/accounting/infrastructure/adapters/persistence/dexie/BudgetTurnEnrichmentRepository.js';
import { SaveBudgetTurnEnrichment } from '../contexts/accounting/application/commands/budget-turn-enrichment/SaveBudgetTurnEnrichment.js';
import { FlushJournalSession } from '../contexts/accounting/application/commands/journal/FlushJournalSession.js';
import { ExportJournalJson } from '../contexts/accounting/application/queries/journal/ExportJournalJson.js';
import { ExportJournalPdf } from '../contexts/accounting/application/queries/journal/ExportJournalPdf.js';
import { DexieJournalSessionPersistenceAdapter } from '../contexts/accounting/infrastructure/adapters/persistence/dexie/DexieJournalSessionPersistenceAdapter.js';
import { CityAssetsValuationAdapter } from '../contexts/accounting/infrastructure/adapters/shared/CityAssetsValuationAdapter.js';
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
import { DexieTreasuryWriteAdapter } from '../contexts/accounting/infrastructure/adapters/persistence/dexie/DexieTreasuryWriteAdapter.js';
import { DexieObjectiveHistoryRepository } from '../contexts/accounting/infrastructure/dexie/DexieObjectiveHistoryRepository.js';
import { LegacyGameTimePort } from '../contexts/accounting/infrastructure/adapters/legacy/LegacyGameTimePort.js';
import sessionJournalStore from '../contexts/accounting/infrastructure/session/SessionJournalStore.js';
import {
  readInitialFundsFromImportMeta,
} from '../contexts/accounting/domain/catalogs/TreasuryCatalog.js';
import { CollectCitizenTaxes } from '../contexts/accounting/application/services/game/CollectCitizenTaxes.js';
import { RecordBuildingMaintenanceForCity } from '../contexts/accounting/application/services/game/RecordBuildingMaintenanceForCity.js';
import { GameTreasuryRecording } from '../contexts/accounting/application/services/game/GameTreasuryRecording.js';
import { CleanupOldBudgetTurnSnapshots } from '../contexts/accounting/application/commands/budget-turn-enrichment/CleanupOldBudgetTurnSnapshots.js';
import { ProcessTurnBudget } from '../contexts/accounting/application/services/ProcessTurnBudget.js';
import {
  buildBudgetSummary,
  buildIncomeBreakdown,
  buildExpenseBreakdown,
  canAffordFromBudget,
} from '../contexts/accounting/application/queries/treasury/GameTreasuryProjections.js';
import {
  getCityTotalPopulation,
  clearPopulationWithoutRoadAccess,
} from '../js/acl/housing.js';

/**
 * Composition root — Accounting bounded context.
 *
 * Default: session journal buffer + Dexie treasury read/write (Phase 4).
 * Inject legacy adapters via deps for regression tests.
 *
 * @param {object} [deps]
 * @param {import('../contexts/accounting/application/ports/JournalRepository.js').JournalRepository} [deps.journalRepository]
 * @param {import('../contexts/accounting/application/ports/TreasuryRepository.js').TreasuryRepository} [deps.treasuryRepository]
 * @param {import('../contexts/accounting/application/ports/JournalWritePort.js').JournalWritePort} [deps.journalWritePort]
 * @param {import('../contexts/accounting/application/ports/TreasuryWritePort.js').TreasuryWritePort} [deps.treasuryWritePort]
 * @param {import('../contexts/accounting/application/ports/GameTimePort.js').GameTimePort} [deps.gameTimePort]
 * @param {import('../contexts/accounting/infrastructure/session/SessionJournalStore.js').SessionJournalStore} [deps.sessionJournalStore]
 * @param {import('../contexts/accounting/infrastructure/session/SessionJournalStore.js').SessionJournalStore} [deps.journalManager]
 * @param {import('dexie').Dexie} [deps.db]
 * @param {import('../contexts/accounting/infrastructure/dexie/DexieObjectiveHistoryRepository.js').DexieObjectiveHistoryRepository} [deps.objectiveHistoryRepository]
 */
export function createAccountingContext(deps = {}) {
  const sessionJournalStoreInstance =
    deps.sessionJournalStore ?? deps.journalManager ?? sessionJournalStore;
  const dexieDb = deps.db ?? sessionJournalStoreInstance.db;
  const defaultInitialFunds = deps.defaultInitialFunds ?? readInitialFundsFromImportMeta();
  const objectiveHistoryRepository =
    deps.objectiveHistoryRepository ?? new DexieObjectiveHistoryRepository(dexieDb);

  const gameTimePort =
    deps.gameTimePort ??
    new LegacyGameTimePort(getTimeManager());

  if (!sessionJournalStoreInstance.gameTimePort) {
    sessionJournalStoreInstance.setGameTimePort(gameTimePort);
  }

  const journalWritePort =
    deps.journalWritePort ??
    new SessionJournalWriteAdapter(sessionJournalStoreInstance);

  const treasuryRepository =
    deps.treasuryRepository ??
    new DexieTreasuryRepository({
      db: dexieDb,
      expectedInitialFunds: defaultInitialFunds,
    });

  const treasuryWritePort =
    deps.treasuryWritePort ??
    new DexieTreasuryWriteAdapter(treasuryRepository);

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
      sessionJournalStore: sessionJournalStoreInstance,
      gameTimePort,
    });

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

  const initializeTreasury = new InitializeTreasury(
    treasuryRepository,
    journalRepository,
    recordCapitalFundsIncome,
    defaultInitialFunds
  );
  const getTreasurySnapshotQuery = new GetTreasurySnapshot(
    treasuryRepository,
    initializeTreasury
  );
  const forceReinitializeTreasury = new ForceReinitializeTreasury(
    treasuryRepository,
    journalRepository,
    initializeTreasury,
    {
      clear: async () => {
        await dexieDb.journal.clear();
      },
    }
  );
  const updateTreasuryTurn = new UpdateTreasuryTurn(
    treasuryRepository,
    getTreasurySnapshotQuery,
    syncTurnInformativeEntries
  );
  const treasuryLoanPortfolio = new TreasuryLoanPortfolio(
    treasuryRepository,
    getTreasurySnapshotQuery
  );
  const getFinancialHealthQuery = new GetFinancialHealth(getTreasurySnapshotQuery);

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
  const cityAssetsValuationPort =
    deps.cityAssetsValuationPort ?? new CityAssetsValuationAdapter();
  const budgetTurnEnrichmentRepository =
    deps.budgetTurnEnrichmentRepository ??
    new BudgetTurnEnrichmentRepository(dexieDb);

  const getIncomeStatementForFiscalYear = new GetIncomeStatementForFiscalYear(
    journalRepository
  );
  const getFinancialStatementsAtTurn = new GetFinancialStatementsAtTurn(
    journalRepository,
    gameTimePort,
    cityAssetsValuationPort,
    budgetTurnEnrichmentRepository,
    treasuryLoanPortfolio,
    getTreasurySnapshotQuery
  );
  const getFinancialStatementsHistory = new GetFinancialStatementsHistory(
    getFinancialStatementsAtTurn,
    journalRepository,
    getTreasurySnapshotQuery
  );
  const getIncomeStatementQuery = new GetIncomeStatement(
    getIncomeStatementForFiscalYear
  );
  const getBalanceSheetQuery = new GetBalanceSheet(
    getFinancialStatementsAtTurn,
    getTreasurySnapshotQuery
  );
  const saveBudgetTurnEnrichment = new SaveBudgetTurnEnrichment(
    budgetTurnEnrichmentRepository,
    getTreasurySnapshotQuery,
    getFinancialHealthQuery
  );
  const journalSessionPersistencePort =
    deps.journalSessionPersistencePort ??
    new DexieJournalSessionPersistenceAdapter(dexieDb);
  const flushJournalSession = new FlushJournalSession(journalSessionPersistencePort);
  const exportJournalJsonQuery = new ExportJournalJson(
    journalRepository,
    yearEndBalancePort
  );
  const exportJournalPdfQuery = new ExportJournalPdf(journalRepository);

  const houseReadPort = {
    listHouses: () => dexieDb.houses.toArray(),
  };

  const getCitizenTaxPerCapita = () => {
    const financesSectionManager = getAppService('financesSectionManager');
    if (
      financesSectionManager &&
      typeof financesSectionManager.citizenTaxAmount === 'number'
    ) {
      return financesSectionManager.citizenTaxAmount;
    }
    return 100;
  };

  const collectCitizenTaxes = new CollectCitizenTaxes({
    getTreasurySnapshot: getTreasurySnapshotQuery,
    recordCitizenTaxIncome,
    houseReadPort,
    getCitizenTaxPerCapita,
    getTimeInfo: (time) => gameTimePort.getTimeInfo(time),
  });

  const recordBuildingMaintenanceForCity = new RecordBuildingMaintenanceForCity({
    getTreasurySnapshot: getTreasurySnapshotQuery,
    recordMaintenanceExpense,
    houseReadPort,
  });

  const gameTreasuryRecording = new GameTreasuryRecording({
    getTreasurySnapshot: getTreasurySnapshotQuery,
    commands: {
      recordSalaryExpense: (params) => recordSalaryExpense.execute(params),
      recordPayrollTaxIncome: (params) => recordPayrollTaxIncome.execute(params),
      recordExceptionalExpense: (params) => recordExceptionalExpense.execute(params),
      recordCommercialRouteExpense: (params) => recordCommercialRouteExpense.execute(params),
      recordCommerceImportExpense: (params) => recordCommerceImportExpense.execute(params),
      recordCommerceExportIncome: (params) => recordCommerceExportIncome.execute(params),
      recordLoanCapitalIncome: (params) => recordLoanCapitalIncome.execute(params),
      recordLoanInterestExpense: (params) => recordLoanInterestExpense.execute(params),
      recordLoanRepaymentExpense: (params) => recordLoanRepaymentExpense.execute(params),
      recordInfoLoanInstallment: (params) => recordInfoLoanInstallment.execute(params),
      addLoanToPortfolio: (loanData) => treasuryLoanPortfolio.addLoanToPortfolio(loanData),
      applyRepaymentToPortfolio: (loanId, amount) =>
        treasuryLoanPortfolio.applyRepaymentToPortfolio(loanId, amount),
    },
  });

  const cleanupOldBudgetTurnSnapshots = new CleanupOldBudgetTurnSnapshots({
    budgetCleanupPort: {
      listBudgetTurnRows: async () => {
        const allBudgets = await dexieDb.budget.toArray();
        return allBudgets
          .filter((row) => row.name.startsWith('budget_turn_'))
          .sort((a, b) => b.turn - a.turn);
      },
      deleteBudgetRow: (name) => dexieDb.budget.delete(name),
    },
    getCurrentTurn: async () => {
      try {
        const gameSession = getOrCreateGameSessionContext();
        const turnData = await gameSession.getLatestGameItemByField('turn');
        return turnData || 0;
      } catch (error) {
        console.warn('Could not get current turn:', error);
        return 0;
      }
    },
  });

  const getSalarySettings = () => {
    const workSectionManager = getWorkSectionManager();
    let salaryPerMonth = 100;
    let salaryTaxRate = 0.2;
    if (workSectionManager && typeof workSectionManager.salary === 'number') {
      salaryPerMonth = workSectionManager.salary;
    }
    if (
      workSectionManager &&
      typeof workSectionManager.salaryTaxRate === 'number'
    ) {
      salaryTaxRate = workSectionManager.salaryTaxRate;
    }
    return { salaryPerMonth, salaryTaxRate };
  };

  const processTurnBudget = new ProcessTurnBudget({
    collectCitizenTaxes: (time) => collectCitizenTaxes.execute({ time }),
    recordSalaries: (...args) => gameTreasuryRecording.recordSalaries(...args),
    recordPayrollTax: (...args) => gameTreasuryRecording.recordPayrollTax(...args),
    recordBuildingMaintenance: (amount, description, turn) =>
      recordBuildingMaintenanceForCity.execute({ amount, description, turn }),
    getTimeInfo: (time) => getTimeInfo(time),
    getCityTotalPopulation:
      deps.getCityTotalPopulation ?? (() => getCityTotalPopulation()),
    getSalarySettings: deps.getSalarySettings ?? getSalarySettings,
    clearPopulationWithoutRoadAccess:
      deps.clearPopulationWithoutRoadAccess ?? (() => clearPopulationWithoutRoadAccess()),
    processLoanPayments:
      deps.processLoanPayments ??
      (async () => {
        const processLoanPayments = getAppService('processLoanPayments');
        if (processLoanPayments) {
          await processLoanPayments();
        }
      }),
    recalculateLoanTotals: () => treasuryLoanPortfolio.recalculateLoanTotals(),
    saveBudgetTurnEnrichment: (turn, additionalData) =>
      saveBudgetTurnEnrichment.execute({ turn, additionalData }),
    cleanupOldBudgetTurnSnapshotsByAge: () => cleanupOldBudgetTurnSnapshots.execute(),
    cleanupOldJournalEntries: (maxAge) =>
      sessionJournalStoreInstance.cleanupOldJournalEntries(maxAge),
    flushJournalSessionToDexie: () => flushJournalSession.execute(),
  });

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
    getTreasurySnapshotQuery,
    getFinancialHealthQuery,
    initializeTreasury,
    forceReinitializeTreasury,
    updateTreasuryTurn,
    treasuryLoanPortfolio,
    getTreasuryJournalReconciliationQuery,
    getCityLedgerYearComparisonQuery,
    getGeneralLedgerQuery,
    getIncomeStatementQuery,
    getBalanceSheetQuery,
    getFinancialStatementsAtTurn,
    getFinancialStatementsHistory,
    budgetTurnEnrichmentRepository,
    saveBudgetTurnEnrichment,
    flushJournalSession,
    exportJournalJsonQuery,
    exportJournalPdfQuery,
    journalSessionPersistencePort,
    cityAssetsValuationPort,

    async getTreasuryBalance() {
      return getTreasuryBalanceQuery.execute();
    },

    async getTreasurySnapshot() {
      return getTreasurySnapshotQuery.execute();
    },

    async getFinancialHealth() {
      return getFinancialHealthQuery.execute();
    },

    /** @param {number|null} [startingFunds] */
    async initializeTreasury(startingFunds = null) {
      return initializeTreasury.execute(startingFunds);
    },

    /** @param {number|null} [startingFunds] */
    async forceReinitializeTreasury(startingFunds = null) {
      return forceReinitializeTreasury.execute(startingFunds);
    },

    /** @param {number} turn */
    async updateTreasuryTurn(turn) {
      return updateTreasuryTurn.execute(turn);
    },

    async getActiveLoans() {
      return treasuryLoanPortfolio.getActiveLoans();
    },

    /** @param {object} loanData */
    async addLoanToPortfolio(loanData) {
      return treasuryLoanPortfolio.addLoanToPortfolio(loanData);
    },

    /** @param {string} loanId @param {number} repaymentAmount */
    async applyRepaymentToPortfolio(loanId, repaymentAmount) {
      return treasuryLoanPortfolio.applyRepaymentToPortfolio(loanId, repaymentAmount);
    },

    /** @param {string} loanId */
    async advanceLoanInstallmentWithoutPayment(loanId) {
      return treasuryLoanPortfolio.advanceInstallmentWithoutPayment(loanId);
    },

    async recalculateLoanTotals() {
      return treasuryLoanPortfolio.recalculateLoanTotals();
    },

    async getCityLedgerYearComparison() {
      return getCityLedgerYearComparisonQuery.execute();
    },

    async getGeneralLedger(filters) {
      return getGeneralLedgerQuery.execute(filters);
    },

    /** @param {{ fiscalYear?: number|null }} [options] */
    async getIncomeStatement(options) {
      return getIncomeStatementQuery.execute(options);
    },

    async getBalanceSheet() {
      return getBalanceSheetQuery.execute();
    },

    /** @param {number} atTurn */
    async getFinancialStatementsAtTurn(atTurn) {
      return getFinancialStatementsAtTurn.execute(atTurn);
    },

    /** @param {{ everyNTurns?: number, turns?: number[]|null, filterTurn?: number|null }} [options] */
    async getFinancialStatementsHistory(options) {
      return getFinancialStatementsHistory.execute(options);
    },

    /**
     * @param {object} params
     * @param {number} params.turn
     * @param {{ population?: number, buildingCounts?: object }} [params.additionalData]
     */
    async saveBudgetTurnEnrichment(params) {
      return saveBudgetTurnEnrichment.execute(params);
    },

    async flushJournalSessionToDexie() {
      return flushJournalSession.execute();
    },

    async exportJournalJson() {
      return exportJournalJsonQuery.execute();
    },

    async exportJournalPdf() {
      return exportJournalPdfQuery.execute();
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

    /** @param {{ time?: number }} [params] */
    async collectCitizenTaxes(params = {}) {
      return collectCitizenTaxes.execute(params);
    },

    /** @param {Parameters<RecordBuildingMaintenanceForCity['execute']>[0]} params */
    async recordBuildingMaintenanceForCity(params) {
      return recordBuildingMaintenanceForCity.execute(params);
    },

    /** @param {Parameters<GameTreasuryRecording['recordSalaries']>} args */
    async recordSalaries(...args) {
      return gameTreasuryRecording.recordSalaries(...args);
    },

    /** @param {Parameters<GameTreasuryRecording['recordPayrollTax']>} args */
    async recordPayrollTax(...args) {
      return gameTreasuryRecording.recordPayrollTax(...args);
    },

    /** @param {Parameters<GameTreasuryRecording['recordExceptionalRepairExpense']>} args */
    async recordExceptionalRepairExpense(...args) {
      return gameTreasuryRecording.recordExceptionalRepairExpense(...args);
    },

    /** @param {Parameters<GameTreasuryRecording['recordCommercialRouteFee']>} args */
    async recordCommercialRouteFee(...args) {
      return gameTreasuryRecording.recordCommercialRouteFee(...args);
    },

    /** @param {Parameters<GameTreasuryRecording['recordImportExpense']>} args */
    async recordImportExpense(...args) {
      return gameTreasuryRecording.recordImportExpense(...args);
    },

    /** @param {Parameters<GameTreasuryRecording['recordExportIncome']>} args */
    async recordExportIncome(...args) {
      return gameTreasuryRecording.recordExportIncome(...args);
    },

    /** @param {Parameters<GameTreasuryRecording['recordLoanCapital']>} args */
    async recordLoanCapital(...args) {
      return gameTreasuryRecording.recordLoanCapital(...args);
    },

    /** @param {Parameters<GameTreasuryRecording['recordLoanInterest']>} args */
    async recordLoanInterest(...args) {
      return gameTreasuryRecording.recordLoanInterest(...args);
    },

    /** @param {Parameters<GameTreasuryRecording['recordLoanRepayment']>} args */
    async recordLoanRepayment(...args) {
      return gameTreasuryRecording.recordLoanRepayment(...args);
    },

    /** @param {Parameters<GameTreasuryRecording['recordInfoLoanInstallment']>[0]} params */
    async recordInfoLoanInstallmentFromGame(params) {
      return gameTreasuryRecording.recordInfoLoanInstallment(params);
    },

    async getBudgetSummary() {
      const budget = await getTreasurySnapshotQuery.execute();
      return buildBudgetSummary(budget);
    },

    async getIncomeBreakdown() {
      const budget = await getTreasurySnapshotQuery.execute();
      return buildIncomeBreakdown(budget);
    },

    async getExpenseBreakdown() {
      const budget = await getTreasurySnapshotQuery.execute();
      return buildExpenseBreakdown(budget);
    },

    async canAfford(amount) {
      const budget = await getTreasurySnapshotQuery.execute();
      return canAffordFromBudget(budget, amount);
    },

    async cleanupOldBudgetTurnSnapshotsByAge() {
      return cleanupOldBudgetTurnSnapshots.execute();
    },

    /** @param {number} [maxAge] */
    async cleanupOldJournalEntries(maxAge = 60) {
      return sessionJournalStoreInstance.cleanupOldJournalEntries(maxAge);
    },

    /** @param {Parameters<ProcessTurnBudget['execute']>[0]} params */
    async processTurnBudget(params) {
      return processTurnBudget.execute(params);
    },

    resetProcessTurnBudget() {
      processTurnBudget.reset();
    },

    async recordObjectiveFailure(failureData) {
      return objectiveHistoryRepository.recordObjectiveFailure(failureData);
    },

    async recordObjectiveSuccess(successData) {
      return objectiveHistoryRepository.recordObjectiveSuccess(successData);
    },

    async getAllObjectiveFailures() {
      return objectiveHistoryRepository.getAllFailures();
    },

    async getObjectiveFailuresForObjective(objectiveId) {
      return objectiveHistoryRepository.getFailuresForObjective(objectiveId);
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
