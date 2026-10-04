import { getOrCreateGameSessionContext } from './createGameSessionContext.js';
import { getOrCreateHousingContext } from './createHousingContext.js';
import { getOrCreateEmploymentContext } from './createEmploymentContext.js';
import { getSessionGameTime, getSessionProcessLoanPayments } from './sessionRuntime.js';
import { LocalStorageFiscalSettingsRepository } from '../contexts/accounting/infrastructure/persistence/LocalStorageFiscalSettingsRepository.js';
import { HamletFiscalRateRepository } from '../contexts/accounting/infrastructure/persistence/HamletFiscalRateRepository.js';
import { GetTreasuryBalance } from '../contexts/accounting/application/queries/treasury/GetTreasuryBalance.js';
import { GetTreasurySnapshot } from '../contexts/accounting/application/queries/treasury/GetTreasurySnapshot.js';
import { GetFinancialHealth } from '../contexts/accounting/application/queries/treasury/GetFinancialHealth.js';
import { InitializeTreasury } from '../contexts/accounting/application/commands/treasury/InitializeTreasury.js';
import { ForceReinitializeTreasury } from '../contexts/accounting/application/commands/treasury/ForceReinitializeTreasury.js';
import { GetCityLedgerYearComparison } from '../contexts/accounting/application/queries/city-ledger/GetCityLedgerYearComparison.js';
import { GetGeneralLedger } from '../contexts/accounting/application/queries/journal/GetGeneralLedger.js';
import { FlushJournalSession } from '../contexts/accounting/application/commands/journal/FlushJournalSession.js';
import { ExportJournalJson } from '../contexts/accounting/application/queries/journal/ExportJournalJson.js';
import { ExportJournalPdf } from '../contexts/accounting/application/queries/journal/ExportJournalPdf.js';
import { DexieJournalSessionPersistenceAdapter } from '../contexts/accounting/infrastructure/adapters/persistence/dexie/DexieJournalSessionPersistenceAdapter.js';
import { CityAssetsValuationAdapter } from '../contexts/accounting/infrastructure/adapters/shared/CityAssetsValuationAdapter.js';
import { getOrCreateCityAssetsContext } from './createCityAssetsContext.js';
import { RecordLedgerEntry } from '../contexts/accounting/application/commands/journal/RecordLedgerEntry.js';
import { RecordMaintenanceExpense } from '../contexts/accounting/application/services/RecordMaintenanceExpense.js';
import { RecordConstructionExpense } from '../contexts/accounting/application/services/RecordConstructionExpense.js';
import { RecordSalaryExpense } from '../contexts/accounting/application/services/RecordSalaryExpense.js';
import { RecordUnemploymentBenefitExpense } from '../contexts/accounting/application/services/RecordUnemploymentBenefitExpense.js';
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
import { RecordContributionExpense } from '../contexts/accounting/application/services/RecordContributionExpense.js';
import { RecordConstructionRefundIncome } from '../contexts/accounting/application/services/RecordConstructionRefundIncome.js';
import { SessionJournalRepository } from '../contexts/accounting/infrastructure/adapters/persistence/session/SessionJournalRepository.js';
import { SessionJournalWriteAdapter } from '../contexts/accounting/infrastructure/adapters/persistence/session/SessionJournalWriteAdapter.js';
import { DexieObjectiveHistoryRepository } from '../contexts/accounting/infrastructure/dexie/DexieObjectiveHistoryRepository.js';
import { LegacyGameTimePort } from '../contexts/accounting/infrastructure/adapters/legacy/LegacyGameTimePort.js';
import sessionJournalStore from '../contexts/accounting/infrastructure/session/SessionJournalStore.js';
import {
  readInitialFundsFromImportMeta,
} from '../contexts/accounting/domain/catalogs/TreasuryCatalog.js';
import { CollectCitizenTaxes } from '../contexts/accounting/application/services/game/CollectCitizenTaxes.js';
import { RecordBuildingMaintenanceForCity } from '../contexts/accounting/application/services/game/RecordBuildingMaintenanceForCity.js';
import { GameTreasuryRecording } from '../contexts/accounting/application/services/game/GameTreasuryRecording.js';
import { ProcessTurnBudget } from '../contexts/accounting/application/services/ProcessTurnBudget.js';
import { SettleServiceSubsidies } from '../contexts/accounting/application/services/SettleServiceSubsidies.js';
import { SettleVat } from '../contexts/accounting/application/services/SettleVat.js';
import { DexieSupplyTraceabilityRepository } from '../contexts/supply/infrastructure/dexie/DexieSupplyTraceabilityRepository.js';
import { getResourceBaseValue } from '../shared/resource-catalog/ResourceCategoryCatalog.js';
import {
  canAffordFromBudget,
} from '../contexts/accounting/application/queries/treasury/GameTreasuryProjections.js';
import { listSceneBuildingTypesForMaintenance } from './sceneBuildingInventoryBridge.js';
import { resolveGetTimeInfo } from './gameTimeBridge.js';
import { isActiveHamletRow } from '../core/persistence/hamlet/hamletSession.js';

