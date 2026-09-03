/**
 * Session API — presentation-facing application surface (plan_use_case_wiring).
 *
 * Assembled in composition from BC contexts. Presentation receives this object;
 * it must not call getOrCreate*Context or composition/*Ops for covered flows.
 */

import { COMMERCIAL_ROUTE_FEE } from '../contexts/accounting/domain/catalogs/TreasuryCatalog.js';
import { createEmptyCityLedgerYearLines } from '../contexts/accounting/domain/value-objects/CityLedgerYearLines.js';
import {
  computeLoanRate,
  computeLoanRatesByType,
  computeLoanInterestAmount,
} from '../contexts/accounting/domain/policies/LoanRatePolicy.js';
import {
  INFO_JOURNAL_TYPE_LABELS,
  isInfoPseudoMovementType,
  labelForInfoJournalType,
} from '../contexts/accounting/domain/policies/LedgerInformativeTypePolicy.js';
import {
  OBJECTIVE_CATALOG,
  isObjectiveRequirementMet,
} from '../contexts/accounting/domain/catalogs/ObjectiveCatalog.js';
import { computeReferenceSalaryPayrollBreakdown } from '../contexts/accounting/domain/policies/ReferenceSalaryPayrollPolicy.js';
import {
  EMPLOYMENT_MAX_SECTORS,
  EMPLOYMENT_SECTOR_NAMES,
  DEFAULT_SECTOR_PRIORITIES,
} from '../contexts/employment/domain/catalogs/EmploymentSectorCatalog.js';
import { hasRoadAccessFromCount } from '../contexts/parcels/domain/value-objects/RoadAccess.js';
import {
  getBuildingsNamesInZone,
} from '../contexts/parcels/infrastructure/spatial/sceneNeighborhoodScan.js';
import {
  canPlaceBuildingAtTileWithSupplyRules,
} from './canPlaceBuildingAtTileWithSupplyRules.js';
import { isRoadBuildingType } from '../contexts/construction/domain/policies/FootprintAvailabilityPolicy.js';
import { listRoadPaintCells } from '../contexts/construction/domain/policies/RoadPaintPolicy.js';
import {
  cycleStonePathOrientationIndex,
  isStonePathTool,
  stonePathOrientationIndex,
  stonePathOrientationLabel,
  stonePathTypeForIndex,
} from '../contexts/construction/domain/policies/StonePathOrientationPolicy.js';

/**
 * @param {ReturnType<import('./createConstructionContext.js').createConstructionContext>} construction
 */
export function createConstructionSessionApi(construction) {
  return Object.freeze({
    placeBuildingAtTile: (params) => construction.placeBuildingAtTile(params),
    bulldozeBuildingAtTile: (params) => construction.bulldozeBuildingAtTile(params),
    placeBuildingRecord: (data) => construction.placeBuildingRecord(data),
    reclaimStaleBuildingRecordsForPlacement: (params) =>
      construction.reclaimStaleBuildingRecordsForPlacement(params),
    findBuildingAtTile: (params) => construction.findBuildingAtTile(params),
    getBuildingById: (instanceId) => construction.getBuildingById(instanceId),
    getBuildingField: (instanceId, key) => construction.getBuildingField(instanceId, key),
    updateBuildingFields: (instanceId, fields) =>
      construction.updateBuildingFields(instanceId, fields),
    incrementBuildingField: (params) => construction.incrementBuildingField(params),
    listAllBuildingRows: () => construction.listAllBuildingRows(),
    removeBuildingRecord: (instanceId) => construction.removeBuildingRecord(instanceId),
    bindSceneBuildingGrid: (ctx) => construction.bindSceneBuildingGrid(ctx),
    listSceneBuildingTypes: () => construction.listSceneBuildingTypes(),
    ensureBuildingEmployeesSchema: (instanceId, buildingType) =>
      construction.ensureBuildingEmployeesSchema(instanceId, buildingType),

    canPlaceBuildingAtTile: (params) => canPlaceBuildingAtTileWithSupplyRules(params),
    isRoadBuildingType: (buildingType) => isRoadBuildingType(buildingType),
    listRoadPaintCells: (...args) => listRoadPaintCells(...args),
    isStonePathTool: (buildingType) => isStonePathTool(buildingType),
    stonePathTypeForIndex: (index) => stonePathTypeForIndex(index),
    stonePathOrientationLabel: (index) => stonePathOrientationLabel(index),
    cycleStonePathOrientationIndex: (index) => cycleStonePathOrientationIndex(index),
    stonePathOrientationIndex: (buildingType) => stonePathOrientationIndex(buildingType),
  });
}

