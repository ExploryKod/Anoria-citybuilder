import { getOrCreateGameSessionContext } from './createGameSessionContext.js';
import { getQuantityConsumerEntries, salesNatureOf } from '../shared/building-catalog/resourceRoleQueries.js';
import { SellCityStake } from '../contexts/accounting/application/services/SellCityStake.js';
import { InjectCompanyAid } from '../contexts/accounting/application/services/InjectCompanyAid.js';
import { COMPANY_AID_BOUNDS, DEFAULT_COMPANY_AID } from '../contexts/accounting/domain/catalogs/CompanyAidCatalog.js';
import { SettleCompanyAid } from '../contexts/accounting/application/services/SettleCompanyAid.js';
import { domesticProductOf, externalInterestOf, privateDebtOf, publicDebtOf as hamletPublicDebtOf } from '../contexts/accounting/domain/policies/HamletEconomyPolicy.js';
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
import { accountKeyOf, businessAccountOf, centralBankAccountOf } from '../contexts/accounting/domain/policies/AccountKeyPolicy.js';
import { AdjustWageRates } from '../contexts/accounting/application/services/AdjustWageRates.js';
import { RevalueMinimumWage } from '../contexts/accounting/application/services/RevalueMinimumWage.js';
import { DexieWageRateRepository, wageKey } from '../contexts/accounting/infrastructure/persistence/DexieWageRateRepository.js';
import { administratorPayStatusOf } from '../contexts/accounting/domain/policies/AdministratorPayPolicy.js';
import { benefitBaseOf, flooredWage, readLabourMarket, startWageOf, wageFloorOf } from '../contexts/accounting/domain/policies/WageRatePolicy.js';
import { START_WAGE_BASE } from '../contexts/accounting/domain/catalogs/LabourMarketCatalog.js';
import { wagePerWorkerOf } from '../contexts/accounting/domain/policies/ProducerChargePolicy.js';
import { buildingNameOf, companiesOf } from '../shared/building-catalog/buildingCompanies.js';
import { INSURANCE_LAW_LABELS } from '../shared/accounting-catalog/InsuranceCatalog.js';
import { insuranceLawStatusOf, isStaffed } from '../contexts/accounting/domain/policies/InsuranceLawPolicy.js';
import { isInvalid } from '../contexts/housing/domain/policies/InvalidityPolicy.js';
import { INCOME_STATEMENT, accountLabelOf, pcgOfJournalType } from '../shared/accounting-catalog/PcgJournalCatalog.js';
import { buildingFinanceFigures, cashMovementsOf, householdBudgetOf, householdLastMonthOf, incomeStatementOf } from '../contexts/accounting/domain/policies/BuildingFinancePolicy.js';
import { residentsOfHouse } from '../contexts/accounting/domain/policies/HouseResidentsPolicy.js';
import { residentPayBreakdownOf } from '../contexts/accounting/domain/policies/HouseResidentsPayPolicy.js';
import { householdPublicPayOf } from '../contexts/accounting/domain/policies/HouseholdPublicPayPolicy.js';
import { MONTHS_PER_YEAR } from '../shared/time/TimeCalendar.js';
import { balanceSheetOf } from '../contexts/accounting/domain/policies/BalanceSheetPolicy.js';
import { accountLedgerOf, trialBalanceOf } from '../contexts/accounting/domain/policies/AccountLedgerPolicy.js';
import { isLucrativeBuilding, payrollOf } from '../contexts/accounting/domain/policies/ProducerChargePolicy.js';
import { BUILDING_KIND_HOUSE, resolveBuildingKind } from '../shared/building-identity/index.js';
import { residentsCountOf } from '../shared/population/residentsCount.js';
import { houseEnterpriseOf, houseEnterprises, houseHoldsSkill, houseInvalidityRule, premisesShareOf, residentsSeekingWork } from '../shared/population/workforceQueries.js';
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
import { isActiveHamletRow, requireActiveHamletId } from '../core/persistence/hamlet/hamletSession.js';
import { buildingMaintenanceCost, maintenanceCategoryOf } from '../contexts/accounting/domain/policies/BuildingMaintenanceBreakdownPolicy.js';
import { CloseMonthAccounts } from '../contexts/accounting/application/services/CloseMonthAccounts.js';
import { FundNewCompanies } from '../contexts/accounting/application/services/FundNewCompanies.js';
import { difficultyMonthsOf, payablesOf } from '../contexts/accounting/domain/policies/DebtPolicy.js';
import { INSOLVENCY_DISPLAY, INSOLVENCY_GRACE_MONTHS, PAYABLE_KINDS } from '../contexts/accounting/domain/catalogs/PayableCatalog.js';
import { buildingTypeOfConstruction } from '../contexts/accounting/domain/policies/MonthClosingPolicy.js';
import { SettleProducerCharges } from '../contexts/accounting/application/services/SettleProducerCharges.js';
import { RecordHouseholdDeposit } from '../contexts/accounting/application/services/RecordHouseholdDeposit.js';
import { RecordHouseholdWithdrawal } from '../contexts/accounting/application/services/RecordHouseholdWithdrawal.js';
import { SettleStateArrears } from '../contexts/accounting/application/services/SettleStateArrears.js';
import { SettleBankDepositInterest } from '../contexts/accounting/application/services/SettleBankDepositInterest.js';
import { v4 as uuidv4 } from 'uuid';
import { BankRefinancing } from '../contexts/accounting/application/services/BankRefinancing.js';
import { BankCompanyCredit } from '../contexts/accounting/application/services/BankCompanyCredit.js';
import { SettleHouseholdSavings } from '../contexts/accounting/application/services/SettleHouseholdSavings.js';
import { depositBalanceOf, depositInterestsOf } from '../contexts/accounting/domain/policies/DepositBalancePolicy.js';
import { CAPITAL_WARNING_RATIO, CENTRAL_BANK_SKILL, MIN_CAPITAL_RATIO } from '../contexts/accounting/domain/catalogs/BankCatalog.js';
import { CASH_ACCOUNTS, isCashAccount } from '../contexts/accounting/domain/policies/EntryLegsPolicy.js';
import { DEFAULT_FEDERAL_MONETARY_POLICY } from '../contexts/accounting/domain/catalogs/FiscalRateCatalog.js';
import { debtCeilingOf } from '../contexts/accounting/domain/policies/PublicDebtPolicy.js';
import { EXTERNAL_LENDERS } from '../contexts/accounting/domain/catalogs/ExternalLenderCatalog.js';
import { availableExternalLenders } from '../contexts/accounting/domain/policies/ExternalLenderPolicy.js';
import { ownershipRegisterOf } from '../contexts/accounting/domain/policies/OwnershipRegisterPolicy.js';
import { aidEntriesOf, companyAidOf, sharesHeldIn } from '../contexts/accounting/domain/policies/CompanyAidLedgerPolicy.js';
import { depositBalancesAt } from '../contexts/accounting/domain/policies/DepositBalancePolicy.js';
import { stateBalanceSheetOf } from '../contexts/accounting/domain/policies/StateBalanceSheetPolicy.js';
import { stateArrearsOf } from '../contexts/accounting/domain/policies/StateArrearsPolicy.js';
import { STATE_ARREARS_KINDS } from '../shared/accounting-catalog/StateArrearsCatalog.js';
import { BenefactorGift } from '../contexts/accounting/application/services/BenefactorGift.js';
import { BENEFACTOR_GIFT } from '../contexts/accounting/domain/catalogs/BenefactorGiftCatalog.js';
import { BenefactorGiftRepository } from '../contexts/accounting/infrastructure/persistence/BenefactorGiftRepository.js';
import { getWorldCityById } from '../contexts/geography/domain/catalogs/WorldCityCatalog.js';
import { FederalMonetaryPolicyRepository } from '../contexts/accounting/infrastructure/persistence/FederalMonetaryPolicyRepository.js';
import { capitalStatusOf, companyCreditRateOf, corridorOf, computeLoanInterestAmount, computeLoanRate, computeLoanRatesByType, householdSavingShareOf, policyRateStatusOf, savingsRateOf } from '../contexts/accounting/domain/policies/LoanRatePolicy.js';
import { buildingCatalog, getBuildingDefinition } from '../shared/building-catalog/buildingCatalog.js';
import { getDaysPerMonth } from '../config/events.js';
import { turnsPerYear } from '../shared/time/TimeCalendar.js';
import { resolveGetTimeInfo } from './gameTimeBridge.js';
import { SOCIAL_CATEGORY } from '../shared/population/socialCategoryCatalog.js';
import { COST_OF_LIVING_BASKET } from '../contexts/accounting/domain/catalogs/LabourMarketCatalog.js';
import { costOfLivingOf } from '../contexts/accounting/domain/policies/CostOfLivingPolicy.js';
import { serviceSubsidyShare } from '../contexts/accounting/domain/policies/ServiceSubsidyPolicy.js';
import { addVatTo } from '../contexts/accounting/domain/policies/VatIncludedPolicy.js';
import { stockValueAtCapacity } from '../shared/resource-catalog/ValueChainCatalog.js';
import { getOrCreateCitizenRegistry } from './citizenRegistry.js';

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

