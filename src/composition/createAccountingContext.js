import { getOrCreateGameSessionContext } from './createGameSessionContext.js';
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
import { GameTreasuryRecording } from '../contexts/accounting/application/services/game/GameTreasuryRecording.js';
import { ProcessTurnBudget } from '../contexts/accounting/application/services/ProcessTurnBudget.js';
import { RecordConsumerPurchases } from '../contexts/accounting/application/services/RecordConsumerPurchases.js';
import { GetProducerRevenues } from '../contexts/accounting/application/queries/GetProducerRevenues.js';
import { buildingAccountTrace } from '../contexts/accounting/domain/policies/BuildingAccountTracePolicy.js';
import { buildingFinanceFigures, householdBudgetOf, householdLastMonthOf } from '../contexts/accounting/domain/policies/BuildingFinancePolicy.js';
import { residentsOfHouse } from '../contexts/accounting/domain/policies/HouseResidentsPolicy.js';
import { residentPayBreakdownOf } from '../contexts/accounting/domain/policies/HouseResidentsPayPolicy.js';
import { householdPublicPayOf } from '../contexts/accounting/domain/policies/HouseholdPublicPayPolicy.js';
import { MONTHS_PER_YEAR } from '../shared/time/TimeCalendar.js';
import { isLucrativeBuilding } from '../contexts/accounting/domain/policies/ProducerChargePolicy.js';
import { BUILDING_KIND_HOUSE, resolveBuildingKind } from '../shared/building-identity/index.js';
import { DexieSupplyTraceabilityRepository } from '../contexts/supply/infrastructure/dexie/DexieSupplyTraceabilityRepository.js';
import { getResourceBaseValue } from '../shared/resource-catalog/ResourceCategoryCatalog.js';
import {
  canAffordFromBudget,
} from '../contexts/accounting/application/queries/treasury/GameTreasuryProjections.js';
import { isActiveHamletRow } from '../core/persistence/hamlet/hamletSession.js';
import { buildingMaintenanceCost } from '../contexts/accounting/domain/policies/BuildingMaintenanceBreakdownPolicy.js';
import { SettleProducerCharges } from '../contexts/accounting/application/services/SettleProducerCharges.js';
import { resolveGetTimeInfo } from './gameTimeBridge.js';

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

  const gameTreasuryRecording = new GameTreasuryRecording({
    getTreasurySnapshot: getTreasurySnapshotQuery,
    commands: {
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

  // The services of a month are read from the transactions log (the supply's), and settled here.
  const supplyTraceabilityRepository =
    deps.supplyTraceabilityRepository ?? new DexieSupplyTraceabilityRepository(dexieDb);
  const getProducerRevenues = new GetProducerRevenues({
    getJournalEntries: () => journalRepository.getJournalEntries(),
    getBuildingTypes: async () =>
      new Map((await dexieDb.houses.toArray()).filter(isActiveHamletRow).map((row) => [row.id, row.type])),
  });
  // A company's charges are read from its goods and service flows and its upkeep, once per delivered month.
  const settleProducerCharges = new SettleProducerCharges({
    getTimeInfo: (turn) => gameTimePort.getTimeInfo(turn),
    listBuildings: async () =>
      (await dexieDb.houses.toArray())
        .filter(isActiveHamletRow)
        .map((row) => ({ id: row.id, type: row.type, workerSources: row.employees?.workerSources ?? {} })),
    sumGoodsFlowsByPair: (year, monthIndex) =>
      supplyTraceabilityRepository.sumGoodsFlowsByPair(year, monthIndex),
    sumServiceFlows: (year, monthIndex) => supplyTraceabilityRepository.sumServiceFlows(year, monthIndex),
    fundsOf: async (houseId) =>
      (await getTreasurySnapshotQuery.execute({ accountBuildingId: houseId, accountKind: 'particulier' })).funds,
    getVatRates: () => hamletFiscalRates.getVatRates(),
    listHouses: async () =>
      (await dexieDb.houses.toArray())
        .filter(isActiveHamletRow)
        .filter((row) => resolveBuildingKind(row.type) === BUILDING_KIND_HOUSE)
        .map((row) => {
          if (!Number.isInteger(row.pop) || row.pop < 0) throw new Error(`[households] house ${row.id} has no residents count`);
          return { id: row.id, pop: row.pop };
        }),
    getPublicPay: async () => {
      const settings = await hamletFiscalRates.getSalarySettings();
      return { salaryPerMonth: settings.salaryPerMonth, unemploymentBenefitRate: settings.unemploymentBenefitRate };
    },
    getSalaryTax: async () => {
      const settings = await hamletFiscalRates.getSalarySettings();
      return { rate: settings.salaryTaxRate, threshold: settings.salaryTaxThreshold };
    },
    sumHouseSales: async (year, monthIndex) => {
      // A house's purchase of goods is a sale of the company, the counterparty being the house (see RecordConsumerPurchases).
      const entries = await journalRepository.getJournalEntries();
      const kinds = new Map((await dexieDb.houses.toArray()).filter(isActiveHamletRow).map((row) => [row.id, row.type]));
      return entries
        .filter((entry) =>
          entry.type === 'producer_revenue' && entry.year === year && entry.month === monthIndex + 1 &&
          entry.accountBuildingId && entry.counterpartyBuildingId &&
          resolveBuildingKind(kinds.get(entry.counterpartyBuildingId)) === BUILDING_KIND_HOUSE)
        .map((entry) => ({ sellerId: entry.accountBuildingId, amountHT: entry.amount }));
    },
    recordServiceCutOff: (cutOff) => supplyTraceabilityRepository.recordServiceCutOff(cutOff),
    getServiceSubsidies: () => hamletFiscalRates.getServiceSubsidies(),
    getServicePrice: (service) => getResourceBaseValue(service),
    buildingMaintenanceCost,
    recordLedgerEntry: (params) => recordLedgerEntryCommand.execute({ ...params }),
    recordEconomyMovement: (movement) => supplyTraceabilityRepository.recordEconomyMovement(movement),
  });
  const recordConsumerPurchases = new RecordConsumerPurchases({
    getVatRates: () => hamletFiscalRates.getVatRates(),
    recordLedgerEntry: (params) => recordLedgerEntryCommand.execute({ ...params }),
  });

  const processTurnBudget = new ProcessTurnBudget({
    collectCitizenTaxes: (time) => collectCitizenTaxes.execute({ time }),
    getTimeInfo: (time) => gameTimePort.getTimeInfo(time),
    settleProducerCharges: (params) => settleProducerCharges.execute(params),
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

    /**
     * Whether a building type has a journal account of its own: a house, or a company (a producer, a hub or a seller of goods).
     * @param {string} buildingType
     * @returns {boolean}
     */
    hasBuildingAccount(buildingType) {
      return resolveBuildingKind(buildingType) === BUILDING_KIND_HOUSE || isLucrativeBuilding(buildingType);
    },

    /**
     * The Finance tab of a building: its analytical account for the last month and for the year, and its cash.
     * A month's charges are settled at the start of the month that follows it, so the lines stamped with the current
     * month are the last month's activity. The year column is the year's settled lines so far.
     * @param {string} buildingId
     * @param {string | null} accountKind a house's account (particulier or entreprise); null for a company's account
     * @returns {Promise<{ lastMonth: object, year: object, cash: number }>}
     */
    async getBuildingFinance(buildingId, accountKind) {
      const now = gameTimePort.getTimeInfo(gameTimePort.currentTurn());
      const entries = await journalRepository.getJournalEntries();
      const snapshot = await getTreasurySnapshotQuery.execute({ accountBuildingId: buildingId, accountKind });
      // The month before the current one: a house's goods are dated by their delivery, its salary and services by the settlement.
      const previous = now.monthIndex === 0
        ? { year: now.year - 1, month: MONTHS_PER_YEAR }
        : { year: now.year, month: now.monthIndex };
      const settled = { year: now.year, month: now.monthIndex + 1 };
      return {
        lastMonth: accountKind === 'particulier'
          ? { ...buildingFinanceFigures(entries, buildingId, { ...settled, accountKind }), ...householdLastMonthOf(entries, buildingId, { settled, bought: previous }) }
          : buildingFinanceFigures(entries, buildingId, { ...settled, accountKind }),
        year: buildingFinanceFigures(entries, buildingId, { year: now.year, accountKind }),
        cash: snapshot.funds,
        // A house's personal account has its monthly budget, and the savings it had at the start of the year (what its
        // balance was before the year's lines: the year's result is what it added since); a company's account has neither.
        budget: accountKind === 'particulier'
          ? householdBudgetOf(entries, buildingId, { year: now.year, month: now.monthIndex + 1, balance: snapshot.funds })
          : null,
        openingSavings: accountKind === 'particulier'
          ? snapshot.funds - buildingFinanceFigures(entries, buildingId, { year: now.year, accountKind }).householdResult
          : null,
      };
    },

    /**
     * The trace of a company's account: its movements and the companies it traded with (see buildingAccountTrace).
     * @param {string} buildingId
     */
    async getBuildingAccountTrace(buildingId) {
      return buildingAccountTrace(await journalRepository.getJournalEntries(), buildingId);
    },

    /**
     * The citizens of a household: each resident with his workplace or his status (see HouseResidentsPolicy), and his
     * share of the pay already booked for the settled month (see HouseResidentsPayPolicy) — a split of the journal's
     * figure, never a new one; a group not yet settled this month shows no amount, not a guessed zero.
     * @param {string} houseId
     */
    async getHouseResidents(houseId) {
      const rows = (await dexieDb.houses.toArray()).filter(isActiveHamletRow);
      const house = rows.find((row) => row.id === houseId);
      if (!house) throw new Error(`[residents] household ${houseId} is not in the hamlet`);
      if (!Number.isInteger(house.pop)) throw new Error(`[residents] household ${houseId} has no residents count`);
      const workplaces = rows
        .filter((row) => (row.employees?.workerSources?.[houseId] ?? 0) > 0)
        .map((row) => ({ workplaceId: row.id, workplaceType: row.type, workers: row.employees.workerSources[houseId] }));
      const residents = residentsOfHouse({ houseId, pop: house.pop, workplaces: workplaces.map(({ workplaceId, workers }) => ({ workplaceId, workers })) });
      const typeOf = new Map(workplaces.map((entry) => [entry.workplaceId, entry.workplaceType]));

      const workers = workplaces.reduce((sum, entry) => sum + entry.workers, 0);
      const settings = await hamletFiscalRates.getSalarySettings();
      const expectedPay = householdPublicPayOf({
        pop: house.pop,
        workers,
        referenceSalaryPerMonth: settings.salaryPerMonth,
        unemploymentBenefitRate: settings.unemploymentBenefitRate,
      });
      const now = gameTimePort.getTimeInfo(gameTimePort.currentTurn());
      const entries = await journalRepository.getJournalEntries();
      const breakdown = residentPayBreakdownOf(
        residents,
        entries,
        { houseId, year: now.year, month: now.monthIndex + 1 },
        { predictedPublicPay: expectedPay.publicPay, predictedBenefit: expectedPay.benefit },
      );
      const payOf = new Map(breakdown.map((entry) => [entry.id, entry]));

      return residents.map((resident) => ({
        ...resident,
        workplaceType: resident.workplaceId ? typeOf.get(resident.workplaceId) : null,
        ...payOf.get(resident.id),
      }));
    },

    /**
     * A company's own account: what it has kept of its sales after purchases, wages, upkeep and corporate tax.
     * @param {string} buildingId
     * @returns {Promise<number>}
     */
    /**
     * Whether a house is cut off from a service for a month: its bill for the month before was not paid.
     * @param {{ houseId: string, service: string, year: number, monthIndex: number }} params
     */
    isServiceCutOff(params) {
      return supplyTraceabilityRepository.hasServiceCutOff(params);
    },

    /**
     * The goods a delivery sold to houses, paid per unit: the houses' purchases, the sellers' revenue and the VAT.
     * @param {{ turn: number, timeInfo: object, distributorId: string, distributorType: string, purchases: Array<object> }} params
     */
    recordConsumerPurchases(params) {
      return recordConsumerPurchases.execute(params);
    },

    async getBuildingAccountBalance(buildingId, accountKind = null) {
      const snapshot = await getTreasurySnapshotQuery.execute({ accountBuildingId: buildingId, accountKind });
      return snapshot.funds;
    },

    /**
     * The HT revenue of each producer of the active hamlet in one month, largest first (see GetProducerRevenues).
     * @param {number} year @param {number} monthIndex
     */
    getProducerRevenues(year, monthIndex) {
      return getProducerRevenues.execute(year, monthIndex);
    },

    /** @returns {Promise<Record<string, number>>} the active hamlet's subsidy per service, in percent. */
    getServiceSubsidies() {
      return hamletFiscalRates.getServiceSubsidies();
    },

    /** @param {string} service @param {number} percent */
    setServiceSubsidy(service, percent) {
      return hamletFiscalRates.setServiceSubsidy(service, percent);
    },

    /** @returns {Promise<{ uniform: boolean, generalRatePercent: number, categoryRatesPercent: Record<string, number> }>} the active hamlet's VAT. */
    getVatSettings() {
      return hamletFiscalRates.getVatSettings();
    },

    /** @param {boolean} uniform */
    setVatUniform(uniform) {
      return hamletFiscalRates.setVatUniform(uniform);
    },

    /** @param {number} percent */
    setVatGeneralRate(percent) {
      return hamletFiscalRates.setVatGeneralRate(percent);
    },

    /** @param {string} item a good or a service @param {boolean} exempt */
    setVatExempt(item, exempt) {
      return hamletFiscalRates.setVatExempt(item, exempt);
    },

    /** @param {string} category @param {number} percent */
    setVatCategoryRate(category, percent) {
      return hamletFiscalRates.setVatCategoryRate(category, percent);
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
