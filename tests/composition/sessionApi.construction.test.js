import { describe, test, expect, beforeEach } from '@jest/globals';
import {
  assembleSessionApi,
  createConstructionSessionApi,
  createAccountingSessionApi,
} from '../../src/composition/sessionApi.js';
import {
  createConstructionContext,
  resetConstructionContextForTests,
} from '../../src/composition/createConstructionContext.js';
import {
  bindSessionRuntime,
  getSessionApi,
  getSessionConstructionApi,
  getSessionAccountingApi,
  requireSessionAccountingApi,
  resetSessionRuntimeForTests,
} from '../../src/composition/sessionRuntime.js';

describe('sessionApi construction (Barre 1)', () => {
  beforeEach(() => {
    resetConstructionContextForTests();
    resetSessionRuntimeForTests();
  });

  test('assembleSessionApi exposes frozen construction commands', () => {
    const construction = createConstructionContext({
      buildingRepository: {
        addRecord: async () => ({ success: true }),
        findById: async () => null,
        listAllRows: async () => [],
        updateFields: async () => {},
        incrementField: async () => {},
        deleteById: async () => {},
        findAtTile: async () => null,
      },
      recordExpense: async () => ({}),
      recordRefund: async () => ({}),
      syncRemovedBuilding: async () => {},
      awaitBudgetReady: async () => {},
      getTreasurySnapshot: async () => ({ funds: 1000 }),
    });

    const sessionApi = assembleSessionApi({ construction });

    expect(Object.isFrozen(sessionApi)).toBe(true);
    expect(Object.isFrozen(sessionApi.construction)).toBe(true);
    expect(typeof sessionApi.construction.placeBuildingAtTile).toBe('function');
    expect(typeof sessionApi.construction.bulldozeBuildingAtTile).toBe('function');
    expect(typeof sessionApi.construction.placeBuildingRecord).toBe('function');
    expect(sessionApi.accounting).toBeUndefined();
  });

  test('sessionRuntime holds sessionApi for presentation consumers', () => {
    const construction = createConstructionContext({
      buildingRepository: {
        addRecord: async () => ({ success: true }),
        findById: async () => null,
        listAllRows: async () => [],
        updateFields: async () => {},
        incrementField: async () => {},
        deleteById: async () => {},
        findAtTile: async () => null,
      },
      recordExpense: async () => ({}),
      recordRefund: async () => ({}),
      syncRemovedBuilding: async () => {},
      awaitBudgetReady: async () => {},
      getTreasurySnapshot: async () => ({ funds: 1000 }),
    });
    const sessionApi = assembleSessionApi({ construction });
    bindSessionRuntime({ sessionApi });

    expect(getSessionApi()).toBe(sessionApi);
    expect(getSessionConstructionApi()).toBe(sessionApi.construction);
  });

  test('createConstructionSessionApi delegates to context', async () => {
    const calls = [];
    const construction = {
      placeBuildingAtTile: async (params) => {
        calls.push(['place', params]);
        return { success: true };
      },
      bulldozeBuildingAtTile: async (params) => {
        calls.push(['bulldoze', params]);
        return { buildingId: 'House' };
      },
      placeBuildingRecord: async () => ({}),
      reclaimStaleBuildingRecordsForPlacement: async () => [],
      findBuildingAtTile: async () => null,
      getBuildingById: async () => null,
      getBuildingField: async () => false,
      updateBuildingFields: async () => {},
      incrementBuildingField: async () => {},
      listAllBuildingRows: async () => [],
      removeBuildingRecord: async () => {},
      bindSceneBuildingGrid: () => {},
      listSceneBuildingTypes: () => [],
      ensureBuildingEmployeesSchema: async () => {},
    };

    const api = createConstructionSessionApi(construction);
    await api.placeBuildingAtTile({ x: 1, y: 2, buildingType: 'House' });
    await api.bulldozeBuildingAtTile({ x: 1, y: 2 });

    expect(calls).toEqual([
      ['place', { x: 1, y: 2, buildingType: 'House' }],
      ['bulldoze', { x: 1, y: 2 }],
    ]);
  });
});