/**
 * @param {ReturnType<import('./createAccountingContext.js').createAccountingContext>} accounting
 * @param {{ getCityBuildingValuation: Function }} [cityAssets]
 */
export function createAccountingSessionApi(accounting, cityAssets = null) {
  const fiscal = accounting.fiscalSettingsRepository;

  return Object.freeze({
    getTreasuryBalance: () => accounting.getTreasuryBalance(),
    getTreasurySnapshot: () => accounting.getTreasurySnapshot(),
    getFinancialHealth: () => accounting.getFinancialHealth(),
    getActiveLoans: () => accounting.getActiveLoans(),
    getIncomeBreakdown: () => accounting.getIncomeBreakdown(),
    getExpenseBreakdown: () => accounting.getExpenseBreakdown(),
    getBalanceSheet: () => accounting.getBalanceSheet(),
    getIncomeStatement: (options) => accounting.getIncomeStatement(options),
    getFinancialStatementsHistory: (options) => accounting.getFinancialStatementsHistory(options),
    getGeneralLedger: (filters) => accounting.getGeneralLedger(filters),
    getCityLedgerYearComparison: () => accounting.getCityLedgerYearComparison(),
    exportJournalJson: () => accounting.exportJournalJson(),
    exportJournalPdf: () => accounting.exportJournalPdf(),

    getCitizenTaxPerCapita: () => fiscal.getCitizenTaxPerCapita(),
    setCitizenTaxPerCapita: (amount) => fiscal.setCitizenTaxPerCapita(amount),
    getSalarySettings: () => fiscal.getSalarySettings(),
    setSalarySettings: (partial) => fiscal.setSalarySettings(partial),
    computeReferenceSalaryPayrollBreakdown: (params) =>
      computeReferenceSalaryPayrollBreakdown(params),

    getCommercialRouteFee: () => COMMERCIAL_ROUTE_FEE,
    recordCommercialRouteFee: (...args) => accounting.recordCommercialRouteFee(...args),
    settleContribution: (params) => accounting.settleContribution(params),
    canAfford: (amount) => accounting.canAfford(amount),
    recordLoanCapital: (...args) => accounting.recordLoanCapital(...args),
    recordLoanInterest: (...args) => accounting.recordLoanInterest(...args),
    recordLoanRepayment: (...args) => accounting.recordLoanRepayment(...args),
    recordInfoLoanInstallment: (params) => accounting.recordInfoLoanInstallmentFromGame(params),
    advanceLoanInstallmentWithoutPayment: (loanId) =>
      accounting.advanceLoanInstallmentWithoutPayment(loanId),

    createEmptyCityLedgerYearLines: (...args) => createEmptyCityLedgerYearLines(...args),
    computeLoanRate: (...args) => computeLoanRate(...args),
    computeLoanRatesByType: (...args) => computeLoanRatesByType(...args),
    computeLoanInterestAmount: (...args) => computeLoanInterestAmount(...args),

    INFO_JOURNAL_TYPE_LABELS,
    isInfoPseudoMovementType: (...args) => isInfoPseudoMovementType(...args),
    labelForInfoJournalType: (...args) => labelForInfoJournalType(...args),

    OBJECTIVE_CATALOG,
    isObjectiveRequirementMet: (...args) => isObjectiveRequirementMet(...args),
    getObjectivesStore: () => ({
      recordObjectiveFailure: (data) => accounting.recordObjectiveFailure(data),
      recordObjectiveSuccess: (data) => accounting.recordObjectiveSuccess(data),
      getAllFailures: () => accounting.getAllObjectiveFailures(),
      getFailuresForObjective: (id) => accounting.getObjectiveFailuresForObjective(id),
    }),

    getCityBuildingValuation: () => {
      if (!cityAssets?.getCityBuildingValuation) {
        return Promise.reject(new Error('sessionApi.accounting: cityAssets not wired'));
      }
      return cityAssets.getCityBuildingValuation();
    },
  });
}

/**
 * @param {ReturnType<import('./createSupplyContext.js').createSupplyContext>} supply
 */