async function getCityTotalPopulation() {
  const { totalPop } = await getOrCreateHousingContext().getCityPopulationSummary();
  return totalPop;
}

async function getCityEmploymentSummary() {
  return getOrCreateEmploymentContext().getCityEmploymentSummary();
}

/**
 * Composition root — Accounting bounded context.
 *
 * Default: session journal buffer + Dexie treasury read/write (Phase 4).
 * Inject legacy adapters via deps for regression tests.
 *
 * @param {object} [deps]
 * @param {import('../contexts/accounting/application/ports/JournalRepository.js').JournalRepository} [deps.journalRepository]
 * @param {import('../contexts/accounting/application/ports/JournalWritePort.js').JournalWritePort} [deps.journalWritePort]
 * @param {import('../contexts/accounting/application/ports/GameTimePort.js').GameTimePort} [deps.gameTimePort]
 * @param {import('../contexts/accounting/infrastructure/session/SessionJournalStore.js').SessionJournalStore} [deps.sessionJournalStore]
 * @param {import('../contexts/accounting/infrastructure/session/SessionJournalStore.js').SessionJournalStore} [deps.journalManager]
 * @param {import('dexie').Dexie} [deps.db]
 * @param {import('../contexts/accounting/infrastructure/dexie/DexieObjectiveHistoryRepository.js').DexieObjectiveHistoryRepository} [deps.objectiveHistoryRepository]
 * @param {() => string[]} [deps.listBuildingTypesForMaintenance]
 * @param {(turn: number) => object} [deps.getTimeInfo]
 * @param {import('../contexts/accounting/infrastructure/persistence/LocalStorageFiscalSettingsRepository.js').LocalStorageFiscalSettingsRepository} [deps.fiscalSettingsRepository]
 * @param {() => number} [deps.getCitizenTaxPerCapita]
 * @param {() => { salaryPerMonth: number, salaryTaxRate: number }} [deps.getSalarySettings]
 */
