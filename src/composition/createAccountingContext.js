import { getOrCreateGameSessionContext } from './createGameSessionContext.js';
import { getQuantityConsumerEntries, salesNatureOf } from '../shared/building-catalog/resourceRoleQueries.js';
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
import { listTradedGoods } from '../shared/trade-catalog/TradeCatalog.js';
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
import { accountKeyOf } from '../contexts/accounting/domain/policies/AccountKeyPolicy.js';
import { AdjustWageRates } from '../contexts/accounting/application/services/AdjustWageRates.js';
import { RevalueMinimumWage } from '../contexts/accounting/application/services/RevalueMinimumWage.js';
import { DexieWageRateRepository, wageKey } from '../contexts/accounting/infrastructure/persistence/DexieWageRateRepository.js';
import { benefitBaseOf, flooredWage, readLabourMarket, startWageOf, wageFloorOf } from '../contexts/accounting/domain/policies/WageRatePolicy.js';
import { wagePerWorkerOf } from '../contexts/accounting/domain/policies/ProducerChargePolicy.js';
import { pcgOfJournalType } from '../shared/accounting-catalog/PcgJournalCatalog.js';
import { buildingFinanceFigures, cashMovementsOf, householdBudgetOf, householdLastMonthOf, incomeStatementOf } from '../contexts/accounting/domain/policies/BuildingFinancePolicy.js';
import { residentsOfHouse } from '../contexts/accounting/domain/policies/HouseResidentsPolicy.js';
import { residentPayBreakdownOf } from '../contexts/accounting/domain/policies/HouseResidentsPayPolicy.js';
import { householdPublicPayOf } from '../contexts/accounting/domain/policies/HouseholdPublicPayPolicy.js';
import { MONTHS_PER_YEAR } from '../shared/time/TimeCalendar.js';
import { isLucrativeBuilding } from '../contexts/accounting/domain/policies/ProducerChargePolicy.js';
import { BUILDING_KIND_HOUSE, resolveBuildingKind } from '../shared/building-identity/index.js';
import { houseHoldsSkill, residentsSeekingWork } from '../shared/population/workforceQueries.js';
import { OWNER_SKILL, TAX_COLLECTOR_SKILL } from '../shared/population/socialCategoryCatalog.js';
import { rentDebtsOf } from '../contexts/accounting/domain/policies/RentPolicy.js';
import { SettleHouseRents } from '../contexts/accounting/application/services/SettleHouseRents.js';
import { DexieSupplyTraceabilityRepository } from '../contexts/supply/infrastructure/dexie/DexieSupplyTraceabilityRepository.js';
import { getResourceBaseValue, getServiceCategories } from '../shared/resource-catalog/ResourceCategoryCatalog.js';
import {
  canAffordFromBudget,
} from '../contexts/accounting/application/queries/treasury/GameTreasuryProjections.js';
import { isActiveHamletRow } from '../core/persistence/hamlet/hamletSession.js';
import { buildingMaintenanceCost } from '../contexts/accounting/domain/policies/BuildingMaintenanceBreakdownPolicy.js';
import { SettleProducerCharges } from '../contexts/accounting/application/services/SettleProducerCharges.js';
import { RecordHouseholdDeposit } from '../contexts/accounting/application/services/RecordHouseholdDeposit.js';
import { RecordHouseholdWithdrawal } from '../contexts/accounting/application/services/RecordHouseholdWithdrawal.js';
import { SettleBankDepositInterest } from '../contexts/accounting/application/services/SettleBankDepositInterest.js';
import { depositBalanceOf, depositInterestsOf } from '../contexts/accounting/domain/policies/DepositBalancePolicy.js';
import { DEPOSIT_INTEREST_RATE } from '../contexts/accounting/domain/catalogs/BankCatalog.js';
import { getBuildingDefinition } from '../shared/building-catalog/buildingCatalog.js';
import { resolveGetTimeInfo } from './gameTimeBridge.js';
import { SOCIAL_CATEGORY } from '../shared/population/socialCategoryCatalog.js';
import { COST_OF_LIVING_BASKET } from '../contexts/accounting/domain/catalogs/LabourMarketCatalog.js';
import { costOfLivingOf } from '../contexts/accounting/domain/policies/CostOfLivingPolicy.js';
import { serviceSubsidyShare } from '../contexts/accounting/domain/policies/ServiceSubsidyPolicy.js';
import { addVatTo } from '../contexts/accounting/domain/policies/VatIncludedPolicy.js';

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
 * @param {() => { minimumWage: number, salaryTaxThreshold1: number, salaryTaxRate1: number, salaryTaxThreshold2: number, salaryTaxRate2: number }} [deps.getSalarySettings]
 * @param {(building: { id: string, type: string }, category: string, period: { year: number, monthIndex: number }) => Promise<number>} [deps.getSellingPrice]
 * @param {(period: { year: number, monthIndex: number }) => Promise<Array<{ stage: string, buildingId: string, category: string, price: number }>>} [deps.listSellingPrices] what each seller charges per good (HT), for the cost of living
 * @param {(period: { year: number, monthIndex: number }) => Promise<Array<{ stage: string, buildingId: string, category: string, price: number }>>} [deps.listServicePrices] what each seller charges per service unit (HT), for the cost of living
 *   the supply's price of a good or a service a building sold in a month (its price book), what a service is billed at
 * @param {() => { rows: Array<{ skill: string, level: number, jobs: number, filled: number, vacancies: number, idle: number }> } | null} [deps.getLabourMarket]
 *   the labour market of the last worker distribution (employment's), read each month to move the wages
 */

/**
 * One journal type's lines of one month, grouped by the account that holds them — the shape
 * SettleProducerCharges reads its journal-sourced income/expense sources in (bank interest earned, bank
 * interest paid), since neither has a supply-chain trace to read instead.
 * @param {Array<object>} entries
 * @param {string} type
 * @param {number} year
 * @param {number} monthIndex
 * @returns {Array<{ buildingId: string, amountHT: number }>}
 */
function sumJournalAmountByBuilding(entries, type, year, monthIndex) {
  const byBuilding = new Map();
  for (const entry of entries) {
    if (entry.type !== type || entry.year !== year || entry.month !== monthIndex + 1) continue;
    if (!entry.accountBuildingId) throw new Error(`[bank] a "${type}" line (turn ${entry.turn}) names no account`);
    byBuilding.set(entry.accountBuildingId, (byBuilding.get(entry.accountBuildingId) ?? 0) + entry.amount);
  }
  return [...byBuilding.entries()].map(([buildingId, amountHT]) => ({ buildingId, amountHT }));
}

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
    defaultInitialFunds,
    { hasAnyEntry: async () => (await journalRepository.getJournalEntries()).length > 0 }
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
    recordLedgerEntry: recordLedgerEntryCommand,
    houseReadPort,
    getCitizenTaxPerCapita,
    getTimeInfo: (time) => gameTimePort.getTimeInfo(time),
    // The tax is collected by the city's tax collectors: the residents of the house that holds the skill (the mayor's house).
    hasTaxCollector: async () =>
      (await dexieDb.houses.toArray())
        .filter(isActiveHamletRow)
        .some((row) => resolveBuildingKind(row.type) === BUILDING_KIND_HOUSE && row.pop >= 1 && houseHoldsSkill(row.type, row.level ?? 1, TAX_COLLECTOR_SKILL)),
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
  // The wage the labour market gives each (skill, level), never under the city's minimum wage when it has one (see WageRatePolicy.js).
  const wageRateRepository = new DexieWageRateRepository();
  const marketWageRateOf = async () => {
    const [latest, settings] = await Promise.all([wageRateRepository.latestRows(), hamletFiscalRates.getSalarySettings()]);
    const floor = wageFloorOf(settings);
    return (skill, level) => flooredWage(latest.get(wageKey(skill, level))?.amount ?? startWageOf(level), floor);
  };
  // What the unemployment benefit is a share of: the lowest wage in force, so it exists with or without a minimum wage.
  const benefitBaseOfHamlet = async (settings) => {
    const latest = await wageRateRepository.latestRows();
    return benefitBaseOf({ floor: wageFloorOf(settings), rates: [startWageOf(1), ...[...latest.values()].map((row) => row.amount)] });
  };
  // An indexed minimum wage follows the cost of living (read lazily: the context's own reader, defined below, is called only when a month settles).
  const revalueMinimumWage = new RevalueMinimumWage({
    getSalarySettings: () => hamletFiscalRates.getSalarySettings(),
    getCostOfLiving: () => accountingApi.getCostOfLiving(),
    setMinimumWage: (amount) => hamletFiscalRates.setSalarySettings({ minimumWage: amount }),
  });
  const adjustWageRates = new AdjustWageRates({
    wageRateRepository,
    getWageFloor: async () => wageFloorOf(await hamletFiscalRates.getSalarySettings()),
    getTimeInfo: (turn) => gameTimePort.getTimeInfo(turn),
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
    businessFundsOf: async (houseId) =>
      (await getTreasurySnapshotQuery.execute({ accountBuildingId: houseId, accountKind: 'entreprise' })).funds,
    getVatRates: () => hamletFiscalRates.getVatRates(),
    listHouses: async () =>
      (await dexieDb.houses.toArray())
        .filter(isActiveHamletRow)
        .filter((row) => resolveBuildingKind(row.type) === BUILDING_KIND_HOUSE)
        .map((row) => {
          if (!Number.isInteger(row.pop) || row.pop < 0) throw new Error(`[households] house ${row.id} has no residents count`);
          // The residents who look for a job: the administrators do not, so no benefit is paid for them.
          const seeking = residentsSeekingWork(row.type, row.pop);
          // `salaried`: the residents the city pays a stipend (the administrators).
          return { id: row.id, pop: seeking, salaried: row.pop - seeking };
        }),
    getPublicPay: async () => {
      const settings = await hamletFiscalRates.getSalarySettings();
      return {
        benefitBase: await benefitBaseOfHamlet(settings),
        unemploymentBenefitRate: settings.unemploymentBenefitRate,
        employerContributionRate: settings.employerContributionRate,
        employeeContributionRate: settings.employeeContributionRate,
      };
    },
    getWageRateOf: () => marketWageRateOf(),
    getSalaryTax: async () => {
      const settings = await hamletFiscalRates.getSalarySettings();
      return {
        threshold1: settings.salaryTaxThreshold1,
        rate1: settings.salaryTaxRate1,
        threshold2: settings.salaryTaxThreshold2,
        rate2: settings.salaryTaxRate2,
      };
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
    // A loan or a deposit leaves no supply-chain trace (neither is a good or a service): both the bank's interest
    // income and its own interest expense are read straight from the journal, grouped by account — see
    // RecordLoanInterestExpense.js / SettleBankDepositInterest.js, which actually write these lines.
    sumBankInterestByBuilding: async (year, monthIndex) =>
      sumJournalAmountByBuilding(await journalRepository.getJournalEntries(), 'loan_interest_received', year, monthIndex),
    recordServiceCutOff: (cutOff) => supplyTraceabilityRepository.recordServiceCutOff(cutOff),
    getServiceSubsidies: () => hamletFiscalRates.getServiceSubsidies(),
    getServicePrice: ({ service, building, period }) => {
      if (typeof deps.getSellingPrice !== 'function') throw new Error('[accounting] the selling prices were not wired (deps.getSellingPrice): a service could not be priced');
      return deps.getSellingPrice(building, service, period);
    },
    // The corporate tax is based on the résultat courant avant impôts of the statement the player reads: the same function, over the same lines.
    readCompanyYear: async (buildingId, year, accountKind = null) => {
      const building = await dexieDb.houses.get(buildingId);
      if (!building) throw new Error(`[finance] building ${buildingId} is not in the hamlet: its corporate tax cannot be based`);
      const statement = incomeStatementOf(await journalRepository.getJournalEntries(), buildingId, {
        year,
        accountKind,
        salesNature: salesNatureOf(building.type),
      });
      return {
        rcaiYearToDate: statement.results.current,
        taxPaidYearToDate: statement.sections.find((section) => section.id === 'profitTax').total,
      };
    },
    buildingMaintenanceCost,
    recordLedgerEntry: (params) => recordLedgerEntryCommand.execute({ ...params }),
    recordEconomyMovement: (movement) => supplyTraceabilityRepository.recordEconomyMovement(movement),
  });
  const recordConsumerPurchases = new RecordConsumerPurchases({
    getVatRates: () => hamletFiscalRates.getVatRates(),
    recordLedgerEntry: (params) => recordLedgerEntryCommand.execute({ ...params }),
  });

  /**
   * The active hamlet's bank — the real lender/depositary behind a loan or a deposit (see
   * RecordLoanCapitalIncome.js, RecordHouseholdDeposit.js). Several banks could exist in theory; this picks the
   * first one built, same simplicity as any other single-hub lookup in the game today. Null when none is built
   * yet — every caller refuses the action rather than inventing a bank.
   * @returns {Promise<string | null>}
   */
  const findBankBuildingId = async () => {
    const row = (await dexieDb.houses.toArray()).find((candidate) => isActiveHamletRow(candidate) && candidate.type === 'Bank');
    return row?.id ?? null;
  };

  const recordHouseholdDeposit = new RecordHouseholdDeposit({
    recordLedgerEntry: (params) => recordLedgerEntryCommand.execute({ ...params }),
    fundsOf: async (houseId) =>
      (await getTreasurySnapshotQuery.execute({ accountBuildingId: houseId, accountKind: 'particulier' })).funds,
  });
  const recordHouseholdWithdrawal = new RecordHouseholdWithdrawal({
    recordLedgerEntry: (params) => recordLedgerEntryCommand.execute({ ...params }),
    depositBalanceOf: async (houseId, bankId) => depositBalanceOf(await journalRepository.getJournalEntries(), houseId, bankId),
    fundsOf: async (bankId) => (await getTreasurySnapshotQuery.execute({ accountBuildingId: bankId })).funds,
  });
  const settleBankDepositInterest = new SettleBankDepositInterest({
    getTimeInfo: (turn) => gameTimePort.getTimeInfo(turn),
    listBuildings: async () => (await dexieDb.houses.toArray()).filter(isActiveHamletRow).map((row) => ({ id: row.id, type: row.type })),
    listDepositInterests: async (year, annualRate) => depositInterestsOf(await journalRepository.getJournalEntries(), { year, annualRate }),
    getDepositInterestRate: () => DEPOSIT_INTEREST_RATE,
    getBuildingDisplayName: (buildingType) => getBuildingDefinition(buildingType)?.displayName,
    recordLedgerEntry: (params) => recordLedgerEntryCommand.execute({ ...params }),
  });

  // The rent of every house but the owner's goes to the owner: the house whose residents hold the owner skill (the mayor's house).
  const settleHouseRents = new SettleHouseRents({
    getTimeInfo: (turn) => gameTimePort.getTimeInfo(turn),
    getRentalHouses: async () => {
      const houses = (await dexieDb.houses.toArray())
        .filter(isActiveHamletRow)
        .filter((row) => resolveBuildingKind(row.type) === BUILDING_KIND_HOUSE && row.pop >= 1)
        .sort((a, b) => String(a.id).localeCompare(String(b.id)));
      const owner = houses.find((row) => houseHoldsSkill(row.type, row.level ?? 1, OWNER_SKILL));
      if (!owner) return null;
      const nameOf = (row) => getBuildingDefinition(row.type)?.displayName;
      return {
        ownerId: owner.id,
        ownerName: nameOf(owner),
        tenants: houses.filter((row) => row.id !== owner.id && !houseHoldsSkill(row.type, row.level ?? 1, OWNER_SKILL)).map((row) => ({ id: row.id, name: nameOf(row) })),
      };
    },
    getRentPerHouse: async () => (await hamletFiscalRates.getSalarySettings()).rentPerHouse,
    getJournalEntries: () => journalRepository.getJournalEntries(),
    fundsOf: async (houseId) => (await getTreasurySnapshotQuery.execute({ accountBuildingId: houseId, accountKind: 'particulier' })).funds,
    recordLedgerEntry: (params) => recordLedgerEntryCommand.execute({ ...params }),
  });

  const processTurnBudget = new ProcessTurnBudget({
    collectCitizenTaxes: (time) => collectCitizenTaxes.execute({ time }),
    getTimeInfo: (time) => gameTimePort.getTimeInfo(time),
    settleProducerCharges: (params) => settleProducerCharges.execute(params),
    settleHouseRents: (params) => settleHouseRents.execute(params),
    settleBankDepositInterest: (params) => settleBankDepositInterest.execute(params),
    revalueMinimumWage: () => revalueMinimumWage.execute(),
    adjustWageRates: ({ time }) => {
      if (typeof deps.getLabourMarket !== 'function') throw new Error('[accounting] the labour market was not wired (deps.getLabourMarket): the wages could not be settled');
      return adjustWageRates.execute({ time, market: deps.getLabourMarket() });
    },
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

  const accountingApi = {
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

    /** @param {{ accountScope?: 'city' | 'private' | null }} [filters] */
    async exportJournalJson(filters) {
      return exportJournalJsonQuery.execute(filters);
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

    /** @param {{ minimumWage?: number, salaryTaxThreshold1?: number, salaryTaxRate1?: number, salaryTaxThreshold2?: number, salaryTaxRate2?: number, unemploymentBenefitRate?: number }} partial */
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
     * The Finance tab of a building: its analytical account for the last month, the current month so far and the
     * year, and its cash. A month's salary/services/tax are settled at the start of the month that follows it, so
     * the lines stamped with the current month are already there from day one — only a house's goods move through
     * the month as they are delivered. "Mois dernier" reads those goods from the month before (the delivered month
     * the settlement reports on); "Cumul du mois" reads the same settled lines but the goods actually bought since
     * — the two agree on everything except goods, by construction.
     * @param {string} buildingId
     * @param {string | null} accountKind a house's account (particulier or entreprise); null for a company's account
     * @param {{ month?: number | null, year?: boolean }} [view] `month` (1 to the current month of this year): the account as it stood at the end of that month, every
     *   figure read as if that month were the current one; null for now. `year`: last year's figures and this year's so far, in the place of
     *   the two month columns (`scope: 'year'`)
     * @returns {Promise<{ lastMonth: object, monthToDate: object, year: object, cash: number, month: number, currentMonth: number }>}
     */
    async getBuildingFinance(buildingId, accountKind, { month = null, year: yearView = false } = {}) {
      const now = gameTimePort.getTimeInfo(gameTimePort.currentTurn());
      const currentMonth = now.monthIndex + 1;
      if (yearView && month !== null) throw new Error('[finance] a view is a month or the year, not both');
      if (month !== null && !(Number.isInteger(month) && month >= 1 && month <= currentMonth)) {
        throw new Error(`[finance] month ${month} cannot be viewed: the account goes from month 1 to the current month (${currentMonth})`);
      }
      const viewedMonth = month ?? currentMonth;
      const isPast = viewedMonth < currentMonth;
      // Viewing a month closes the account there: the later lines of the year are not read, whatever the figure.
      const allEntries = await journalRepository.getJournalEntries();
      const entries = isPast ? allEntries.filter((entry) => entry.year !== now.year || entry.month <= viewedMonth) : allEntries;
      const snapshot = await getTreasurySnapshotQuery.execute({
        accountBuildingId: buildingId,
        accountKind,
        ...(isPast ? { untilYear: now.year, untilMonth: viewedMonth } : {}),
      });
      // A company's account is read as a compte de résultat: what its sales are (goods resold, production, services) comes from the catalog.
      const building = await dexieDb.houses.get(buildingId);
      if (!building) throw new Error(`[finance] building ${buildingId} is not in the hamlet: its accounts cannot be read`);
      const salesNature = salesNatureOf(building.type);
      // Analytic reading, outside the journal: what the building lost to spoilage in a period, and what those units would have
      // sold for (the manque à gagner, at the price the building sells that good at). A house's personal account has none.
      const spoilageOf = async (year, monthIndex = null) => {
        if (accountKind === 'particulier') return null;
        const lost = await supplyTraceabilityRepository.sumSpoilageOf(buildingId, year, monthIndex);
        const goods = Object.keys(lost);
        if (goods.length === 0) return { units: 0, lostRevenue: 0 };
        if (typeof deps.getSellingPrice !== 'function') throw new Error('[accounting] the selling prices were not wired (deps.getSellingPrice): the spoiled goods could not be valued');
        let units = 0;
        let lostRevenue = 0;
        for (const good of goods) {
          units += lost[good];
          lostRevenue += lost[good] * (await deps.getSellingPrice({ id: buildingId, type: building.type }, good, { year, monthIndex: monthIndex ?? MONTHS_PER_YEAR - 1 }));
        }
        return { units, lostRevenue: Math.round(lostRevenue * 100) / 100 };
      };
      if (yearView) {
        // The year state: last year's result next to this year's so far (none for the first year: it has no year before it).
        const thisYear = { ...buildingFinanceFigures(entries, buildingId, { year: now.year, accountKind, salesNature }), spoilage: await spoilageOf(now.year) };
        const lastYear = now.year > 0
          ? { ...buildingFinanceFigures(entries, buildingId, { year: now.year - 1, accountKind, salesNature }), spoilage: await spoilageOf(now.year - 1) }
          : null;
        return {
          scope: 'year',
          years: { current: now.year, previous: lastYear ? now.year - 1 : null },
          lastMonth: lastYear,
          monthToDate: thisYear,
          year: thisYear,
          cash: snapshot.funds,
          month: null,
          currentMonth,
          cashMovements: cashMovementsOf(entries, buildingId, { accountKind }),
          budget: null,
          // What a house had at the 1st of January: this year's opening, and last year's closing.
          openingSavings: accountKind === 'particulier' ? snapshot.funds - thisYear.householdResult : null,
        };
      }
      // The month before the current one: a house's goods are dated by their delivery, its salary and services by the settlement.
      const viewedIndex = viewedMonth - 1;
      const previous = viewedIndex === 0
        ? { year: now.year - 1, month: MONTHS_PER_YEAR }
        : { year: now.year, month: viewedIndex };
      const settled = { year: now.year, month: viewedMonth };
      // The lines of the settlement month are the activity of the month before it: the units sold are read for that month, so the cost of a
      // unit sets the charges against the units they were incurred for.
      const activity = viewedIndex === 0 ? { year: now.year - 1, monthIndex: MONTHS_PER_YEAR - 1 } : { year: now.year, monthIndex: viewedIndex - 1 };
      const unitsSold = accountKind === 'particulier'
        ? null
        : (await supplyTraceabilityRepository.sumUnitsSoldBySeller(activity.year, activity.monthIndex)).get(buildingId) ?? 0;
      const monthToDate = { ...buildingFinanceFigures(entries, buildingId, { ...settled, accountKind, salesNature, unitsSold }), spoilage: await spoilageOf(activity.year, activity.monthIndex) };
      return {
        lastMonth: accountKind === 'particulier'
          ? { ...monthToDate, ...householdLastMonthOf(entries, buildingId, { settled, bought: previous }) }
          : monthToDate,
        monthToDate,
        year: { ...buildingFinanceFigures(entries, buildingId, { year: now.year, accountKind, salesNature }), spoilage: await spoilageOf(now.year) },
        cash: snapshot.funds,
        month: viewedMonth,
        currentMonth,
        // What the cash is made of, movement by movement since the account opened (it explains the figure, it is not a second balance).
        cashMovements: cashMovementsOf(entries, buildingId, { accountKind }),
        // A house's personal account has its monthly budget, and the savings it had at the start of the year (what its
        // balance was before the year's lines: the year's result is what it added since); a company's account has neither.
        budget: accountKind === 'particulier'
          ? householdBudgetOf(entries, buildingId, { year: now.year, month: viewedMonth, balance: snapshot.funds })
          : null,
        openingSavings: accountKind === 'particulier'
          ? snapshot.funds - buildingFinanceFigures(entries, buildingId, { year: now.year, accountKind, salesNature }).householdResult
          : null,
        // What a house owes the owner, derived from the journal as it stood at the end of the month viewed (never stored).
        rentDebt: accountKind === 'particulier' ? rentDebtsOf(entries).get(buildingId) ?? 0 : null,
      };
    },

    /**
     * The rents owed by the houses, from the journal: how many houses owe one and how much in all (derived every time, never stored).
     * @returns {Promise<{ debtors: number, total: number }>}
     */
    async getRentDebtSummary() {
      const debts = [...rentDebtsOf(await journalRepository.getJournalEntries()).values()].filter((debt) => debt > 0);
      return { debtors: debts.length, total: Math.round(debts.reduce((sum, debt) => sum + debt * 100, 0)) / 100 };
    },

    /**
     * What the labour market pays each (skill, level), for the wages panel and the staff tabs: the wage in force (never under the minimum
     * wage), the wage before its last move and the reading that caused it.
     * @param {Array<{ skill: string, level: number, jobs: number, filled: number, vacancies: number, idle: number }>} marketRows the labour market read by employment
     * @returns {Promise<{ wageFloor: number | null, benefitBase: number, unemploymentBenefitRate: number, wages: Array<{ skill: string, level: number, amount: number, previous: number | null, signal: 'shortage' | 'slack' | 'balanced', atMinimum: boolean, jobs: number, filled: number, vacancies: number, idle: number }> }>}
     */
    async getWageBoard(marketRows) {
      const settings = await hamletFiscalRates.getSalarySettings();
      const floor = wageFloorOf(settings);
      const wages = [];
      for (const row of marketRows) {
        const history = await wageRateRepository.history(row.skill, row.level);
        const last = history.at(-1) ?? null;
        const amount = flooredWage(last ? last.amount : startWageOf(row.level), floor);
        const previous = history.length >= 2 ? history.at(-2).amount : last ? startWageOf(row.level) : null;
        wages.push({
          ...row,
          amount,
          previous,
          signal: readLabourMarket(row).signal,
          atMinimum: floor !== null && amount === floor,
        });
      }
      return { wageFloor: floor, benefitBase: await benefitBaseOfHamlet(settings), unemploymentBenefitRate: settings.unemploymentBenefitRate, wages };
    },

    /** Revalues an indexed minimum wage on the cost of living now (done every January by the settlement, and when the player turns the mode on). */
    revalueMinimumWage() {
      return revalueMinimumWage.execute();
    },

    /**
     * The cost of living: what a month costs a citizen of the reference household (`COST_OF_LIVING_BASKET`) at the prices on the shelves now, read
     * from the catalog's needs and the sellers' prices; nothing is stored. A good is priced at the cheapest market, tax included; a service at the
     * cheapest seller, less the city's subsidy, VAT added. What nobody sells has no price: `total` is then null and `missing` names it.
     * @returns {Promise<ReturnType<typeof costOfLivingOf> & { householdSize: number }>}
     */
    async getCostOfLiving() {
      if (typeof deps.listSellingPrices !== 'function' || typeof deps.listServicePrices !== 'function') {
        throw new Error('[accounting] the selling prices were not wired (deps.listSellingPrices, deps.listServicePrices): the cost of living cannot be read');
      }
      const period = gameTimePort.getTimeInfo(gameTimePort.currentTurn());
      const [goodsPrices, servicePrices, vatRates, subsidies] = await Promise.all([
        deps.listSellingPrices(period),
        deps.listServicePrices(period),
        hamletFiscalRates.getVatRates(),
        hamletFiscalRates.getServiceSubsidies(),
      ]);
      const { houseType, tier } = COST_OF_LIVING_BASKET;
      const group = getBuildingDefinition(houseType)?.residentialGroup;
      const tierFacts = SOCIAL_CATEGORY[group]?.tiers?.[tier];
      if (!tierFacts) throw new Error(`[cost-of-living] "${houseType}" has no tier ${tier} in the social categories (residential group ${group})`);

      // A good's shelf price is already what the house pays (tax included).
      const goodPrices = (good) => goodsPrices.filter((row) => row.stage === 'distributor' && row.category === good).map((row) => row.price);
      // A service's price is before tax: the city's subsidy comes off, then the VAT is added.
      const servicePricesPaid = (service) =>
        servicePrices
          .filter((row) => row.category === service)
          .map((row) => {
            const { habitantShare } = serviceSubsidyShare({ units: 1, unitPrice: row.price, subsidyPercent: subsidies[service] });
            return addVatTo({ ht: habitantShare, ratePercent: vatRates[service] }).ttc;
          });
      const isService = (category) => getServiceCategories().includes(category);

      const needs = getQuantityConsumerEntries(houseType).map((entry) => ({
        key: entry.totalKey ?? entry.categories[0],
        quantity: entry.amount,
        // The goods that serve one need are interchangeable: any of them meets it, the cheapest is bought.
        unitPrices: entry.categories.flatMap((category) => (isService(category) ? servicePricesPaid(category) : goodPrices(category))),
      }));
      const services = tierFacts.requirements
        .filter((requirement) => requirement.kind === 'serviceCoverage')
        .map((requirement) => ({ key: requirement.category, unitPrices: servicePricesPaid(requirement.category) }));
      return { ...costOfLivingOf({ needs, services, householdSize: tierFacts.maxPopulation }), householdSize: tierFacts.maxPopulation };
    },

    /**
     * The city's social security over the last settled month (the lines the settlement of this month wrote, for the month before): what it
     * received in contributions, what it paid in unemployment benefit, and the difference. It has no cash of its own: a deficit is the treasury's.
     * It is read from the journal's city lines; nothing is stored.
     * @returns {Promise<{ contributions: number, benefits: number, balance: number }>}
     */
    async getSocialSecurityBoard() {
      const now = gameTimePort.getTimeInfo(gameTimePort.currentTurn());
      const entries = await journalRepository.getJournalEntries();
      const month = entries.filter((entry) => (entry.accountBuildingId ?? null) === null && entry.year === now.year && entry.month === now.monthIndex + 1);
      const sum = (type) => Math.round(month.filter((entry) => entry.type === type).reduce((total, entry) => total + entry.amount * 100, 0)) / 100;
      const contributions = sum('social_contribution');
      const benefits = sum('unemployment_benefit');
      return { contributions, benefits, balance: Math.round((contributions - benefits) * 100) / 100 };
    },

    /**
     * What a producer's month costs apart from its inputs, as it stands now: the labour market's wage for a skill and level (never under the
     * minimum wage) and a building type's upkeep. The supply builds a producer's sale price on them (see PriceBook).
     * @returns {Promise<{ wageRateOf: (skill: string, level: number) => number, maintenanceCostOf: (buildingType: string) => number, employerContributionRate: number }>}
     */
    async getProducerCosting() {
      const settings = await hamletFiscalRates.getSalarySettings();
      return {
        wageRateOf: await marketWageRateOf(),
        maintenanceCostOf: buildingMaintenanceCost,
        employerContributionRate: settings.employerContributionRate,
      };
    },

    /**
     * The monthly gross wage of one worker of a building type, as the labour market stands: what its Personnel tab shows.
     * @param {string} buildingType
     * @returns {Promise<number | null>} null for a building that pays no wage (a house, a road)
     */
    async getWagePerWorkerOf(buildingType) {
      if (!isLucrativeBuilding(buildingType)) return null;
      return wagePerWorkerOf({ type: buildingType, wageRateOf: await marketWageRateOf() });
    },

    /**
     * The trace of a company's account: its movements and the companies it traded with (see buildingAccountTrace).
     * @param {string} buildingId
     */
    async getBuildingAccountTrace(buildingId) {
      return buildingAccountTrace(await journalRepository.getJournalEntries(), buildingId);
    },

    /**
     * One account of one building as a JSON document: what the Finances tab shows (the statement for the last month and the month to
     * date, the ratios, the cash and what it is made of) and the journal lines of that account, in the order they were written.
     * @param {string} buildingId
     * @param {string | null} accountKind a house's account (particulier or entreprise); null for a company's
     * @returns {Promise<string>}
     */
    async exportBuildingAccountJson(buildingId, accountKind) {
      const finance = await this.getBuildingFinance(buildingId, accountKind);
      const building = await dexieDb.houses.get(buildingId);
      const accountKey = accountKeyOf({ accountBuildingId: buildingId, accountKind });
      const lines = (await journalRepository.getJournalEntries())
        .filter((entry) => accountKeyOf(entry) === accountKey)
        .sort((a, b) => a.id - b.id)
        .map((entry) => ({
          id: entry.id,
          turn: entry.turn,
          year: entry.year,
          month: entry.month,
          type: entry.type,
          account: pcgOfJournalType(entry.type)?.account ?? null,
          amount: entry.amount,
          description: entry.description ?? null,
          counterpartyBuildingId: entry.counterpartyBuildingId ?? null,
        }));
      return JSON.stringify(
        {
          building: { id: buildingId, type: building.type, accountKind: accountKind ?? 'entreprise' },
          cash: finance.cash,
          cashMovements: finance.cashMovements,
          lastMonth: finance.lastMonth,
          monthToDate: finance.monthToDate,
          year: finance.year,
          lines,
        },
        null,
        2,
      );
    },

    findBankBuildingId,

    /**
     * What a house has sitting at the bank — never stored, derived from its deposit/withdrawal/interest lines
     * the same way any other balance is (see DepositBalancePolicy.js). Null bank (no Bank built yet) reads as 0.
     * @param {string} houseId
     * @returns {Promise<number>}
     */
    async getHouseholdDepositBalance(houseId) {
      const bankId = await findBankBuildingId();
      if (!bankId) return 0;
      return depositBalanceOf(await journalRepository.getJournalEntries(), houseId, bankId);
    },

    /** @param {{ turn: number, houseId: string, bankId: string, amount: number, description: string }} params */
    async recordHouseholdDeposit(params) {
      return recordHouseholdDeposit.execute(params);
    },

    /** @param {{ turn: number, houseId: string, bankId: string, amount: number, description: string }} params */
    async recordHouseholdWithdrawal(params) {
      return recordHouseholdWithdrawal.execute(params);
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
        benefitBase: await benefitBaseOfHamlet(settings),
        unemploymentBenefitRate: settings.unemploymentBenefitRate,
      });
      const now = gameTimePort.getTimeInfo(gameTimePort.currentTurn());
      const entries = await journalRepository.getJournalEntries();
      const breakdown = residentPayBreakdownOf(
        residents,
        entries,
        { houseId, year: now.year, month: now.monthIndex + 1 },
        { predictedBenefit: expectedPay.benefit },
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

    /** @returns {Promise<Record<string, number>>} the active hamlet's VAT rate per good, in percent. */
    getVatRates() {
      return hamletFiscalRates.getVatRates();
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

    /** Boot: gives every traded good its customs duty for each flow it takes, unless one is stored (from the catalog). */
    ensureCustomsDuties() {
      fiscalSettingsRepository.ensureCustomsDuties(listTradedGoods());
    },

    /** @returns {number} the duty a customs authority charges on one good, for one flow, at a turn, in [0, 1] */
    getCustomsDuty(authority, flow, good, turn) {
      return fiscalSettingsRepository.getCustomsDuty(authority, flow, good, turn);
    },

    /**
     * Sets Anoria's duty on one good for one flow, and logs the change as a dated policy event (who, which good, from, to,
     * at which turn): the history a later trade-policy phase explains a trade war with. The log is appended, never edited.
     * @returns {Promise<number>} the duty, once stored
     */
    async setCustomsDuty(flow, good, rate) {
      const turn = getSessionGameTime();
      const from = fiscalSettingsRepository.getCustomsDuty('anoria', flow, good, turn);
      const stored = fiscalSettingsRepository.setCustomsDuty(flow, good, rate);
      await dexieDb.tradePolicyEvents.add({ turn, authority: 'anoria', flow, good, from, to: stored, cause: 'player' });
      return stored;
    },

    /** @returns {Array<{ good: string, import?: number, export?: number }>} every traded good with the duties of the flows it takes */
    listCustomsDuties() {
      const duties = fiscalSettingsRepository.listCustomsDuties();
      return listTradedGoods().map(({ good, flows }) => ({
        good,
        ...Object.fromEntries(flows.map((flow) => [flow, duties[flow][good]])),
      }));
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
  return accountingApi;
}

/** @type {ReturnType<typeof createAccountingContext> | null} */
let sharedAccounting = null;

export function getOrCreateAccountingContext(deps = {}) {
  if (!sharedAccounting) {
    sharedAccounting = createAccountingContext(deps);
  } else if (Object.keys(deps).length > 0) {
    // The first caller wires the singleton: wiring passed later would be ignored, and a missing dependency would only
    // show much later (at the first settlement). Whoever wires it must be the first to ask for it.
    throw new Error(
      `[accounting] the context already exists, so the wiring passed now would be ignored (${Object.keys(deps).join(', ')}): wire it at the first call`,
    );
  }
  return sharedAccounting;
}

/** @internal Tests only */
export function resetAccountingContextForTests() {
  sharedAccounting = null;
}