export function createSupplySessionApi(supply) {
  return Object.freeze({
    listWindmillSupplyViews: () => supply.listWindmillSupplyViews(),
    listSupplyMapBuildings: () => supply.listSupplyMapBuildings(),
    listSupplyStockSnapshots: () => supply.listSupplyStockSnapshots(),
    listNatureResources: () => supply.listNatureResources(),
    listCommercializableWindmills: async () => {
      const windmills = await supply.listWindmillSupplyViews();
      return windmills.filter((w) => w.isActive && w.commercializeEnabled);
    },
    updateSupplyBuildingFields: (id, fields) => supply.updateSupplyBuildingFields(id, fields),
    getSupplyBuildingRow: (id) => supply.getSupplyBuildingRow(id),
    getAllFoodTraceabilityTransactions: (maxAge = null) =>
      supply.getAllFoodTraceabilityTransactions(maxAge),
    getHubStorageInfoView: (hubKind, buildingRow, options = {}) =>
      supply.getHubStorageInfoView(hubKind, buildingRow, options),
    updateHubStorageOrderMode: (hubKind, buildingId, productId) =>
      supply.updateHubStorageOrderMode(hubKind, buildingId, productId),
    adjustHubStorageOrderShare: (hubKind, buildingId, productId, delta) =>
      supply.adjustHubStorageOrderShare(hubKind, buildingId, productId, delta),
  });
}

/**
 * @param {ReturnType<import('./createEmploymentContext.js').createEmploymentContext>} employment
 */
export function createEmploymentSessionApi(employment) {
  return Object.freeze({
    EMPLOYMENT_MAX_SECTORS,
    EMPLOYMENT_SECTOR_NAMES,
    DEFAULT_SECTOR_PRIORITIES,
    getSectorPriority: (sector) => employment.getSectorPriority(sector),
    getMergedSectorPriorities: () => employment.getMergedSectorPriorities(),
    updateSectorPrioritySync: (sector, priority) =>
      employment.updateSectorPrioritySync(sector, priority),
    getSectorName: (sector) => employment.getSectorName(sector),
    getCityEmploymentSummary: () => employment.getCityEmploymentSummary(),
  });
}

/**
 * @param {ReturnType<import('./createHousingContext.js').createHousingContext>} housing
 */
export function createHousingSessionApi(housing) {
  return Object.freeze({
    getCityTotalPopulation: async () => {
      const { totalPop } = await housing.getCityPopulationSummary();
      return totalPop;
    },
    getCityPopulationSummary: () => housing.getCityPopulationSummary(),
  });
}

/**
 * @param {ReturnType<import('./createParcelsContext.js').createParcelsContext>} [_parcels]
 */
export function createParcelsSessionApi(_parcels = null) {
  return Object.freeze({
    hasRoadAccessFromCount: (...args) => hasRoadAccessFromCount(...args),
    getBuildingsNamesInZone: (...args) => getBuildingsNamesInZone(...args),
  });
}

/**
 * @param {{
 *   construction: object,
 *   accounting?: object,
 *   cityAssets?: object,
 *   supply?: object,
 *   employment?: object,
 *   housing?: object,
 *   parcels?: object,
 *   intelligence?: object,
 * }} contexts
 */
export function assembleSessionApi({
  construction,
  accounting = null,
  cityAssets = null,
  supply = null,
  employment = null,
  housing = null,
  parcels = null,
  intelligence = null,
}) {
  const api = {
    construction: createConstructionSessionApi(construction),
  };
  if (accounting) {
    api.accounting = createAccountingSessionApi(accounting, cityAssets);
  }
  if (supply) {
    api.supply = createSupplySessionApi(supply);
  }
  if (employment) {
    api.employment = createEmploymentSessionApi(employment);
  }
  if (housing) {
    api.housing = createHousingSessionApi(housing);
  }
  if (parcels) {
    api.parcels = createParcelsSessionApi(parcels);
  }
  if (intelligence) {
    api.intelligence = Object.freeze({
      listIncomingNews: () => intelligence.listIncomingNews(),
      listArchivedNews: () => intelligence.listArchivedNews(),
      archiveNewsItem: (params) => intelligence.archiveNewsItem(params),
      deleteNewsItem: (params) => intelligence.deleteNewsItem(params),
      generateMonthlyCityNews: (params) => intelligence.generateMonthlyCityNews(params),
      generateMonthlyNews: (params) => intelligence.generateMonthlyNews(params),
      payForNewsItem: (params) => intelligence.payForNewsItem(params),
      canAffordContribution: (amount) => intelligence.canAffordContribution(amount),
    });
  }
  return Object.freeze(api);
}