describe('sessionApi accounting (Barre 3)', () => {
  beforeEach(() => {
    resetSessionRuntimeForTests();
  });

  test('assembleSessionApi exposes accounting queries and loan helpers', () => {
    const accounting = {
      fiscalSettingsRepository: {
        getCitizenTaxPerCapita: () => 42,
        setCitizenTaxPerCapita: (n) => n,
        getSalarySettings: () => ({ salaryPerMonth: 10, salaryTaxRate: 0.1 }),
        setSalarySettings: (p) => p,
      },
      getTreasurySnapshot: async () => ({ funds: 100 }),
      getTreasuryBalance: async () => 100,
      getFinancialHealth: async () => ({ status: 'healthy' }),
      getActiveLoans: async () => [],
      getIncomeBreakdown: async () => ({}),
      getExpenseBreakdown: async () => ({}),
      getBalanceSheet: async () => ({}),
      getIncomeStatement: async () => ({}),
      getFinancialStatementsHistory: async () => [],
      getGeneralLedger: async () => ({}),
      getCityLedgerYearComparison: async () => ({}),
      exportJournalJson: async () => ({}),
      exportJournalPdf: async () => ({}),
      recordCommercialRouteFee: async () => ({}),
      recordLoanCapital: async () => ({}),
      recordLoanInterest: async () => ({}),
      recordLoanRepayment: async () => ({}),
      recordInfoLoanInstallmentFromGame: async () => ({}),
      advanceLoanInstallmentWithoutPayment: async () => ({}),
    };
    const cityAssets = {
      getCityBuildingValuation: async () => ({ totalValue: 1, pricesByType: {} }),
    };
    const construction = {
      placeBuildingAtTile: async () => ({}),
      bulldozeBuildingAtTile: async () => ({}),
      placeBuildingRecord: async () => ({}),
      reclaimStaleBuildingRecordsForPlacement: async () => [],
      findBuildingAtTile: async () => null,
      getBuildingById: async () => null,
      getBuildingField: async () => false,
      updateBuildingFields: async () => {},
      incrementBuildingField: async () => {},
      listAllBuildingRows: async () => [],
      removeBuildingRecord: async () => {},
      bindSceneBuildingGrid: () => {},
      listSceneBuildingTypes: () => [],
      ensureBuildingEmployeesSchema: async () => {},
    };

    const sessionApi = assembleSessionApi({ construction, accounting, cityAssets });
    bindSessionRuntime({ sessionApi });

    expect(Object.isFrozen(sessionApi.accounting)).toBe(true);
    expect(getSessionAccountingApi()).toBe(sessionApi.accounting);
    expect(requireSessionAccountingApi().getCitizenTaxPerCapita()).toBe(42);
    expect(typeof requireSessionAccountingApi().computeLoanRate).toBe('function');
    expect(requireSessionAccountingApi().INFO_JOURNAL_TYPE_LABELS).toBeTruthy();
  });

  test('createAccountingSessionApi maps recordInfoLoanInstallment to FromGame', async () => {
    const calls = [];
    const accounting = {
      fiscalSettingsRepository: {
        getCitizenTaxPerCapita: () => 0,
        setCitizenTaxPerCapita: (n) => n,
        getSalarySettings: () => ({ salaryPerMonth: 0, salaryTaxRate: 0 }),
        setSalarySettings: (p) => p,
      },
      getTreasurySnapshot: async () => ({}),
      getTreasuryBalance: async () => 0,
      getFinancialHealth: async () => ({}),
      getActiveLoans: async () => [],
      getIncomeBreakdown: async () => ({}),
      getExpenseBreakdown: async () => ({}),
      getBalanceSheet: async () => ({}),
      getIncomeStatement: async () => ({}),
      getFinancialStatementsHistory: async () => [],
      getGeneralLedger: async () => ({}),
      getCityLedgerYearComparison: async () => ({}),
      exportJournalJson: async () => ({}),
      exportJournalPdf: async () => ({}),
      recordCommercialRouteFee: async () => ({}),
      recordLoanCapital: async () => ({}),
      recordLoanInterest: async () => ({}),
      recordLoanRepayment: async () => ({}),
      recordInfoLoanInstallmentFromGame: async (params) => {
        calls.push(params);
        return { ok: true };
      },
      advanceLoanInstallmentWithoutPayment: async () => ({}),
    };

    const api = createAccountingSessionApi(accounting);
    await api.recordInfoLoanInstallment({ loanId: 'L1' });
    expect(calls).toEqual([{ loanId: 'L1' }]);
  });
});