export function createAccountingContext(deps = {}) {
  const sessionJournalStoreInstance =
    deps.sessionJournalStore ?? deps.journalManager ?? sessionJournalStore;
  const dexieDb = deps.db ?? sessionJournalStoreInstance.db;
  const defaultInitialFunds = deps.defaultInitialFunds ?? readInitialFundsFromImportMeta();
  const objectiveHistoryRepository =
    deps.objectiveHistoryRepository ?? new DexieObjectiveHistoryRepository(dexieDb);
  // The customs rate is the city's (localStorage); the other rates are each hamlet's (its own row in the database).
  const fiscalSettingsRepository =
    deps.fiscalSettingsRepository ?? new LocalStorageFiscalSettingsRepository();
  const hamletFiscalRates = deps.hamletFiscalRateRepository ?? new HamletFiscalRateRepository(dexieDb);

  const getTimeInfo = deps.getTimeInfo ?? resolveGetTimeInfo();

  const gameTimePort =
    deps.gameTimePort ??
    new LegacyGameTimePort({
      getTimeInfo,
      currentTurn: deps.currentTurn ?? getSessionGameTime,
    });

  if (!sessionJournalStoreInstance.gameTimePort) {
    sessionJournalStoreInstance.setGameTimePort(gameTimePort);
  }

  const journalWritePort =
    deps.journalWritePort ??
    new SessionJournalWriteAdapter(sessionJournalStoreInstance);


  const recordLedgerEntryCommand = new RecordLedgerEntry(
    journalWritePort,
    gameTimePort
  );
  const recordMaintenanceExpense = new RecordMaintenanceExpense(
    recordLedgerEntryCommand
  );
  const recordConstructionExpense = new RecordConstructionExpense(
    recordLedgerEntryCommand
  );
  const recordSalaryExpense = new RecordSalaryExpense(
    recordLedgerEntryCommand
  );
  const recordUnemploymentBenefitExpense = new RecordUnemploymentBenefitExpense(
    recordLedgerEntryCommand
  );
  const recordPayrollTaxIncome = new RecordPayrollTaxIncome(
    recordLedgerEntryCommand
  );
  const recordCitizenTaxIncome = new RecordCitizenTaxIncome(
    recordLedgerEntryCommand
  );
  const recordLoanCapitalIncome = new RecordLoanCapitalIncome(
    recordLedgerEntryCommand
  );
  const recordLoanInterestExpense = new RecordLoanInterestExpense(
    recordLedgerEntryCommand
  );
  const recordLoanRepaymentExpense = new RecordLoanRepaymentExpense(
    recordLedgerEntryCommand
  );
  const recordInfoLoanInstallment = new RecordInfoLoanInstallment(
    recordLedgerEntryCommand
  );
  const recordCommerceImportExpense = new RecordCommerceImportExpense(
    recordLedgerEntryCommand
  );
  const recordCommerceExportIncome = new RecordCommerceExportIncome(
    recordLedgerEntryCommand
  );
  const recordCapitalFundsIncome = new RecordCapitalFundsIncome(
    recordLedgerEntryCommand
  );
  const recordExceptionalExpense = new RecordExceptionalExpense(
    recordLedgerEntryCommand
  );
  const recordCommercialRouteExpense = new RecordCommercialRouteExpense(
    recordLedgerEntryCommand
  );
  const recordConstructionRefundIncome = new RecordConstructionRefundIncome(
    recordLedgerEntryCommand
  );

  const journalRepository =
    deps.journalRepository ??
    new SessionJournalRepository({
      sessionJournalStore: sessionJournalStoreInstance,
      gameTimePort,
    });


  const initializeTreasury = new InitializeTreasury(
    recordCapitalFundsIncome,
    defaultInitialFunds
  );
  const getTreasurySnapshotQuery = new GetTreasurySnapshot(
    initializeTreasury,
    journalRepository,
    gameTimePort
  );
  const recordContributionExpense = new RecordContributionExpense(
    recordLedgerEntryCommand,
    getTreasurySnapshotQuery
  );
  const forceReinitializeTreasury = new ForceReinitializeTreasury(
    initializeTreasury,
    {
      // The memory buffer is the journal the treasury is derived from: clear it with the rows, never one without the other.
      clear: async () => {
        await sessionJournalStoreInstance.clearAllEntries();
      },
    },
    defaultInitialFunds
  );
  const getFinancialHealthQuery = new GetFinancialHealth(getTreasurySnapshotQuery);

  const getTreasuryBalanceQuery = new GetTreasuryBalance(getTreasurySnapshotQuery);
  const getCityLedgerYearComparisonQuery = new GetCityLedgerYearComparison(
    journalRepository,
    getTreasurySnapshotQuery,
    gameTimePort
  );
  const getGeneralLedgerQuery = new GetGeneralLedger(
    journalRepository,
    getTreasurySnapshotQuery,
    gameTimePort
  );
  const cityAssetsValuationPort =
    deps.cityAssetsValuationPort
    ?? new CityAssetsValuationAdapter(
      deps.cityAssets ?? getOrCreateCityAssetsContext()
    );
  const journalSessionPersistencePort =
    deps.journalSessionPersistencePort ??
    new DexieJournalSessionPersistenceAdapter(dexieDb);
  const flushJournalSession = new FlushJournalSession(journalSessionPersistencePort);
  const exportJournalJsonQuery = new ExportJournalJson(journalRepository);
  const exportJournalPdfQuery = new ExportJournalPdf(journalRepository);

  // The houses a tax or a charge is computed on are the active hamlet's: its journal books them.
  const houseReadPort = {
    listHouses: async () => (await dexieDb.houses.toArray()).filter(isActiveHamletRow),
  };

  const getCitizenTaxPerCapita =
    deps.getCitizenTaxPerCapita ?? (() => hamletFiscalRates.getCitizenTaxPerCapita());

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
      recordUnemploymentBenefitExpense: (params) =>
        recordUnemploymentBenefitExpense.execute(params),
      recordPayrollTaxIncome: (params) => recordPayrollTaxIncome.execute(params),
      recordExceptionalExpense: (params) => recordExceptionalExpense.execute(params),
      recordCommercialRouteExpense: (params) => recordCommercialRouteExpense.execute(params),
      recordCommerceImportExpense: (params) => recordCommerceImportExpense.execute(params),
      recordCommerceExportIncome: (params) => recordCommerceExportIncome.execute(params),
      recordLoanCapitalIncome: (params) => recordLoanCapitalIncome.execute(params),
      recordLoanInterestExpense: (params) => recordLoanInterestExpense.execute(params),
      recordLoanRepaymentExpense: (params) => recordLoanRepaymentExpense.execute(params),
      recordInfoLoanInstallment: (params) => recordInfoLoanInstallment.execute(params),
    },
  });


  const getSalarySettings =
    deps.getSalarySettings ?? (() => hamletFiscalRates.getSalarySettings());

  // The services of a month are read from the transactions log (the supply's), and billed here.
  const supplyTraceabilityRepository =
    deps.supplyTraceabilityRepository ?? new DexieSupplyTraceabilityRepository(dexieDb);
  const settleServiceSubsidies = new SettleServiceSubsidies({
    getTimeInfo: (turn) => gameTimePort.getTimeInfo(turn),
    sumServiceDeliveries: (year, monthIndex) =>
      supplyTraceabilityRepository.sumServiceDeliveries(year, monthIndex),
    getServiceSubsidies: () => hamletFiscalRates.getServiceSubsidies(),
    getServicePrice: (service) => getResourceBaseValue(service),
    recordLedgerEntry: (params) => recordLedgerEntryCommand.execute({ ...params }),
    recordServiceBilling: (billing) => supplyTraceabilityRepository.recordServiceBilling(billing),
  });
  const settleVat = new SettleVat({
    getTimeInfo: (turn) => gameTimePort.getTimeInfo(turn),
    sumGoodSalesToHouses: (year, monthIndex) =>
      supplyTraceabilityRepository.sumGoodSalesToHouses(year, monthIndex),
    getVatRates: () => hamletFiscalRates.getVatRates(),
    recordLedgerEntry: (params) => recordLedgerEntryCommand.execute({ ...params }),
  });

  const processTurnBudget = new ProcessTurnBudget({
    collectCitizenTaxes: (time) => collectCitizenTaxes.execute({ time }),
    recordSalaries: (...args) => gameTreasuryRecording.recordSalaries(...args),
    recordPayrollTax: (...args) => gameTreasuryRecording.recordPayrollTax(...args),
    recordUnemploymentBenefits: (...args) =>
      gameTreasuryRecording.recordUnemploymentBenefits(...args),
    recordBuildingMaintenance: (amount, description, turn) =>
      recordBuildingMaintenanceForCity.execute({ amount, description, turn }),
    getTimeInfo: (time) => gameTimePort.getTimeInfo(time),
    getCityTotalPopulation:
      deps.getCityTotalPopulation ?? (() => getCityTotalPopulation()),
    getCityEmploymentSummary:
      deps.getCityEmploymentSummary ?? (() => getCityEmploymentSummary()),
    getSalarySettings,
    settleServiceSubsidies: (params) => settleServiceSubsidies.execute(params),
    settleVat: (params) => settleVat.execute(params),
    processLoanPayments:
      deps.processLoanPayments ??
      (async () => {
        const processLoanPayments = getSessionProcessLoanPayments();
        if (processLoanPayments) {
          await processLoanPayments();
        }
      }),
    cleanupOldJournalYears: (keepYears) =>
      sessionJournalStoreInstance.cleanupOldJournalYears(keepYears),
    flushJournalSessionToDexie: () => flushJournalSession.execute(),
    listBuildingTypesForMaintenance:
      deps.listBuildingTypesForMaintenance ?? listSceneBuildingTypesForMaintenance,
  });

  return {
    journalRepository,
    fiscalSettingsRepository,
    hamletFiscalRates,
    journalWritePort,
    gameTimePort,
    recordLedgerEntryCommand,
    recordMaintenanceExpense,
    recordConstructionExpense,
    recordSalaryExpense,
    recordUnemploymentBenefitExpense,
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
    recordContributionExpense,
    recordConstructionRefundIncome,
    getTreasuryBalanceQuery,
    getTreasurySnapshotQuery,
    getFinancialHealthQuery,
    initializeTreasury,
    forceReinitializeTreasury,
    getCityLedgerYearComparisonQuery,
    getGeneralLedgerQuery,
    flushJournalSession,
    exportJournalJsonQuery,
    exportJournalPdfQuery,
    journalSessionPersistencePort,
    cityAssetsValuationPort,

    async getTreasuryBalance() {
      return getTreasuryBalanceQuery.execute();
    },

    /** @param {{ hamletId?: string|null }} [options] */
    async getTreasurySnapshot(options) {
      return getTreasurySnapshotQuery.execute(options);
    },

    async getFinancialHealth() {
      return getFinancialHealthQuery.execute();
    },

    /** @param {number|null} [startingFunds] */
    async initializeTreasury(startingFunds = null) {
      return initializeTreasury.execute(startingFunds);
    },

    /** Keeps the existing treasury and journal; creates them only when the save has none yet. */
    /** @param {number|null} [startingFunds] */
    async ensureTreasury(startingFunds = null) {
      return initializeTreasury.execute(startingFunds);
    },

    /** @param {number|null} [startingFunds] */
    async forceReinitializeTreasury(startingFunds = null) {
      return forceReinitializeTreasury.execute(startingFunds);
    },


    async getActiveLoans() {
      return (await getTreasurySnapshotQuery.execute()).loans;
    },

    async getCityLedgerYearComparison(options) {
      return getCityLedgerYearComparisonQuery.execute(options);
    },

    async getGeneralLedger(filters) {
      return getGeneralLedgerQuery.execute(filters);
    },

    /** @param {{ fiscalYear?: number|null }} [options] */


    /** @param {number} atTurn */

    /** @param {{ everyNTurns?: number, turns?: number[]|null, filterTurn?: number|null }} [options] */

    /**
     * @param {object} params
     * @param {number} params.turn
     * @param {{ population?: number, buildingCounts?: object }} [params.additionalData]
     */

    async flushJournalSessionToDexie() {
      return flushJournalSession.execute();
    },

    async exportJournalJson() {
      return exportJournalJsonQuery.execute();
    },

    async exportJournalPdf() {
      return exportJournalPdfQuery.execute();
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

    /** @param {Parameters<RecordUnemploymentBenefitExpense['execute']>[0]} params */
    async recordUnemploymentBenefitExpense(params) {
      return recordUnemploymentBenefitExpense.execute(params);
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

    /** @param {Parameters<RecordContributionExpense['execute']>[0]} params */
    async recordContributionExpense(params) {
      return recordContributionExpense.execute(params);
    },

    /**
     * Settle a news contribution (Intelligence paywall).
     * @param {{ newsItemId: string, amount: number, turn: number, description?: string, channelId?: string }} params
     */
    async settleContribution(params) {
      return recordContributionExpense.execute(params);
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

    /** @param {Parameters<GameTreasuryRecording['recordUnemploymentBenefits']>} args */
    async recordUnemploymentBenefits(...args) {
      return gameTreasuryRecording.recordUnemploymentBenefits(...args);
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




    async canAfford(amount) {
      const budget = await getTreasurySnapshotQuery.execute();
      return canAffordFromBudget(budget, amount);
    },

    /** The active hamlet's citizen tax per inhabitant. */
    getCitizenTaxPerCapita() {
      return hamletFiscalRates.getCitizenTaxPerCapita();
    },

    /** @param {number} amount @returns {Promise<number>} */
    setCitizenTaxPerCapita(amount) {
      return hamletFiscalRates.setCitizenTaxPerCapita(amount);
    },

    /** The active hamlet's civil servant salary and the taxes it bears. */
    getSalarySettings() {
      return hamletFiscalRates.getSalarySettings();
    },

    /** @param {{ salaryPerMonth?: number, salaryTaxRate?: number, unemploymentBenefitRate?: number }} partial */
    setSalarySettings(partial) {
      return hamletFiscalRates.setSalarySettings(partial);
    },

    /** Writes the default rates on a hamlet that has none yet (its creation). @param {string} hamletId */
    ensureHamletFiscalRates(hamletId) {
      return hamletFiscalRates.ensureRates(hamletId);
    },

    /** @returns {Promise<Record<string, number>>} the active hamlet's subsidy per service, in percent. */
    getServiceSubsidies() {
      return hamletFiscalRates.getServiceSubsidies();
    },

    /** @param {string} service @param {number} percent */
    setServiceSubsidy(service, percent) {
      return hamletFiscalRates.setServiceSubsidy(service, percent);
    },

    /** @returns {Promise<Record<string, number>>} the active hamlet's VAT rate per good, in percent. */
    getVatRates() {
      return hamletFiscalRates.getVatRates();
    },

    /** @param {string} good @param {number} percent */
    setVatRate(good, percent) {
      return hamletFiscalRates.setVatRate(good, percent);
    },

    /** Writes the default customs rate when the city has none yet (boot). */
    ensureCustomsRate() {
      fiscalSettingsRepository.ensureCustomsRate();
    },

    /** @returns {number} customs rate in [0, 0.5] */
    getCustomsRate() {
      return fiscalSettingsRepository.getCustomsRate();
    },

    /** @param {number} rate @returns {number} clamped rate */
    setCustomsRate(rate) {
      return fiscalSettingsRepository.setCustomsRate(rate);
    },


    /** @param {number} keepYears */
    async cleanupOldJournalYears(keepYears) {
      return sessionJournalStoreInstance.cleanupOldJournalYears(keepYears);
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