/** The type of the workplace a resident works at; a workplace that is not in the hamlet is a defect, not a blank. */
function requireWorkplaceType(typeOf, resident) {
  const type = typeOf.get(resident.workplaceId);
  if (!type) throw new Error(`[residents] citizen ${resident.id} works at ${resident.workplaceId}, which is not a building of the hamlet`);
  return type;
}

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
  // The federation's monetary policy: one policy rate and one reserve ratio for every State, held once for the game.
  const federalMonetaryPolicy = deps.federalMonetaryPolicyRepository ?? new FederalMonetaryPolicyRepository(dexieDb);

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


  // The State may not spend more than its account at its central bank holds: what that account holds is read from the fold (the repository is built below, so it is
  // read when a payment is made, never before).
  const stateCashOf = async (hamletId) => {
    const fold = await journalRepository.getLegsFold();
    return [...CASH_ACCOUNTS].reduce((sum, account) => sum + fold.balanceOf(account, { hamletId, accountKey: null }), 0);
  };
  const recordLedgerEntryCommand = new RecordLedgerEntry(journalWritePort, gameTimePort, stateCashOf);
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
    return (skill, level) => flooredWage(latest.get(wageKey(skill, level))?.amount ?? startWageOf(skill, level), floor);
  };
  // What the unemployment benefit is a share of: the lowest wage in force, so it exists with or without a minimum wage.
  const benefitBaseOfHamlet = async (settings) => {
    const latest = await wageRateRepository.latestRows();
    return benefitBaseOf({ floor: wageFloorOf(settings), rates: [START_WAGE_BASE, ...[...latest.values()].map((row) => row.amount)] });
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
    listBuildings: async () => {
      const rows = (await dexieDb.houses.toArray()).filter(isActiveHamletRow);
      return rows.map((row) => {
        // The workers who do not work, house by house: the sick among those assigned, counted exactly by the worker distribution. The invalid hold no post (they are not
        // hired), so they are no absent worker: their pension is the house's (see `invalidCount` of the households).
        const absentSources = row.employees?.absentSources ?? {};
        return { id: row.id, type: row.type, companyId: row.companyId ?? null, workerSources: row.employees?.workerSources ?? {}, absentSources, sickAbsentSources: absentSources };
      });
    },
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
          // `invalid`: those of them who are invalid (judged monthly, `invalidCount`): they hold no post and draw a pension, not the unemployment benefit.
          return { id: row.id, pop: seeking, salaried: row.pop - seeking, invalid: seeking > 0 ? (row.invalidCount ?? 0) : 0 };
        }),
    getPublicPay: async () => {
      const settings = await hamletFiscalRates.getSalarySettings();
      return {
        benefitBase: await benefitBaseOfHamlet(settings),
        unemploymentBenefitRate: settings.unemploymentBenefitRate,
        employerContributionRate: settings.employerContributionRate,
        employeeContributionRate: settings.employeeContributionRate,
        administratorStipend: settings.administratorStipend,
        sicknessCover: await hamletFiscalRates.getSicknessCover(),
        insuranceMandatory: await hamletFiscalRates.getInsuranceMandatory(),
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
    // Read when the month is settled, after the bank's credit is wired below.
    borrowFromBank: (params) => bankCompanyCredit.lend(params),
    recordLedgerEntry: (params) => recordLedgerEntryCommand.execute({ ...params }),
  });
  const recordConsumerPurchases = new RecordConsumerPurchases({
    getVatRates: () => vatRatesInForce(),
    recordLedgerEntry: (params) => recordLedgerEntryCommand.execute({ ...params }),
  });

  /**
   * What a company's month costs at full staffing: its payroll with the employer's contributions, and its upkeep. The founding capital is sized on it, and so is the
   * ceiling of its credit from the bank. A company the catalog gives no staff count is a defect: it throws rather than costing nothing.
   * @param {{ id: string, type: string }} row
   * @param {(skill: string, level: number) => number} wageRateOf
   * @param {number} employerContributionRate
   * @returns {number} euros
   */
  function companyMonthlyNeedOf(row, wageRateOf, employerContributionRate) {
    const workers = getBuildingDefinition(row.type)?.employment?.workerNeed;
    if (typeof workers !== 'number') throw new Error(`[accounting] the company ${row.id} (${row.type}) declares no staff (employment.workerNeed): its month cannot be costed`);
    return payrollOf({ type: row.type, workers, wageRateOf }) * (1 + employerContributionRate) + buildingMaintenanceCost(row.type);
  }

  // The hamlet's bank (the lender and depositary behind a loan or a deposit, see RecordLoanCapitalIncome.js, RecordHouseholdDeposit.js), null while none is built (a real state: no savings, no loan). The catalog allows one per hamlet (maxPerHamlet), so a second one
  // is a defect: it throws rather than quietly picking one and hiding the other's depositors.
  const findBankBuildingId = async () => {
    const banks = (await dexieDb.houses.toArray()).filter((candidate) => isActiveHamletRow(candidate) && candidate.type === 'Bank');
    if (banks.length > 1) throw new Error(`[bank] the hamlet holds ${banks.length} banks (${banks.map((bank) => bank.id).join(', ')}): the catalog allows one`);
    return banks.length === 1 ? banks[0].id : null;
  };

  const recordHouseholdDeposit = new RecordHouseholdDeposit({
    recordLedgerEntry: (params) => recordLedgerEntryCommand.execute({ ...params }),
    fundsOf: async (houseId) =>
      await getTreasurySnapshotQuery.cashOf({ accountBuildingId: houseId, accountKind: 'particulier' }),
  });
  // The central bank is the building whose posts ask its skill, read from the catalog (never by its id).
  const centralBankType = (() => {
    const types = Object.keys(buildingCatalog).filter((type) => buildingCatalog[type].employment?.requiredSkill === CENTRAL_BANK_SKILL);
    if (types.length !== 1) throw new Error(`[bank] the catalog must hold one central bank (a building asking "${CENTRAL_BANK_SKILL}"), it holds ${types.length}`);
    return types[0];
  })();
  const centralBankRows = async () => (await dexieDb.houses.toArray()).filter((row) => isActiveHamletRow(row) && row.type === centralBankType);
  // The hamlet's central bank, null while none stands. The catalog allows one per hamlet (maxPerHamlet): a second one is a defect.
  // The account of this State's central bank, the institution: it exists from the founding, with or without its building (the building opens the counter), so its
  // books (the Treasury's account, the refinancing, its result) are the State's, not a building's (PLAN_BANK_MONEY.md).
  const findCentralBankId = async () => {
    const rows = await centralBankRows();
    if (rows.length > 1) throw new Error(`[bank] the hamlet holds ${rows.length} central banks (${rows.map((row) => row.id).join(', ')}): the catalog allows one`);
    return centralBankAccountOf(requireActiveHamletId());
  };
  // The policy rate in force and whether the player can move it (LoanRatePolicy.js): read from the hamlet's central banks, how many residents are named to their posts.
  // The levers are the federation's (one policy rate, one reserve ratio for every State: PLAN_BANK_MONEY.md), moved by the player while the central bank of some State
  // works, whichever hamlet he stands in. The refinancing is each State's own: only this State's central bank lends to this State's bank.
  const policyRateStatus = async () => {
    const posts = getBuildingDefinition(centralBankType).employment.workerNeed;
    const works = (row) => Object.values(row.employees?.appointedFrom ?? {}).reduce((sum, count) => sum + count, 0) >= posts;
    const federationRows = (await dexieDb.houses.toArray()).filter((row) => row.type === centralBankType);
    const policy = await federalMonetaryPolicy.get();
    return {
      ...policyRateStatusOf({
        setRate: policy.policyRate,
        defaultRate: DEFAULT_FEDERAL_MONETARY_POLICY.policyRate,
        setReserveRatio: policy.reserveRatio,
        defaultReserveRatio: DEFAULT_FEDERAL_MONETARY_POLICY.reserveRatio,
        centralBanks: federationRows.map((row) => ({ named: works(row) ? posts : 0, posts })),
      }),
      // Whether this State's own central bank works: only then can it refinance this State's bank.
      refinancingAvailable: (await centralBankRows()).some(works),
      centralBankType,
    };
  };
  // The central bank refinances the bank: it covers what the bank lacks to pay out, and is paid back each month (BankRefinancing.js).
  const bankRefinancing = new BankRefinancing({
    getTimeInfo: (turn) => gameTimePort.getTimeInfo(turn),
    findBankBuildingId,
    findCentralBankId,
    getPolicyRateStatus: policyRateStatus,
    getCapitalStatus: (bankId) => bankCapitalStatusOf(bankId),
    getLegsFold: () => journalRepository.getLegsFold(),
    recordLedgerEntry: (params) => recordLedgerEntryCommand.execute({ ...params }),
  });
  // The gift of a partner city to a city with no money left, once per game (BenefactorGift.js).
  const benefactorGift = new BenefactorGift({
    repository: new BenefactorGiftRepository(dexieDb),
    cityFunds: async () => (await getTreasurySnapshotQuery.execute()).funds,
    borrowingOpen: async () => (await cityBorrowing()).open,
    catalog: BENEFACTOR_GIFT,
    getTimeInfo: (turn) => gameTimePort.getTimeInfo(turn),
    currentTurn: () => getSessionGameTime(),
    cityName: (cityId) => {
      const city = getWorldCityById(cityId);
      if (!city) throw new Error(`[benefactor-gift] "${cityId}" is not a city of the world map: its name is unknown`);
      return city.name;
    },
    hamletId: () => requireActiveHamletId(),
    recordLedgerEntry: (params) => recordLedgerEntryCommand.execute({ ...params }),
  });
  /**
   * Whether the State can still borrow, and why not: its gross public debt against the ceiling its domestic product allows (PublicDebtPolicy), and whether the bank can
   * lend it (a bank is built, the supervisor has not frozen its lending, and it has reserves or collateral to lend from). Read from the journal's fold, never stored.
   * @returns {Promise<{ debt: number, gdp: number, ceiling: number, headroom: number, open: boolean, shutReason: null | 'no_bank' | 'capital' | 'no_reserves' | 'debt_ceiling' }>} euros
   */
  async function cityBorrowing() {
    const hamletId = requireActiveHamletId();
    const turn = getSessionGameTime();
    // The same debt and the same domestic product as the hamlet's economy screen (getHamletEconomy): one reading, no second one.
    const cityTotals = (await journalRepository.getLegsFold()).totalsByAccount({ hamletId }).get(null) ?? new Map();
    const gross = hamletPublicDebtOf(cityTotals, { loans: (await getTreasurySnapshotQuery.execute({ hamletId })).loans }).gross / 100;
    const economy = await accountingApi.getHamletEconomy();
    const debt = debtCeilingOf({ debt: gross, gdp: economy.ready ? economy.gdp : 0 });
    const bankId = await findBankBuildingId();
    let shutReason = null;
    if (!bankId) shutReason = 'no_bank';
    else if (['frozen', 'insolvent'].includes((await bankCapitalStatusOf(bankId)).status)) shutReason = 'capital';
    else {
      // What the bank can lend: the reserves above the reserve due, and what the central bank would still lend it against its loans.
      const position = await bankRefinancing.position(turn);
      const refinancing = (await policyRateStatus()).refinancingAvailable ? position.collateralCapacity : 0;
      if (position.reserves - position.requiredReserve + refinancing <= 0) shutReason = 'no_reserves';
    }
    if (!shutReason && debt.headroom <= 0) shutReason = 'debt_ceiling';
    return { ...debt, open: shutReason === null, shutReason };
  }
  // An external lender of the catalog, with its city's name (the world map's).
  function externalLenderOf(cityId) {
    const lender = EXTERNAL_LENDERS.find((candidate) => candidate.cityId === cityId);
    if (!lender) throw new Error(`[loans] "${cityId}" is not an external lender (${EXTERNAL_LENDERS.map((candidate) => candidate.cityId).join(', ')})`);
    const city = getWorldCityById(cityId);
    if (!city) throw new Error(`[loans] "${cityId}" is not a city of the world map: its name is unknown`);
    return { ...lender, cityName: city.name };
  }
  // The supervisor's reading of the bank: its equity (its derived balance sheet) against its loans (its journal), read when it is asked to lend.
  async function bankCapitalStatusOf(bankId) {
    const { equity } = (await accountingApi.getBuildingBalanceSheet(bankId, null)).liabilities;
    const position = await bankRefinancing.position(getSessionGameTime());
    return { equity, loans: position.loans, ...capitalStatusOf({ equity, loans: position.loans }) };
  }
  // The bank's credit to the companies short of cash, and its monthly interest and repayment (BankCompanyCredit.js).
  const bankCompanyCredit = new BankCompanyCredit({
    getTimeInfo: (turn) => gameTimePort.getTimeInfo(turn),
    findBankBuildingId,
    coverBankShortfall: (params) => bankRefinancing.coverShortfall(params),
    getPolicyRateStatus: policyRateStatus,
    monthlyNeedOf: async (buildingId) => {
      const row = await dexieDb.houses.get(buildingId);
      if (!row) throw new Error(`[company-credit] company ${buildingId} has no row: its credit ceiling cannot be read`);
      return companyMonthlyNeedOf(row, await marketWageRateOf(), (await hamletFiscalRates.getSalarySettings()).employerContributionRate);
    },
    listCompanies: async () =>
      (await dexieDb.houses.toArray())
        .filter((row) => isActiveHamletRow(row) && isLucrativeBuilding(row.type))
        .map((row) => ({ buildingId: row.id, name: buildingNameOf(row.type, row) })),
    cashOf: (buildingId) => getTreasurySnapshotQuery.cashOf({ accountBuildingId: buildingId, accountKind: null }),
    getLegsFold: () => journalRepository.getLegsFold(),
    recordLedgerEntry: (params) => recordLedgerEntryCommand.execute({ ...params }),
  });
  const recordHouseholdWithdrawal = new RecordHouseholdWithdrawal({
    recordLedgerEntry: (params) => recordLedgerEntryCommand.execute({ ...params }),
    depositBalanceOf: async (houseId, bankId) => depositBalanceOf(await journalRepository.getJournalEntries(), houseId, bankId),
  });
  // What the households do with their money each month: save above their cash buffer, the more the better the savings pay, and draw on it when short.
  const settleHouseholdSavings = new SettleHouseholdSavings({
    getTimeInfo: (turn) => gameTimePort.getTimeInfo(turn),
    findBankBuildingId,
    listHouseholds: async () =>
      (await dexieDb.houses.toArray())
        .filter((row) => isActiveHamletRow(row) && resolveBuildingKind(row.type) === BUILDING_KIND_HOUSE && row.pop >= 1)
        .map((row) => ({ houseId: row.id })),
    getSavingsRate: async () => savingsRateOf((await policyRateStatus()).rate),
    cashOf: (houseId) => getTreasurySnapshotQuery.cashOf({ accountBuildingId: houseId, accountKind: 'particulier' }),
    getJournalEntries: () => journalRepository.getJournalEntries(),
    getLegsFold: () => journalRepository.getLegsFold(),
    recordDeposit: (params) => recordHouseholdDeposit.execute(params),
    recordWithdrawal: (params) => recordHouseholdWithdrawal.execute(params),
  });

  const settleBankDepositInterest = new SettleBankDepositInterest({
    getTimeInfo: (turn) => gameTimePort.getTimeInfo(turn),
    listBuildings: async () => (await dexieDb.houses.toArray()).filter(isActiveHamletRow).map((row) => ({ id: row.id, type: row.type })),
    listDepositInterests: async (year, annualRate) => depositInterestsOf(await journalRepository.getJournalEntries(), { year, annualRate }),
    getDepositInterestRate: async () => savingsRateOf((await policyRateStatus()).rate),
    getBuildingDisplayName: (buildingType) => getBuildingDefinition(buildingType)?.displayName,
    recordLedgerEntry: (params) => recordLedgerEntryCommand.execute({ ...params }),
  });

  // The State pays its arrears (what it owed and could not pay when its Treasury was empty) before the month's own payments.
  const settleStateArrears = new SettleStateArrears({
    getTimeInfo: (turn) => gameTimePort.getTimeInfo(turn),
    getJournalEntries: () => journalRepository.getJournalEntries(),
    stateCash: () => stateCashOf(requireActiveHamletId()),
    listBuildings: async () => (await dexieDb.houses.toArray()).filter(isActiveHamletRow).map((row) => ({ id: row.id, type: row.type })),
    getBuildingDisplayName: (buildingType) => getBuildingDefinition(buildingType)?.displayName,
    recordLedgerEntry: (params) => recordLedgerEntryCommand.execute({ ...params }),
  });

  // The property company that is owed the rents and sells the land: the house that holds the owner skill, standing whether or not people live in it.
  const findPropertyOwner = async () => {
    const ownerHouse = (await dexieDb.houses.toArray())
      .filter((row) => isActiveHamletRow(row) && resolveBuildingKind(row.type) === BUILDING_KIND_HOUSE && houseHoldsSkill(row.type, 1, OWNER_SKILL))
      .sort((a, b) => String(a.id).localeCompare(String(b.id)))[0];
    return ownerHouse ? { id: ownerHouse.id, businessAccount: businessAccountOf(houseEnterpriseOf(ownerHouse.type, 'rental').id) } : null;
  };

  // The rent of every house but the owner's goes to the owner: the house whose residents hold the owner skill (the mayor's house).
  const getRentalHouses = async () => {
    const owned = (await dexieDb.houses.toArray())
      .filter(isActiveHamletRow)
      .filter((row) => resolveBuildingKind(row.type) === BUILDING_KIND_HOUSE)
      .sort((a, b) => String(a.id).localeCompare(String(b.id)));
    const houses = owned.filter((row) => row.pop >= 1);
    const owner = houses.find((row) => houseHoldsSkill(row.type, row.level ?? 1, OWNER_SKILL));
    if (!owner) return null;
    const nameOf = (row) => buildingNameOf(row.type, row);
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
    getCompanyAidPolicy: async () => (await hamletFiscalRates.getCompanyAid()).policy,
    treasuryHeld: () => stateCashOf(requireActiveHamletId()),
    recordLedgerEntry: (params) => recordLedgerEntryCommand.execute({ ...params }),
    listFoundingNeeds: async () => {
      const wageRateOf = await marketWageRateOf();
      const { employerContributionRate } = await hamletFiscalRates.getSalarySettings();
      const needs = [];
      for (const row of (await dexieDb.houses.toArray()).filter(isActiveHamletRow)) {
        const name = buildingNameOf(row.type, row);
        if (resolveBuildingKind(row.type) === BUILDING_KIND_HOUSE) {
          const business = houseEnterprises(row.type).enterprises.find((enterprise) => enterprise.activity === 'recipes');
          const share = premisesShareOf(row.type);
          // The business of a house rents a share of it: its month is that rent.
          if (business && share > 0) needs.push({ buildingId: row.id, accountKind: businessAccountOf(business.id), monthlyNeed: buildingMaintenanceCost(row.type) * share, stockValue: 0, name });
        } else if (isLucrativeBuilding(row.type)) {
          needs.push({ buildingId: row.id, accountKind: null, monthlyNeed: companyMonthlyNeedOf(row, wageRateOf, employerContributionRate), stockValue: stockValueAtCapacity(row.type), name });
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
  // What the companies the city helped owe it back: the interest and the repayments of the loans each month, the dividends of its holdings each January.
  const settleCompanyAid = new SettleCompanyAid({
    getTimeInfo: (turn) => gameTimePort.getTimeInfo(turn),
    listCompanies: async () =>
      (await dexieDb.houses.toArray())
        .filter((row) => isActiveHamletRow(row) && isLucrativeBuilding(row.type))
        .map((row) => ({ buildingId: row.id, name: buildingNameOf(row.type, row), x: row.x, y: row.y })),
    getJournalEntries: () => journalRepository.getJournalEntries(),
    getLegsFold: () => journalRepository.getLegsFold(),
    companyFundsOf: (buildingId) => getTreasurySnapshotQuery.cashOf({ accountBuildingId: buildingId, accountKind: null }),
    getCompanyAidPolicy: async () => (await hamletFiscalRates.getCompanyAid()).policy,
    recordLedgerEntry: (params) => recordLedgerEntryCommand.execute({ ...params }),
  });
  // The player puts money into a company that already lives (a shareholder, a loan, a participation), whenever he wants.
  const injectCompanyAid = new InjectCompanyAid({
    listCompanies: async () =>
      (await dexieDb.houses.toArray())
        .filter((row) => isActiveHamletRow(row) && isLucrativeBuilding(row.type))
        .map((row) => ({ buildingId: row.id, name: buildingNameOf(row.type, row), x: row.x, y: row.y })),
    getJournalEntries: () => journalRepository.getJournalEntries(),
    getLegsFold: () => journalRepository.getLegsFold(),
    getCompanyAidPolicy: async () => (await hamletFiscalRates.getCompanyAid()).policy,
    getTimeInfo: (turn) => gameTimePort.getTimeInfo(turn),
    recordLedgerEntry: (params) => recordLedgerEntryCommand.execute({ ...params }),
  });
  // The city sells shares it holds to the property company (SellCityStake.js).
  const sellCityStake = new SellCityStake({
    getJournalEntries: () => journalRepository.getJournalEntries(),
    getBuyer: () => findPropertyOwner(),
    cashOf: (buildingId, accountKind) => getTreasurySnapshotQuery.cashOf({ accountBuildingId: buildingId, accountKind }),
    isCompany: async (buildingId) => (await dexieDb.houses.get(buildingId)) !== undefined && isLucrativeBuilding((await dexieDb.houses.get(buildingId)).type),
    recordLedgerEntry: (params) => recordLedgerEntryCommand.execute({ ...params }),
  });
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
    getLegsFold: () => journalRepository.getLegsFold(),
    findBankBuildingId,
    findCentralBankId,
    // A liquidated bank pays out of its reserves at the central bank, its customers' deposits first (BankRefinancing.js).
    bankBooks: {
      liveReservesOf: (bankId, turn) => bankRefinancing.liveReservesOf(bankId, turn),
      centraliseBankBooks: (params) => bankRefinancing.centraliseBankBooks(params),
    },
    recordLedgerEntry: (params) => recordLedgerEntryCommand.execute({ ...params }),
    // The liquidation is written in one go, like a month's settlement: all its lines or none.
    inJournalBatch: (work) => sessionJournalStoreInstance.batch(work),
    getTimeInfo: (turn) => gameTimePort.getTimeInfo(turn),
    listBuildings: async () => (await dexieDb.houses.toArray()).filter(isActiveHamletRow).map((row) => ({ id: row.id, type: row.type })),
    // The accounts a liquidation closes: a company's own, or a house's business (its cooperative); a household's personal account is left alone, and so is a public
    // building's (it carries no debt). Each says the nature of the stock it carries, null when it carries none.
    getAccountsOf: async (buildingId) => {
      const row = await dexieDb.houses.get(buildingId);
      if (!row || !isActiveHamletRow(row)) return null;
      const nature = salesNatureOf(row.type);
      const stockNature = nature === null ? null : nature === 'merchandise' ? 'merchandise' : 'production';
      if (resolveBuildingKind(row.type) === BUILDING_KIND_HOUSE) {
        const business = houseEnterprises(row.type).enterprises.find((enterprise) => enterprise.activity === 'recipes');
        return business ? [{ accountKind: businessAccountOf(business.id), stockNature }] : [];
      }
      return isLucrativeBuilding(row.type) ? [{ accountKind: null, stockNature }] : [];
    },
    cashOf: (buildingId, accountKind) => getTreasurySnapshotQuery.cashOf({ accountBuildingId: buildingId, accountKind }),
    valueStock: (buildingId, period) => {
      if (typeof deps.valueStock !== 'function') throw new Error('[accounting] the stock valuation was not wired (deps.valueStock): a building could not be liquidated');
      return deps.valueStock(buildingId, period);
    },
    // The property company that is owed the rents: the house that holds the owner skill, standing whether or not people live in it (as the settlement reads it).
    getOwner: findPropertyOwner,
  });

  const processTurnBudget = new ProcessTurnBudget({
    collectCitizenTaxes: (time) => collectCitizenTaxes.execute({ time }),
    getTimeInfo: (time) => gameTimePort.getTimeInfo(time),
    // The month's settlement is written in one go: hundreds of lines, one transaction (see SessionJournalStore.batch).
    inJournalBatch: (work) => sessionJournalStoreInstance.batch(work),
    settleProducerCharges: (params) => settleProducerCharges.execute(params),
    settleHouseRents: (params) => settleHouseRents.execute(params),
    settleCompanyAid: (params) => settleCompanyAid.execute(params),
    settleBankRefinancing: (params) => bankRefinancing.settleMonth(params),
    settleBankCompanyCredit: (params) => bankCompanyCredit.settleMonth(params),
    settleHouseholdSavings: (params) => settleHouseholdSavings.execute(params),
    fundNewCompanies: (params) => fundNewCompanies.execute(params),
    closeMonthAccounts: (params) => closeMonthAccounts.execute(params),
    compactMonthFlows: ({ time }) => {
      const settled = gameTimePort.getTimeInfo(time);
      return supplyTraceabilityRepository.compactFlowsOfMonth(settled.year, settled.monthIndex);
    },
    settleBankDepositInterest: (params) => settleBankDepositInterest.execute(params),
    settleStateArrears: (params) => settleStateArrears.execute(params),
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

    /**
     * A day that failed and was not completed may have left the books incomplete (a month not settled, a movement not written): the journal says so, with an
     * informative line (`info_day_failed`, no legs, no money) dated by that turn, so the gap is read in the books and not only in the console. Once per turn.
     * @param {{ turn: number, message: string }} params
     */
    async recordDayFailure({ turn, message }) {
      const result = await recordLedgerEntryCommand.execute({
        turn,
        type: 'info_day_failed',
        amount: 0,
        description: `[Informatif] Jour non terminé, la comptabilité peut être incomplète - ${message}`,
        businessKey: `info:day_failed:${requireActiveHamletId()}:${turn}`,
      });
      if (!result.recorded && result.reason !== 'duplicate_business_key') {
        throw new Error(`[journal] the failure of day ${turn} was not recorded: ${result.reason}`);
      }
      return result;
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

    /** @param {string} houseId @returns {Promise<boolean>} whether this house is the owner's house, whose property company sells the land */
    async isPropertyOwner(houseId) {
      return (await findPropertyOwner())?.id === houseId;
    },

    /**
     * A company buys land from the property company (SCI) of the owner's house: the price comes out of the buyer's cash into the SCI's (a land purchase, a land sale), both
     * written together. The SCI found the land for nothing, so the whole price is its product. Refused, with nothing written, when the buyer cannot pay.
     * @param {{ buyerId: string, tileCount: number, pricePerTile: number, turn: number, label: string }} params
     * @returns {Promise<{ sold: boolean, reason?: string, amount: number }>}
     */
    async sellLandToCompany({ buyerId, tileCount, pricePerTile, turn, label }) {
      const owner = await findPropertyOwner();
      if (!owner) throw new Error('[land] the owner\'s house stands nowhere: the land for sale has no seller (a defect: nothing is built without it)');
      const amount = Math.round(tileCount * pricePerTile * 100) / 100;
      if (!(amount > 0)) throw new Error(`[land] a sale of ${tileCount} tiles at ${pricePerTile} is worth nothing`);
      if ((await getTreasurySnapshotQuery.cashOf({ accountBuildingId: buyerId, accountKind: null })) < amount) return { sold: false, reason: 'insufficient_funds', amount };
      const hamletId = requireActiveHamletId();
      const line = (type, description, account) => ({ turn, amount, type, description, buildingInstanceId: buyerId, businessKey: `${type}:${hamletId}:${buyerId}:${turn}`, ...account });
      for (const written of [
        line('land_purchase', `Terrain acheté ${label}`, { accountBuildingId: buyerId, accountKind: null, counterpartyBuildingId: owner.id }),
        line('land_sale', `Terrain vendu ${label}`, { accountBuildingId: owner.id, accountKind: owner.businessAccount, counterpartyBuildingId: buyerId }),
      ]) {
        const result = await recordLedgerEntryCommand.execute(written);
        if (!result.recorded) throw new Error(`[land] the ${written.type} line "${written.description}" was not recorded: ${result.reason}`);
      }
      return { sold: true, amount };
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
     * @param {{ buildingId: string, turn: number }} params
     * @returns {ReturnType<LiquidateDemolishedBuilding['preview']>} the debts owed to it that are released, and per account what the liquidation does (see LiquidateDemolishedBuilding.preview)
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

    /**
     * The hamlet's policy of aid to its companies (see CompanyAidCatalog.js), until which year the player is committed to it, the year it is now, and the catalog's defaults and
     * bounds the admin panel offers.
     */
    async getCompanyAid() {
      const { policy, committedUntilYear } = await hamletFiscalRates.getCompanyAid();
      return { policy, committedUntilYear, year: gameTimePort.getTimeInfo(gameTimePort.currentTurn()).year, defaults: DEFAULT_COMPANY_AID, bounds: COMPANY_AID_BOUNDS };
    },

    /** Each company with what the city holds in it (capital, stake as a shareholder, loans owed): what the player chooses from to put money into one. */
    describeAidCompanies() {
      return injectCompanyAid.describe();
    },

    /** The player puts `amount` euros into a company that already lives, as a shareholder, a loan or a participation. */
    /** The city sells shares it holds in a company to the property company. @param {{ buildingId: string, shares: number }} params */
    sellCityStake({ buildingId, shares }) {
      return sellCityStake.execute({ buildingId, shares, time: gameTimePort.currentTurn() });
    },

    injectCompanyAid({ buildingId, amount, form }) {
      return injectCompanyAid.execute({ buildingId, amount, form, time: gameTimePort.currentTurn() });
    },

    /** Sets the policy and commits the hamlet to it for its `commitmentYears`; refused while a previous decision still binds it. */
    async setCompanyAid(policy) {
      const year = gameTimePort.getTimeInfo(gameTimePort.currentTurn()).year;
      return hamletFiscalRates.setCompanyAid(policy, year);
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

    /**
     * The law of compulsory insurance: whether the player passed it, whether it can be (the insurance works) and so whether it is in force, and why it cannot be.
     * Read from the same facts as the settlement (InsuranceLawPolicy.js).
     * @returns {Promise<{ mandatory: boolean, available: boolean, inForce: boolean, reasons: string[] }>}
     */
    async getInsuranceLaw() {
      const rows = (await dexieDb.houses.toArray()).filter(isActiveHamletRow);
      const standing = new Set(rows.map((row) => row.id));
      const companies = [];
      for (const row of rows) {
        if (!companiesOf(row.type)) continue;
        const insolvency = await accountingApi.getInsolvency(row.id);
        // Staff in post is read as the settlement reads it: the workers the standing houses assign (isStaffed).
        const assigned = Object.fromEntries(Object.entries(row.employees?.workerSources ?? {}).filter(([houseId]) => standing.has(houseId)));
        companies.push({ staffed: isStaffed(assigned), defaultMonths: insolvency.months });
      }
      return insuranceLawStatusOf({ mandatory: await hamletFiscalRates.getInsuranceMandatory(), companies, graceMonths: INSOLVENCY_GRACE_MONTHS });
    },

    /** Passes or repeals the law. Passing it while the insurance does not work is refused, with the reason. @param {boolean} mandatory */
    async setInsuranceMandatory(mandatory) {
      if (mandatory === true) {
        const { available, reasons } = await accountingApi.getInsuranceLaw();
        if (!available) throw new Error(`[insurance-law] the law cannot be passed: ${reasons.map((reason) => INSURANCE_LAW_LABELS.reasons[reason]).join(' ')}`);
      }
      return hamletFiscalRates.setInsuranceMandatory(mandatory);
    },

    /**
     * The central bank's levers: the policy rate and the reserve ratio the player set, the ones in force (the catalog's defaults while no central bank works),
     * whether he can move them and why not, and what they give today: the savings rate, each loan's rate at the city's financial health, the bank's credit to the
     * companies, the bank's cash against its reserve, and what it owes the central bank. Every rate per year, a fraction.
     * @returns {Promise<{ setRate: number, defaultRate: number, rate: number, setReserveRatio: number, defaultReserveRatio: number, reserveRatio: number, available: boolean, reasons: string[], centralBankType: string, savingsRate: number, loanRates: { bank: number, commercial: number }, companyCreditRate: number, financialHealthStatus: string, refinancingOutstanding: number, bankPosition: { cash: number, deposits: number, requiredReserve: number } | null }>}
     */
    async getPolicyRate() {
      const status = await policyRateStatus();
      const health = await getFinancialHealthQuery.execute();
      const turn = getSessionGameTime();
      return {
        ...status,
        savingsRate: savingsRateOf(status.rate),
        householdSavingShare: householdSavingShareOf(savingsRateOf(status.rate)),
        loanRates: computeLoanRatesByType(health.status, status.rate),
        companyCreditRate: companyCreditRateOf(status.rate),
        // The corridor of the central bank's rates around the policy rate: deposit facility, main refinancing, marginal lending.
        corridor: corridorOf(status.rate),
        // The supervisor's thresholds, as shares of the bank's loans: warned under the first, lending frozen under the second.
        capitalRatios: { warning: CAPITAL_WARNING_RATIO, minimum: MIN_CAPITAL_RATIO },
        financialHealthStatus: health.status,
        // What the bank owes the central bank for its refinancing, and its cash against the reserve: read from the journal.
        refinancingOutstanding: await bankRefinancing.outstanding(turn),
        bankPosition: await bankRefinancing.position(turn),
      };
    },

    /**
     * Before the bank lends the State (`reservesOut`: the money leaves its reserves for the Treasury's account): it borrows what its reserves lack, the required reserve
     * kept, from its State's central bank when it works (BankRefinancing.coverShortfall).
     * @param {{ turn: number, bankId: string, reservesOut: number, depositsAdded: number }} params
     * @returns {Promise<{ covered: boolean, borrowed: number }>}
     */
    coverBankShortfall(params) {
      return bankRefinancing.coverShortfall(params);
    },

    /**
     * The balance sheet of this State's central bank, the institution (it belongs to no building, so no panel shows it): derived from its journal like any other, and it
     * holds no money of its own, so its cash is nothing and a gap would throw.
     */
    async getCentralBankBooks() {
      const centralBankId = await findCentralBankId();
      const now = gameTimePort.getTimeInfo(gameTimePort.currentTurn());
      const cash = await getTreasurySnapshotQuery.cashOf({ accountBuildingId: centralBankId });
      return balanceSheetOf(await journalRepository.getJournalEntries(), centralBankId, { cash, stock: [], currentYear: now.year });
    },

    /**
     * Whether the bank's losses ate its capital: its equity, read from its derived balance sheet. Null while no bank is built.
     * @returns {Promise<{ bankId: string, bankType: string, equity: number, insolvent: boolean, loans: number, ratio: number | null, capitalStatus: 'sound' | 'warning' | 'frozen' | 'insolvent' } | null>}
     *   `ratio`: its equity over its loans; `capitalStatus`: where it stands with its supervisor (warning, lending frozen, insolvent)
     */
    async getBankSolvency() {
      const bankId = await findBankBuildingId();
      if (!bankId) return null;
      const row = await dexieDb.houses.get(bankId);
      const { equity, loans, status, ratio } = await bankCapitalStatusOf(bankId);
      return { bankId, bankType: row.type, equity, insolvent: equity < 0, loans, ratio, capitalStatus: status };
    },

    /**
     * The city rescues an insolvent bank: it puts in, as capital, what its losses took beyond it (101 for the bank, the city's holding 261, as a company's founding
     * capital), so that its equity is back to nothing or more. Refused while the bank is solvent, and while the city cannot pay it.
     * @returns {Promise<{ recorded: true, amount: number } | { recorded: false, reason: 'insufficient_funds', amount: number }>}
     */
    async recapitaliseBank() {
      const solvency = await accountingApi.getBankSolvency();
      if (!solvency || solvency.capitalStatus === 'sound') throw new Error('[bank] only a bank thin on capital (warned, frozen or insolvent) is recapitalised');
      // Enough capital to be back above the warning ratio of its loans (and above nothing).
      const amount = Math.ceil(Math.max(0, CAPITAL_WARNING_RATIO * solvency.loans) - solvency.equity);
      if ((await getTreasurySnapshotQuery.execute()).funds < amount) return { recorded: false, reason: 'insufficient_funds', amount };
      const turn = getSessionGameTime();
      const transactionId = uuidv4();
      const description = `Recapitalisation de la banque par la ville (${amount} €)`;
      const common = { turn, transactionId, amount, description, buildingInstanceId: solvency.bankId };
      for (const line of [
        { ...common, type: 'company_capital_paid', accountBuildingId: null, counterpartyBuildingId: solvency.bankId },
        { ...common, type: 'company_capital_received', accountBuildingId: solvency.bankId },
      ]) {
        const result = await recordLedgerEntryCommand.execute(line);
        if (!result.recorded) throw new Error(`[bank] the recapitalisation line ${line.type} was not recorded: ${result.reason}`);
      }
      return { recorded: true, amount };
    },

    /** Month's close: the offer of a partner city's gift when the city has no money left (once per game). @returns {Promise<{ cityId: string, cityName: string, amount: number } | null>} */
    offerBenefactorGift(params) {
      return benefactorGift.offerIfDue(params);
    },

    /**
     * Who owns what, read from the journal and the buildings (OwnershipRegisterPolicy.js): the companies' capital, the buildings' owners, and every debt with its creditor and its
     * debtor. Euros; nothing is stored.
     */
    async getOwnershipRegister() {
      const hamletId = requireActiveHamletId();
      const turn = getSessionGameTime();
      const rows = (await dexieDb.houses.toArray()).filter(isActiveHamletRow);
      const entries = await journalRepository.getJournalEntries();
      const byAccount = (await journalRepository.getLegsFold()).totalsByAccount({ hamletId });
      const bankId = await findBankBuildingId();
      const aidEntries = aidEntriesOf(entries);
      const ownable = rows.filter((row) => !['road', 'nature'].includes(resolveBuildingKind(row.type)));
      const nameOfRow = new Map(ownable.map((row) => [row.id, buildingNameOf(row.type, row)]));
      const kindOf = (row) => (resolveBuildingKind(row.type) === BUILDING_KIND_HOUSE ? 'house' : isLucrativeBuilding(row.type) ? 'company' : 'public');
      const creditBalance = (id, account) => {
        const total = byAccount.get(accountKeyOf({ accountBuildingId: id }))?.get(account);
        return total ? (total.credit - total.debit) / 100 : 0;
      };
      const companies = ownable.filter((row) => kindOf(row) === 'company').map((row) => {
        const aid = companyAidOf(aidEntries, row.id);
        const held = sharesHeldIn(aidEntries, row.id);
        return {
          id: row.id,
          capital: aid.totalCapital / 100,
          cityShares: held.city,
          totalShares: aid.totalShares,
          privateHolders: held.privateHolders.map((holder) => ({ holderId: holder.holderId, capital: holder.capital / 100, shares: holder.shares })),
          aidOutstanding: aid.outstanding / 100,
          bankCredit: creditBalance(row.id, '1643'),
        };
      });
      const register = ownershipRegisterOf({
        cityName: 'La ville',
        centralBankName: getBuildingDefinition(centralBankType).displayName,
        // A building that is gone but still owed or owing (a demolished house's savings) shows as "…" with a one-time warning, never a made-up name.
        nameOf: (id) => {
          const name = nameOfRow.get(id);
          if (name) return name;
          console.warn(`[ownership] building ${id} is not in the hamlet: its name is unknown`);
          return '…';
        },
        buildings: ownable.map((row) => ({ id: row.id, name: nameOfRow.get(row.id), kind: kindOf(row) })),
        propertyOwnerId: (await findPropertyOwner())?.id ?? null,
        companies,
        cooperatives: ownable
          .filter((row) => kindOf(row) === 'house' && houseEnterprises(row.type).enterprises.length > 0)
          .map((row) => ({ id: row.id, name: nameOfRow.get(row.id), residents: residentsCountOf(row) })),
        bankId,
        cityLoans: (await getTreasurySnapshotQuery.execute({ hamletId })).loans,
        refinancing: bankId ? await bankRefinancing.outstanding(turn) : 0,
        deposits: bankId ? [...depositBalancesAt(entries, bankId)].map(([houseId, centimes]) => ({ houseId, amount: centimes / 100 })) : [],
        stateArrears: stateArrearsOf(entries).map((debt) => ({ creditorId: debt.creditorId, label: STATE_ARREARS_KINDS[debt.kind].label, amount: debt.centimes / 100 })),
        payables: [...payablesOf(entries).values()].map((debt) => ({ debtorId: debt.debtorId, creditorId: debt.creditorId, label: PAYABLE_KINDS[debt.kind].label, amount: debt.centimes / 100 })),
      });
      // The State's own balance sheet: what it holds against what it owes, from the totals of its account.
      const label = (account) => {
        try {
          return accountLabelOf(account);
        } catch {
          return `Compte ${account}`;
        }
      };
      return { ...register, stateBalanceSheet: stateBalanceSheetOf(byAccount.get(null) ?? new Map(), label) };
    },

    /** @returns {Promise<object>} what the State owes, the ceiling its income allows, and whether it can still borrow (see cityBorrowing) */
    getCityBorrowing() {
      return cityBorrowing();
    },

    /** @returns {Promise<{ cityId: string, cityName: string, amount: number, status: string } | null>} the gift offered to the city and its answer */
    getBenefactorGift() {
      return benefactorGift.current();
    },

    /** @param {{ accept: boolean }} params the player's answer to the offer */
    answerBenefactorGift(params) {
      return benefactorGift.answer(params);
    },

    /** @returns {string} the central bank's building type, read from the catalog (the building whose posts ask its skill) */
    getCentralBankType() {
      return centralBankType;
    },

    /**
     * Moves the federation's policy rate, for every State. Refused while the central bank of no State works: the rate in force is then the catalog's.
     * @param {number} rate per year, a fraction
     */
    async setPolicyRate(rate) {
      const { available, reasons } = await policyRateStatus();
      if (!available) throw new Error(`[federal-bank] the policy rate cannot be moved: ${reasons.join(', ')}`);
      return federalMonetaryPolicy.set('policyRate', rate);
    },

    /**
     * Moves the federation's reserve ratio, for every State. Refused while the central bank of no State works: the ratio in force is then the catalog's.
     * @param {number} ratio a share of the deposits
     */
    async setReserveRatio(ratio) {
      const { available, reasons } = await policyRateStatus();
      if (!available) throw new Error(`[federal-bank] the reserve ratio cannot be moved: ${reasons.join(', ')}`);
      return federalMonetaryPolicy.set('reserveRatio', ratio);
    },

    /** Boot: the game holds the federation's monetary policy from the catalog's defaults (a lever already set is kept). */
    ensureFederalMonetaryPolicy() {
      return federalMonetaryPolicy.ensure();
    },

    /**
     * The terms the bank offers the city for a loan today: its yearly rate (the policy rate in force, the bank's spread, the city's health) and the whole interest
     * for its duration. What the loans panel shows is what the contract writes.
     * @param {{ loanType: 'bank' | 'commercial', amount: number, durationTurns: number }} params
     * @returns {Promise<{ yearlyRate: number, interest: number, total: number }>}
     */
    async getLoanTerms({ loanType, amount, durationTurns, lenderCityId = null }) {
      const { rate } = await policyRateStatus();
      const health = await getFinancialHealthQuery.execute();
      // An external loan adds the spread of the city that lends it; any other loan has no lender city.
      if ((loanType === 'external') !== (lenderCityId !== null)) throw new Error(`[loans] a ${loanType} loan ${loanType === 'external' ? 'must name' : 'has no'} lender city (got ${lenderCityId})`);
      const lenderSpread = lenderCityId === null ? 0 : externalLenderOf(lenderCityId).extraSpread;
      const yearlyRate = computeLoanRate({ loanType, financialHealthStatus: health.status, policyRate: rate, lenderSpread });
      const interest = computeLoanInterestAmount({ amount, yearlyRate, durationTurns, turnsPerYear: turnsPerYear(getDaysPerMonth()) });
      return { yearlyRate, interest, total: amount + interest };
    },

    /**
     * The partner cities that lend the city money now, in the catalog's order (ExternalLenderCatalog.js).
     * @param {{ partnerIds: string[] }} params the cities the hamlet trades with
     * @returns {Array<{ cityId: string, cityName: string, extraSpread: number, maxAmount: number }>}
     */
    listExternalLenders({ partnerIds }) {
      return availableExternalLenders({ partnerIds, lenders: EXTERNAL_LENDERS }).map((lender) => ({ ...lender, cityName: externalLenderOf(lender.cityId).cityName }));
    },

    /** Who pays a worker who is sick: 'none' or 'secu' (see SicknessCoverCatalog.js). @returns {Promise<string>} */
    getSicknessCover() {
      return hamletFiscalRates.getSicknessCover();
    },

    /** @param {string} cover one of SICKNESS_COVERS @returns {Promise<string>} */
    setSicknessCover(cover) {
      return hamletFiscalRates.setSicknessCover(cover);
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
     * The economy of the active hamlet, read from the fold of its journal (see HamletEconomyPolicy.js): the domestic product (value added of the companies, plus the administration at
     * cost) and the national income, the public debt and what is set against it, the debt of the companies, and the savings of the households. The reference is the last full year, or
     * the months already settled in the first year, brought to a year; none yet is `ready: false`. Euros; nothing is stored.
     */
    async getHamletEconomy() {
      const now = gameTimePort.getTimeInfo(gameTimePort.currentTurn());
      // The reference is the twelve months ending with this one (the product of the last twelve months, as a debt is set against it): the lines of a month are stamped with the month
      // they were settled in, the previous month's included. In the first year, the months there are, brought to a year; none yet is not ready.
      const toKey = now.year * MONTHS_PER_YEAR + now.monthIndex;
      const fromKey = Math.max(0, toKey - (MONTHS_PER_YEAR - 1));
      const months = toKey - fromKey + 1;
      if (toKey === 0) return { ready: false, months: 0 };
      const hamletId = requireActiveHamletId();
      const fold = await journalRepository.getLegsFold();
      const window = { hamletId, fromKey, toKey };
      const toYear = (centimes) => Math.round((centimes * MONTHS_PER_YEAR) / months) / 100;
      const toEuros = (centimes) => centimes / 100;
      const product = domesticProductOf(fold.totalsByAccount(window));
      const upToNow = fold.totalsByAccount({ hamletId });
      const cityTotals = upToNow.get(null) ?? new Map();
      const portfolio = { loans: (await getTreasurySnapshotQuery.execute({ hamletId })).loans };
      const debt = hamletPublicDebtOf(cityTotals, portfolio);
      const external = externalInterestOf(fold.totalsByAccount(window).get(null) ?? new Map(), debt);
      const privateDebt = privateDebtOf(upToNow);
      const population = (await dexieDb.houses.toArray()).filter((row) => isActiveHamletRow(row) && resolveBuildingKind(row.type) === BUILDING_KIND_HOUSE).reduce((sum, row) => sum + residentsCountOf(row), 0);
      const gdp = toYear(product.gdp);
      return {
        ready: true,
        months,
        population,
        gdp,
        valueAdded: toYear(product.valueAdded),
        publicOutput: toYear(product.publicOutput),
        externalInterest: toYear(external),
        gni: gdp - toYear(external),
        publicDebt: {
          loans: toEuros(debt.loans),
          overdraft: toEuros(debt.overdraft),
          suppliers: toEuros(debt.suppliers),
          gross: toEuros(debt.gross),
          cash: toEuros(debt.cash),
          receivables: toEuros(debt.receivables),
          loansGranted: toEuros(debt.loansGranted),
          holdings: toEuros(debt.holdings),
          net: toEuros(debt.net),
          domesticLoans: toEuros(debt.domesticLoans),
        },
        privateDebt: {
          loans: toEuros(privateDebt.loans),
          overdrafts: toEuros(privateDebt.overdrafts),
          unpaid: toEuros(privateDebt.unpaid),
          total: toEuros(privateDebt.total),
          indebted: privateDebt.indebted,
          companies: privateDebt.companies,
        },
        householdSavings: toEuros(privateDebt.householdSavings),
        companyCash: toEuros(privateDebt.companyCash),
      };
    },

    /**
     * What each house earned and had to pay in a month on average, to read its purchasing power: its income (pays, benefits, shares), its imposed spending
     * (income tax, social contributions, citizen tax, services, rent), what it bought of goods, and its savings now. Read from the journal's lines of its
     * personal account, nothing stored. The reference is the last full year, or the months already settled in the first year; none yet is `ready: false`.
     * @returns {Promise<{ ready: boolean, year: number, months: number, households: Array<{ id: string, type: string, savings: number, income: number, mandatory: number, goodsBought: number }> }>}
     */
    async getHouseholdBudgets() {
      const now = gameTimePort.getTimeInfo(gameTimePort.currentTurn());
      // The reference is the last full year (12 months); in the first year, the months already settled (a month's pay is settled on the first day of the next one).
      const year = now.year > 0 ? now.year - 1 : now.year;
      const months = now.year > 0 ? MONTHS_PER_YEAR : now.monthIndex;
      if (months === 0) return { ready: false, year, months, households: [] };
      const entries = await journalRepository.getJournalEntries();
      const houses = (await dexieDb.houses.toArray()).filter((row) => isActiveHamletRow(row) && resolveBuildingKind(row.type) === BUILDING_KIND_HOUSE);
      const households = [];
      for (const house of houses) {
        const figures = buildingFinanceFigures(entries, house.id, { year, accountKind: 'particulier' });
        const perMonth = (euros) => Math.round((euros * 100) / months) / 100;
        households.push({
          id: house.id,
          type: house.type,
          savings: await getTreasurySnapshotQuery.cashOf({ accountBuildingId: house.id, accountKind: 'particulier' }),
          income: perMonth(figures.wagesReceived + figures.publicWageReceived + figures.benefitReceived + figures.participationReceived + figures.dividendReceived + figures.incomeTaxRefunded),
          mandatory: perMonth(figures.incomeTax + figures.employeeContributionPaid + figures.citizenTax + figures.servicesPaid + figures.rentPaid),
          goodsBought: perMonth(figures.goodsBought),
        });
      }
      return { ready: true, year, months, households };
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
      // The cash accounts of the grand livre (a building's money is at a bank, 512, or in banknotes, 53): the same figure the treasury reads.
      const bank = ledger.filter((account) => isCashAccount(account.account)).reduce((sum, account) => sum + account.balance, 0);
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
        const amount = flooredWage(last ? last.amount : startWageOf(row.skill, row.level), floor);
        const previous = history.length >= 2 ? history.at(-2).amount : last ? startWageOf(row.skill, row.level) : null;
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
     * the same way any other balance is (see DepositBalancePolicy.js). The bank is named by the caller (findBankBuildingId): with no bank there are
     * no savings to read, and asking for them throws rather than reading 0.
     * @param {string} houseId
     * @param {string} bankId
     * @returns {Promise<number>}
     */
    async getHouseholdDepositBalance(houseId, bankId) {
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
      // The residents who look for no job (the administrators) are paid a stipend by the hamlet: they are neither workers nor unemployed.
      const seeking = residentsSeekingWork(house.type, house.pop);
      const salaried = house.pop - seeking;
      const citizens = await getOrCreateCitizenRegistry().forHouse({ houseId, hamletId: house.hamletId });
      const residents = residentsOfHouse({ houseId, citizens, seeksWork: seeking > 0 });
      const typeOf = new Map(rows.map((row) => [row.id, row.type]));

      const workers = residents.filter((resident) => resident.status === 'worker').length;
      const settings = await hamletFiscalRates.getSalarySettings();
      const expectedPay = householdPublicPayOf({
        pop: seeking - (seeking > 0 ? (house.invalidCount ?? 0) : 0),
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

      // Whether each is invalid now (HealthFactorCatalog.js), read from the citizen and the rule of his category: the sheet says so.
      const rule = houseInvalidityRule(house.type);
      const invalidOf = new Map(citizens.map((citizen) => [citizen.id, isInvalid(citizen, rule)]));

      return residents.map((resident) => ({
        ...resident,
        workplaceType: resident.workplaceId ? requireWorkplaceType(typeOf, resident) : null,
        invalid: invalidOf.get(resident.id),
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
     * Whether a company has booked a sale of its production: a credit on the accounts of the statement's "Production vendue" line, read from the fold of
     * the journal (a sum over its months, not a pass over the journal), whichever year.
     * @param {string} buildingId
     * @returns {Promise<boolean>}
     */
    async hasBuildingSold(buildingId) {
      const productionSold = INCOME_STATEMENT.flatMap((section) => section.lines).find((line) => line.id === 'productionSold');
      if (!productionSold) throw new Error('[accounting] the income statement has no "productionSold" line');
      const fold = await journalRepository.getLegsFold();
      const totals = fold.totalsOf({ accountKey: buildingId });
      return [...totals].some(([account, total]) => total.credit > 0 && productionSold.accounts.some((start) => account.startsWith(start)));
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
