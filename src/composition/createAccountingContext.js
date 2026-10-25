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
import { GetCityStatements } from '../contexts/accounting/application/queries/city-ledger/GetCityStatements.js';
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
import { accountKeyOf, businessAccountOf } from '../contexts/accounting/domain/policies/AccountKeyPolicy.js';
import { AdjustWageRates } from '../contexts/accounting/application/services/AdjustWageRates.js';
import { RevalueMinimumWage } from '../contexts/accounting/application/services/RevalueMinimumWage.js';
import { DexieWageRateRepository, wageKey } from '../contexts/accounting/infrastructure/persistence/DexieWageRateRepository.js';
import { administratorPayStatusOf } from '../contexts/accounting/domain/policies/AdministratorPayPolicy.js';
import { benefitBaseOf, flooredWage, readLabourMarket, startWageOf, wageFloorOf } from '../contexts/accounting/domain/policies/WageRatePolicy.js';
import { wagePerWorkerOf } from '../contexts/accounting/domain/policies/ProducerChargePolicy.js';
import { pcgOfJournalType } from '../shared/accounting-catalog/PcgJournalCatalog.js';
import { buildingFinanceFigures, cashMovementsOf, householdBudgetOf, householdLastMonthOf, incomeStatementOf } from '../contexts/accounting/domain/policies/BuildingFinancePolicy.js';
import { residentsOfHouse } from '../contexts/accounting/domain/policies/HouseResidentsPolicy.js';
import { residentPayBreakdownOf } from '../contexts/accounting/domain/policies/HouseResidentsPayPolicy.js';
import { householdPublicPayOf } from '../contexts/accounting/domain/policies/HouseholdPublicPayPolicy.js';
import { MONTHS_PER_YEAR } from '../shared/time/TimeCalendar.js';
import { balanceSheetOf } from '../contexts/accounting/domain/policies/BalanceSheetPolicy.js';
import { accountLedgerOf, trialBalanceOf } from '../contexts/accounting/domain/policies/AccountLedgerPolicy.js';
import { isLucrativeBuilding, payrollOf } from '../contexts/accounting/domain/policies/ProducerChargePolicy.js';
import { BUILDING_KIND_HOUSE, resolveBuildingKind } from '../shared/building-identity/index.js';
import { houseEnterpriseOf, houseEnterprises, houseHoldsSkill, premisesShareOf, residentsSeekingWork } from '../shared/population/workforceQueries.js';
import { OWNER_SKILL, TAX_COLLECTION_SKILLS } from '../shared/population/socialCategoryCatalog.js';
import { premisesRentOf, rentArrearsMonthsByHouse, rentDebtsOf, rentQuoteOf } from '../contexts/accounting/domain/policies/RentPolicy.js';
import { legalFormOf } from '../shared/accounting-catalog/LegalFormCatalog.js';
import { SettleHouseRents } from '../contexts/accounting/application/services/SettleHouseRents.js';
import { WriteOffVacantRentDebts } from '../contexts/accounting/application/services/WriteOffVacantRentDebts.js';
import { LiquidateDemolishedBuilding } from '../contexts/accounting/application/services/LiquidateDemolishedBuilding.js';
import { DexieSupplyTraceabilityRepository } from '../contexts/supply/infrastructure/dexie/DexieSupplyTraceabilityRepository.js';
import { getResourceBaseValue, getServiceCategories } from '../shared/resource-catalog/ResourceCategoryCatalog.js';
import {
  canAffordFromBudget,
} from '../contexts/accounting/application/queries/treasury/GameTreasuryProjections.js';
import { isActiveHamletRow } from '../core/persistence/hamlet/hamletSession.js';
import { buildingMaintenanceCost, maintenanceCategoryOf } from '../contexts/accounting/domain/policies/BuildingMaintenanceBreakdownPolicy.js';
import { CloseMonthAccounts } from '../contexts/accounting/application/services/CloseMonthAccounts.js';
import { FundNewCompanies } from '../contexts/accounting/application/services/FundNewCompanies.js';
import { difficultyMonthsOf, payablesOf } from '../contexts/accounting/domain/policies/DebtPolicy.js';
import { INSOLVENCY_DISPLAY, INSOLVENCY_GRACE_MONTHS, PAYABLE_KINDS } from '../contexts/accounting/domain/catalogs/PayableCatalog.js';
import { buildingTypeOfConstruction } from '../contexts/accounting/domain/policies/MonthClosingPolicy.js';
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
 * @param {(buildingId: string, period: { year: number, monthIndex: number }) => Promise<Array<{ category: string, amount: number, unitCost: number, value: number }>>} [deps.valueStock]
 *   what a building's stock is worth at cost (the supply's), for a company's balance sheet
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
  // The property company that owns every building stands as long as the house whose category holds the owner skill does (the mayor's), lived in or not.
  const ownerStands = async () =>
    (await dexieDb.houses.toArray()).some(
      (row) => isActiveHamletRow(row) && resolveBuildingKind(row.type) === BUILDING_KIND_HOUSE && houseHoldsSkill(row.type, 1, OWNER_SKILL)
    );
  const recordConstructionExpense = new RecordConstructionExpense(
    recordLedgerEntryCommand,
    ownerStands
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
    recordLedgerEntryCommand,
    ownerStands
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
  const getCityStatementsQuery = new GetCityStatements(journalRepository, getTreasurySnapshotQuery, gameTimePort);
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

  // A tax is levied only while a house of the city has residents who hold its collection (the mayor's house, by its tier): one skill per tax.
  const taxIsCollected = async (taxSkill) =>
    (await dexieDb.houses.toArray())
      .filter(isActiveHamletRow)
      .some((row) => resolveBuildingKind(row.type) === BUILDING_KIND_HOUSE && row.pop >= 1 && houseHoldsSkill(row.type, row.level ?? 1, taxSkill));

  // The rates in force are the player's, or nil for a tax nobody holds the collection of: it stays set, but nothing can be collected, so
  // nothing is paid. The admin panels still show and edit the rates the player set.
  const vatRatesInForce = async () => {
    const rates = await hamletFiscalRates.getVatRates();
    if (await taxIsCollected(TAX_COLLECTION_SKILLS.vat)) return rates;
    return Object.fromEntries(Object.keys(rates).map((item) => [item, 0]));
  };
  const corporateTaxRateInForce = async () =>
    (await taxIsCollected(TAX_COLLECTION_SKILLS.corporate)) ? hamletFiscalRates.getCorporateTaxRate() : 0;
  const customsDutyInForce = async (authority, flow, good, turn) =>
    (await taxIsCollected(TAX_COLLECTION_SKILLS.customs)) ? fiscalSettingsRepository.getCustomsDuty(authority, flow, good, turn) : 0;

  const collectCitizenTaxes = new CollectCitizenTaxes({
    getTreasurySnapshot: getTreasurySnapshotQuery,
    recordCitizenTaxIncome,
    recordLedgerEntry: recordLedgerEntryCommand,
    houseReadPort,
    getCitizenTaxPerCapita,
    getTimeInfo: (time) => gameTimePort.getTimeInfo(time),
    // The citizen tax is collected by the residents of the house that holds its collection (the mayor's house).
    hasTaxCollector: () => taxIsCollected(TAX_COLLECTION_SKILLS.citizen),
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
  // What a building's spoiled goods would have sold for (the manque à gagner), at the price the building sells each good at: the Finances tab and the
  // informative journal lines read the same valuation.
  const valueSpoilage = async (building, lost, period) => {
    const goods = Object.keys(lost);
    if (goods.length === 0) return { units: 0, lostRevenue: 0 };
    if (typeof deps.getSellingPrice !== 'function') throw new Error('[accounting] the selling prices were not wired (deps.getSellingPrice): the spoiled goods could not be valued');
    let units = 0;
    let lostRevenue = 0;
    for (const good of goods) {
      units += lost[good];
      lostRevenue += lost[good] * (await deps.getSellingPrice({ id: building.id, type: building.type }, good, period));
    }
    return { units, lostRevenue: Math.round(lostRevenue * 100) / 100 };
  };
  const getProducerRevenues = new GetProducerRevenues({
    getJournalEntries: () => journalRepository.getJournalEntries(),
    // A building the player demolished keeps its sales in the journal: its type is the one its construction line names, while the ones that stand say their own.
    getBuildingTypes: async () => {
      const types = new Map();
      for (const entry of await journalRepository.getJournalEntries()) {
        if (entry.type !== 'construction' || !entry.buildingInstanceId || types.has(entry.buildingInstanceId)) continue;
        const named = buildingTypeOfConstruction(entry);
        if (named) types.set(entry.buildingInstanceId, named);
      }
      for (const row of (await dexieDb.houses.toArray()).filter(isActiveHamletRow)) types.set(row.id, row.type);
      return types;
    },
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
      await getTreasurySnapshotQuery.cashOf({ accountBuildingId: houseId, accountKind: 'particulier' }),
    businessFundsOf: async (houseId, businessAccount) =>
      await getTreasurySnapshotQuery.cashOf({ accountBuildingId: houseId, accountKind: businessAccount }),
    companyFundsOf: async (buildingId) => await getTreasurySnapshotQuery.cashOf({ accountBuildingId: buildingId }),
    getJournalEntries: () => journalRepository.getJournalEntries(),
    getVatRates: () => vatRatesInForce(),
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
        administratorStipend: settings.administratorStipend,
      };
    },
    getWageRateOf: () => marketWageRateOf(),
    getCorporateTaxRate: () => corporateTaxRateInForce(),
    getHouseMaintenanceSubsidyRate: () => hamletFiscalRates.getHouseMaintenanceSubsidyRate(),
    getSalaryTax: async () => {
      // Nobody holds the collection of the income tax: it is not levied, which is a rate of nothing on every band.
      if (!(await taxIsCollected(TAX_COLLECTION_SKILLS.income))) return { threshold1: 0, rate1: 0, threshold2: 0, rate2: 0 };
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
    // What each building lost to spoilage in a month, in units and in manque à gagner: written to the journal as an informative line.
    listSpoilage: async (year, monthIndex) => {
      const lostByBuilding = await supplyTraceabilityRepository.sumSpoilageByBuilding(year, monthIndex);
      const rows = (await dexieDb.houses.toArray()).filter(isActiveHamletRow);
      const spoilage = [];
      for (const [buildingId, lost] of lostByBuilding) {
        const building = rows.find((row) => row.id === buildingId);
        if (!building) continue;
        spoilage.push({ buildingId, ...(await valueSpoilage({ id: buildingId, type: building.type }, lost, { year, monthIndex })) });
      }
      return spoilage;
    },
    getServiceSubsidies: () => hamletFiscalRates.getServiceSubsidies(),
    getServicePrice: ({ service, building, period }) => {
      if (typeof deps.getSellingPrice !== 'function') throw new Error('[accounting] the selling prices were not wired (deps.getSellingPrice): a service could not be priced');
      return deps.getSellingPrice(building, service, period);
    },
    // The corporate tax is based on the résultat courant avant impôts of the statement the player reads: the same function, over the same lines.
    // The income of a household over a year, as its personal account shows it (the Finances tab reads the same figures): its tax is settled on it.
    readHouseholdYear: async (houseId, year) => {
      const figures = buildingFinanceFigures(await journalRepository.getJournalEntries(), houseId, { year, accountKind: 'particulier', salesNature: null });
      return {
        incomeYearToDate:
          figures.wagesReceived + figures.publicWageReceived + figures.benefitReceived + figures.participationReceived + figures.dividendReceived - figures.employeeContributionPaid,
        // What it paid, less what the city already gave back (an earlier regularisation of the same year).
        taxWithheldYearToDate: Math.round((figures.incomeTax - figures.incomeTaxRefunded) * 100) / 100,
      };
    },
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
    getVatRates: () => vatRatesInForce(),
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
      await getTreasurySnapshotQuery.cashOf({ accountBuildingId: houseId, accountKind: 'particulier' }),
  });
  const recordHouseholdWithdrawal = new RecordHouseholdWithdrawal({
    recordLedgerEntry: (params) => recordLedgerEntryCommand.execute({ ...params }),
    depositBalanceOf: async (houseId, bankId) => depositBalanceOf(await journalRepository.getJournalEntries(), houseId, bankId),
    fundsOf: async (bankId) => await getTreasurySnapshotQuery.cashOf({ accountBuildingId: bankId }),
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
  const getRentalHouses = async () => {
    const owned = (await dexieDb.houses.toArray())
      .filter(isActiveHamletRow)
      .filter((row) => resolveBuildingKind(row.type) === BUILDING_KIND_HOUSE)
      .sort((a, b) => String(a.id).localeCompare(String(b.id)));
    const houses = owned.filter((row) => row.pop >= 1);
    const owner = houses.find((row) => houseHoldsSkill(row.type, row.level ?? 1, OWNER_SKILL));
    if (!owner) return null;
    const nameOf = (row) => getBuildingDefinition(row.type)?.displayName;
    return {
      ownerId: owner.id,
      ownerType: owner.type,
      ownerName: nameOf(owner),
      // The owner lives in its own house and pays its rent like the others (to itself: it is the same company's income and its associates' cost).
      tenants: houses.map((row) => ({ id: row.id, type: row.type, name: nameOf(row) })),
      // Every house the owner holds, vacant ones included: it bears their upkeep.
      ownedTypes: owned.map((row) => row.type),
      vacantIds: owned.filter((row) => !(row.pop >= 1)).map((row) => row.id),
    };
  };
  // The rent the owner asks each house, deduced from the upkeep it bears (less the hamlet's subsidy) and the rent control (see rentQuoteOf).
  const quoteRent = async (rentals) => {
    const [subsidyRate, control] = await Promise.all([hamletFiscalRates.getHouseMaintenanceSubsidyRate(), hamletFiscalRates.getRentControl()]);
    // The homes' share of the upkeep: the part of a house set aside for its business is rented apart (see premisesRentOf), not by the household.
    const upkeep = rentals.ownedTypes.reduce((total, type) => total + buildingMaintenanceCost(type) * (1 - premisesShareOf(type)), 0);
    const quote = rentQuoteOf({
      upkeepToCover: upkeep * (1 - subsidyRate),
      tenants: rentals.tenants.length,
      margin: legalFormOf(houseEnterpriseOf(rentals.ownerType, 'rental').id).regime.rentMargin,
      cap: control.enabled ? control.cap : null,
    });
    return { ...quote, control };
  };
  // Every building the city paid for (but the roads, which stay the hamlet's), each with what it cost net of refunds, the month it was built
  // (`year × 12 + monthIndex`, from its first construction line), its type (the row's while it stands, else the one its construction line names), its
  // family and whether it still stands. The owner's property company holds them all; the city's construction line is its contribution in kind.
  const constructionsOf = async (entries) => {
    const rows = new Map((await dexieDb.houses.toArray()).filter(isActiveHamletRow).map((row) => [row.id, row.type]));
    const built = new Map();
    const entryOf = (id) => {
      if (!built.has(id)) built.set(id, { buildingId: id, type: rows.get(id) ?? null, centimes: 0, builtKey: null });
      return built.get(id);
    };
    for (const entry of entries) {
      // A purged year keeps what each building cost (see YearClosingPolicy): the lines themselves are gone.
      if (entry.type === 'year_closing') {
        for (const [id, kept] of Object.entries(entry.closing.constructions ?? {})) {
          const building = entryOf(id);
          building.centimes += Math.round(kept.cost * 100);
          building.builtKey = building.builtKey === null ? kept.builtKey : Math.min(building.builtKey, kept.builtKey);
          building.type ??= kept.type ?? null;
        }
        continue;
      }
      if (!entry.buildingInstanceId || (entry.type !== 'construction' && entry.type !== 'construction_refund')) continue;
      const building = entryOf(entry.buildingInstanceId);
      building.centimes += (entry.type === 'construction' ? 1 : -1) * Math.round(entry.amount * 100);
      if (entry.type === 'construction' && building.builtKey === null) {
        if (!Number.isInteger(entry.year) || !Number.isInteger(entry.month)) throw new Error(`[ledger] the construction line of building ${entry.buildingInstanceId} has no year and month`);
        building.builtKey = entry.year * MONTHS_PER_YEAR + (entry.month - 1);
        building.type ??= buildingTypeOfConstruction(entry);
      }
    }
    return [...built.values()]
      .filter((building) => building.centimes > 0 && building.builtKey !== null)
      .map(({ centimes, ...building }) => ({
        buildingId: building.buildingId,
        type: building.type,
        category: building.type ? maintenanceCategoryOf(building.type) : null,
        cost: centimes / 100,
        builtKey: building.builtKey,
        held: rows.has(building.buildingId),
      }))
      .filter((building) => building.category !== 'roads');
  };
  // The companies and the businesses of the houses, with what their month costs at full staffing: the capital the city pays them when they are created.
  const fundNewCompanies = new FundNewCompanies({
    getTimeInfo: (turn) => gameTimePort.getTimeInfo(turn),
    getJournalEntries: () => journalRepository.getJournalEntries(),
    recordLedgerEntry: (params) => recordLedgerEntryCommand.execute({ ...params }),
    listFoundingNeeds: async () => {
      const wageRateOf = await marketWageRateOf();
      const { employerContributionRate } = await hamletFiscalRates.getSalarySettings();
      const needs = [];
      for (const row of (await dexieDb.houses.toArray()).filter(isActiveHamletRow)) {
        const name = getBuildingDefinition(row.type)?.displayName;
        if (resolveBuildingKind(row.type) === BUILDING_KIND_HOUSE) {
          const business = houseEnterprises(row.type).enterprises.find((enterprise) => enterprise.activity === 'recipes');
          const share = premisesShareOf(row.type);
          // The business of a house rents a share of it: its month is that rent.
          if (business && share > 0) needs.push({ buildingId: row.id, accountKind: businessAccountOf(business.id), monthlyNeed: buildingMaintenanceCost(row.type) * share, name });
        } else if (isLucrativeBuilding(row.type)) {
          const payroll = payrollOf({ type: row.type, workers: getBuildingDefinition(row.type)?.employment?.workerNeed ?? 0, wageRateOf });
          needs.push({ buildingId: row.id, accountKind: null, monthlyNeed: payroll * (1 + employerContributionRate) + buildingMaintenanceCost(row.type), name });
        }
      }
      return needs;
    },
  });
  const closeMonthAccounts = new CloseMonthAccounts({
    getTimeInfo: (turn) => gameTimePort.getTimeInfo(turn),
    listStockAccounts: async () => {
      if (typeof deps.valueStock !== 'function') throw new Error('[accounting] the stock valuation was not wired (deps.valueStock): the month could not be closed');
      const accounts = [];
      for (const row of (await dexieDb.houses.toArray()).filter(isActiveHamletRow)) {
        const nature = salesNatureOf(row.type);
        if (nature === null) continue;
        const stockNature = nature === 'merchandise' ? 'merchandise' : 'production';
        if (resolveBuildingKind(row.type) === BUILDING_KIND_HOUSE) {
          const business = houseEnterprises(row.type).enterprises.find((enterprise) => enterprise.activity === 'recipes');
          if (business) accounts.push({ buildingId: row.id, accountKind: businessAccountOf(business.id), nature: stockNature });
        } else if (isLucrativeBuilding(row.type)) {
          accounts.push({ buildingId: row.id, accountKind: null, nature: stockNature });
        }
      }
      return accounts;
    },
    valueStock: (buildingId, period) => deps.valueStock(buildingId, period),
    getOwnerHoldings: async () => {
      const rentals = await getRentalHouses();
      if (!rentals) return null;
      const constructions = await constructionsOf(await journalRepository.getJournalEntries());
      return { ownerId: rentals.ownerId, businessAccount: businessAccountOf(houseEnterpriseOf(rentals.ownerType, 'rental').id), constructions };
    },
    getJournalEntries: () => journalRepository.getJournalEntries(),
    recordLedgerEntry: (params) => recordLedgerEntryCommand.execute({ ...params }),
  });
  // The rent of the premises a house's business works in: its share of the house's upkeep, less the hamlet's subsidy, plus the owner's margin.
  const quotePremisesRent = async (rentals, houseType) => {
    const subsidyRate = await hamletFiscalRates.getHouseMaintenanceSubsidyRate();
    return premisesRentOf({
      upkeep: buildingMaintenanceCost(houseType),
      share: premisesShareOf(houseType),
      subsidyRate,
      margin: legalFormOf(houseEnterpriseOf(rentals.ownerType, 'rental').id).regime.rentMargin,
    });
  };
  const settleHouseRents = new SettleHouseRents({
    getTimeInfo: (turn) => gameTimePort.getTimeInfo(turn),
    getRentalHouses,
    getRentQuote: quoteRent,
    getPremisesRent: quotePremisesRent,
    businessFundsOf: async (houseId, businessAccount) =>
      await getTreasurySnapshotQuery.cashOf({ accountBuildingId: houseId, accountKind: businessAccount }),
    getJournalEntries: () => journalRepository.getJournalEntries(),
    fundsOf: async (houseId) => await getTreasurySnapshotQuery.cashOf({ accountBuildingId: houseId, accountKind: 'particulier' }),
    recordLedgerEntry: (params) => recordLedgerEntryCommand.execute({ ...params }),
  });

  const writeOffVacantRentDebts = new WriteOffVacantRentDebts({
    getRentalHouses,
    getTimeInfo: (turn) => gameTimePort.getTimeInfo(turn),
    getJournalEntries: () => journalRepository.getJournalEntries(),
    recordLedgerEntry: (params) => recordLedgerEntryCommand.execute({ ...params }),
  });

  // The books of a building the player demolishes are closed as a liquidation would (see LiquidateDemolishedBuilding.js).
  const liquidateDemolishedBuilding = new LiquidateDemolishedBuilding({
    getJournalEntries: () => journalRepository.getJournalEntries(),
    recordLedgerEntry: (params) => recordLedgerEntryCommand.execute({ ...params }),
  });

  const processTurnBudget = new ProcessTurnBudget({
    collectCitizenTaxes: (time) => collectCitizenTaxes.execute({ time }),
    getTimeInfo: (time) => gameTimePort.getTimeInfo(time),
    // The month's settlement is written in one go: hundreds of lines, one transaction (see SessionJournalStore.batch).
    inJournalBatch: (work) => sessionJournalStoreInstance.batch(work),
    settleProducerCharges: (params) => settleProducerCharges.execute(params),
    settleHouseRents: (params) => settleHouseRents.execute(params),
    fundNewCompanies: (params) => fundNewCompanies.execute(params),
    closeMonthAccounts: (params) => closeMonthAccounts.execute(params),
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

    /** The compte de résultat of a year of the city (or a hamlet), its balance sheet and its balance, in the M57 model: see GetCityStatements. */
    async getCityStatements(options) {
      return getCityStatementsQuery.execute(options);
    },

    /**
     * Everything the Finances panel shows, in one object, to download and to read afterwards: the livret (the Caesar-style budget of three years), the compte de
     * résultat, the balance sheet and the balance of the city or of a hamlet. The real date stamps the export only (the game's own dates are turns).
     * @param {{ hamletId?: string | null }} [options]
     */
    async exportCityFinances(options = {}) {
      const hamletId = options.hamletId ?? null;
      const livret = await getCityLedgerYearComparisonQuery.execute({ hamletId });
      const statements = await getCityStatementsQuery.execute({ hamletId });
      return {
        exportDate: new Date().toISOString(),
        scope: hamletId === null ? 'ville' : { hamletId },
        turn: gameTimePort.currentTurn(),
        year: statements.year,
        livret,
        compteDeResultat: statements.incomeStatement,
        bilan: statements.balanceSheet,
        balance: statements.trialBalance,
      };
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
    getHouseMaintenanceSubsidyRate() {
      return hamletFiscalRates.getHouseMaintenanceSubsidyRate();
    },

    setHouseMaintenanceSubsidyRate(rate) {
      return hamletFiscalRates.setHouseMaintenanceSubsidyRate(rate);
    },

    /** @returns {Promise<{ enabled: boolean, cap: number }>} the hamlet's rent control (the ceiling applies only when enabled) */
    getRentControl() {
      return hamletFiscalRates.getRentControl();
    },

    setRentControlEnabled(enabled) {
      return hamletFiscalRates.setRentControlEnabled(enabled);
    },

    /** Writes off the rent debts of the houses all of whose inhabitants have left (see WriteOffVacantRentDebts.js). */
    async writeOffVacantRentDebts(params) {
      return writeOffVacantRentDebts.execute(params);
    },

    /**
     * Closes the books of a building the player is demolishing, in the turn it leaves (see LiquidateDemolishedBuilding.js).
     * @param {{ buildingId: string, turn: number }} params
     */
    async liquidateDemolishedBuilding(params) {
      return liquidateDemolishedBuilding.execute(params);
    },

    /**
     * What the demolition of a building will do to the books, said before it is done and read by the same function that writes it.
     * @param {{ buildingId: string }} params
     * @returns {Promise<{ abandoned: Array<{ debtorId: string, kind: string, label: string, amount: number }>, owed: Array<{ kind: string, label: string, amount: number }> }>}
     */
    async previewDemolitionLiquidation(params) {
      return liquidateDemolishedBuilding.preview(params);
    },

    /** @returns {Promise<Map<string, number>>} each house's months in a row ending with a rent debt (a house without a debt is absent) */
    async getRentArrearsMonths() {
      return rentArrearsMonthsByHouse(await journalRepository.getJournalEntries());
    },

    /** The rent the owner asks now, and what it would need to break even, or null when no house is an owner. */
    async getRentQuote() {
      const rentals = await getRentalHouses();
      return rentals ? quoteRent(rentals) : null;
    },

    getCorporateTaxRate() {
      return hamletFiscalRates.getCorporateTaxRate();
    },

    setCorporateTaxRate(rate) {
      return hamletFiscalRates.setCorporateTaxRate(rate);
    },

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
        return valueSpoilage({ id: buildingId, type: building.type }, lost, { year, monthIndex: monthIndex ?? MONTHS_PER_YEAR - 1 });
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
     * The balance sheet of a company, as it stands now: derived from its journal lines, its cash and what its stock is worth at cost (see
     * BalanceSheetPolicy.js). A household has none.
     * @param {string} buildingId
     * @param {string | null} accountKind a house's business account (`entreprise`); null for a company's own account
     * @returns {Promise<ReturnType<typeof balanceSheetOf>>}
     */
    async getBuildingBalanceSheet(buildingId, accountKind) {
      if (typeof deps.valueStock !== 'function') throw new Error('[accounting] the stock valuation was not wired (deps.valueStock): the balance sheet could not value the stock');
      const now = gameTimePort.getTimeInfo(gameTimePort.currentTurn());
      const entries = await journalRepository.getJournalEntries();
      const snapshot = await getTreasurySnapshotQuery.execute({ accountBuildingId: buildingId, accountKind });
      const stock = await deps.valueStock(buildingId, { year: now.year, monthIndex: now.monthIndex });
      return balanceSheetOf(entries, buildingId, { accountKind, cash: snapshot.funds, stock, currentYear: now.year });
    },

    /**
     * What a company (or a house's business) owes and has not paid, and for how many months in a row: the building's problems say it. Null for a building that
     * is no company. Derived from the journal, never stored.
     * @param {string} buildingId
     * @returns {Promise<{ months: number, graceMonths: number, display: { icon: string, label: string }, debts: Array<{ label: string, amount: number }> } | null>}
     */
    async getInsolvency(buildingId) {
      const row = await dexieDb.houses.get(buildingId);
      if (!row) return null;
      let accountKind = null;
      if (resolveBuildingKind(row.type) === BUILDING_KIND_HOUSE) {
        const business = houseEnterprises(row.type).enterprises.find((enterprise) => enterprise.activity === 'recipes');
        if (!business) return null;
        accountKind = businessAccountOf(business.id);
      } else if (!isLucrativeBuilding(row.type)) {
        return null;
      }
      const now = gameTimePort.getTimeInfo(gameTimePort.currentTurn());
      const entries = await journalRepository.getJournalEntries();
      const months = difficultyMonthsOf(entries, buildingId, accountKind, { year: now.year, month: now.monthIndex + 1 }, MONTHS_PER_YEAR);
      const totals = new Map();
      for (const debt of payablesOf(entries).values()) {
        if (debt.debtorId !== buildingId || debt.accountKind !== accountKind) continue;
        totals.set(debt.kind, (totals.get(debt.kind) ?? 0) + debt.centimes);
      }
      return {
        months,
        graceMonths: INSOLVENCY_GRACE_MONTHS,
        display: INSOLVENCY_DISPLAY,
        debts: [...totals].map(([kind, centimes]) => ({ label: PAYABLE_KINDS[kind].label, amount: centimes / 100 })),
      };
    },

    /**
     * The grand livre and the balance of a building's account, derived from its journal lines (see AccountLedgerPolicy.js). The bank's balance is checked
     * against the treasury of the same account: they are the same lines read twice, so a gap is a defect.
     * @param {string} buildingId
     * @param {string | null} accountKind
     * @returns {Promise<{ ledger: ReturnType<typeof accountLedgerOf>, balance: ReturnType<typeof trialBalanceOf> }>}
     */
    async getBuildingLedger(buildingId, accountKind) {
      const building = await dexieDb.houses.get(buildingId);
      if (!building) throw new Error(`[ledger] building ${buildingId} is not in the hamlet: its ledger cannot be read`);
      const entries = await journalRepository.getJournalEntries();
      const options = { accountKind, salesNature: salesNatureOf(building.type) };
      const ledger = accountLedgerOf(entries, buildingId, options);
      const balance = trialBalanceOf(entries, buildingId, options);
      const bank = ledger.find((account) => account.account === '512')?.balance ?? 0;
      const funds = await getTreasurySnapshotQuery.cashOf({ accountBuildingId: buildingId, accountKind });
      if (Math.round(bank * 100) !== Math.round(funds * 100)) {
        throw new Error(`[ledger] the bank account of ${buildingId} is ${bank} but its treasury is ${funds}: the same lines were read two ways`);
      }
      return { ledger, balance };
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
        vatRatesInForce(),
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

    /** @param {string} enterpriseId an enterprise the catalog gives a house @returns {string} the kind of its business account */
    businessAccountOf(enterpriseId) {
      return businessAccountOf(enterpriseId);
    },

    /**
     * The business account of the enterprise of a house that does an activity (`recipes`, `rental`): where that business books its money.
     * @param {string} houseId
     * @param {'recipes' | 'rental'} activity
     * @returns {Promise<string>}
     */
    async businessAccountOfHouse(houseId, activity) {
      const house = await dexieDb.houses.get(houseId);
      if (!house) throw new Error(`[finance] house ${houseId} is not in the game: its business account cannot be named`);
      return businessAccountOf(houseEnterpriseOf(house.type, activity).id);
    },

    /**
     * What the owner's property company (the SCI of the mayor's house) lets and collects, from the journal and the houses standing now: the rent every
     * other house owes a month, the houses that pay it with what each still owes, and the last settlement's rents due and collected. Null when the house
     * is not the owner (no house holds the owner skill, or another one does).
     * @param {string} ownerId the house whose Enterprises tab is open
     * @returns {Promise<{ rent: number, tenants: Array<{ id: string, name: string, debt: number }>, due: number, collected: number, debtTotal: number } | null>}
     */
    async getRentalBoard(ownerId) {
      const rentals = await getRentalHouses();
      if (!rentals || rentals.ownerId !== ownerId) return null;
      const entries = await journalRepository.getJournalEntries();
      const debts = rentDebtsOf(entries);
      const now = gameTimePort.getTimeInfo(gameTimePort.currentTurn());
      const month = entries.filter((entry) => entry.year === now.year && entry.month === now.monthIndex + 1 && entry.accountBuildingId === ownerId);
      const sum = (type) => Math.round(month.filter((entry) => entry.type === type).reduce((total, entry) => total + entry.amount * 100, 0)) / 100;
      const tenants = rentals.tenants.map((tenant) => ({ ...tenant, debt: debts.get(tenant.id) ?? 0 }));
      const quote = await quoteRent(rentals);
      return {
        rent: quote.rent,
        breakEven: quote.breakEven,
        capped: quote.capped,
        monthlyLoss: quote.monthlyLoss,
        control: quote.control,
        tenants,
        due: sum('info_rent_due'),
        collected: sum('rent_received'),
        debtTotal: Math.round(tenants.reduce((total, tenant) => total + tenant.debt * 100, 0)) / 100,
      };
    },

    /**
     * The stipend the player pays each administrator, and whether it keeps their house alive: it is judged against the cost of living (see
     * AdministratorPayPolicy.js). Read live from the settings and the shelf prices; nothing is stored.
     * @returns {Promise<{ stipend: number, known: boolean, tooLow: boolean, floor: number | null }>}
     */
    async getAdministratorPayStatus() {
      const [{ administratorStipend: stipend }, cost] = await Promise.all([hamletFiscalRates.getSalarySettings(), accountingApi.getCostOfLiving()]);
      return { stipend, ...administratorPayStatusOf({ stipend, costOfLiving: cost.total }) };
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
          building: { id: buildingId, type: building.type, accountKind },
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
      // The residents who look for no job (the administrators) are paid a stipend by the hamlet: they are neither workers nor unemployed.
      const seeking = residentsSeekingWork(house.type, house.pop);
      const salaried = house.pop - seeking;
      const residents = residentsOfHouse({ houseId, pop: house.pop, salaried, workplaces: workplaces.map(({ workplaceId, workers }) => ({ workplaceId, workers })) });
      const typeOf = new Map(workplaces.map((entry) => [entry.workplaceId, entry.workplaceType]));

      const workers = workplaces.reduce((sum, entry) => sum + entry.workers, 0);
      const settings = await hamletFiscalRates.getSalarySettings();
      const expectedPay = householdPublicPayOf({
        pop: seeking,
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
        { predictedBenefit: expectedPay.benefit, predictedStipend: Math.round(salaried * settings.administratorStipend * 100) / 100 },
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
      return getTreasurySnapshotQuery.cashOf({ accountBuildingId: buildingId, accountKind });
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

    /** @returns {Promise<Record<string, number>>} the VAT rate in force per good, in percent: nil while nobody holds the collection of the VAT. */
    getVatRates() {
      return vatRatesInForce();
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
     * Which taxes have someone to collect them now (a house of the city whose residents hold the tax's collection). A tax with nobody is in force at
     * 0 %, and the admin panels lock its rate and say why.
     * @returns {Promise<Record<keyof typeof TAX_COLLECTION_SKILLS, boolean>>}
     */
    async getTaxCollection() {
      const entries = await Promise.all(Object.entries(TAX_COLLECTION_SKILLS).map(async ([tax, skill]) => [tax, await taxIsCollected(skill)]));
      return Object.fromEntries(entries);
    },

    /** @returns {Promise<number>} the duty in force: the player's, or nil while nobody holds the collection of the customs */
    getCustomsDutyInForce(authority, flow, good, turn) {
      return customsDutyInForce(authority, flow, good, turn);
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
