import { describe, test, expect } from '@jest/globals';
import { createBalanceSheet } from '../../../src/contexts/accounting/domain/read-models/BalanceSheet.js';
import { buildBalanceSheetViewModel } from '../../../src/contexts/accounting/presentation/BalanceSheetViewModel.js';
import { formatEuro } from '../../../src/contexts/accounting/presentation/formatMoney.js';

describe('BalanceSheetViewModel', () => {
  test('formatEuro uses fr-FR locale', () => {
    expect(formatEuro(1234)).toBe('1\u202f234€');
  });

  test('buildBalanceSheetViewModel maps BC totals to DOM fields', () => {
    const balanceSheet = createBalanceSheet({
      asOfTurn: 5,
      assets: {
        tangibleGross: 10_000,
        depreciation: 500,
        tangibleNet: 9_500,
        cash: 2_000,
        receivables: 300,
        total: 11_800,
      },
      liabilities: {
        shareCapital: 5_000,
        netResult: 1_200,
        bankLoans: 3_000,
        commercialLoans: 500,
        accruedExpenses: 100,
        equityReconciliation: 2_000,
        total: 11_800,
      },
    });

    const viewModel = buildBalanceSheetViewModel({
      balanceSheet,
      turn: 5,
      treasurySnapshot: { totalLoanInterestExpenses: 50, totalBuildingMaintenance: 75 },
    });

    expect(viewModel.elementValues['total-buildings-gross-value']).toBe(formatEuro(10_000));
    expect(viewModel.elementValues['total-buildings-net-value']).toBe(formatEuro(9_500));
    expect(viewModel.elementValues['total-depreciation-value']).toBe(formatEuro(500));
    expect(viewModel.elementValues['cash-value']).toBe(formatEuro(2_000));
    expect(viewModel.elementValues['total-receivables']).toBe(formatEuro(300));
    expect(viewModel.elementValues['total-current-assets']).toBe(formatEuro(2_300));
    expect(viewModel.elementValues['total-assets']).toBe(formatEuro(11_800));
    expect(viewModel.elementValues['share-capital']).toBe(formatEuro(5_000));
    expect(viewModel.elementValues['net-result']).toBe(formatEuro(1_200));
    expect(viewModel.elementValues['carried-forward']).toBe(formatEuro(2_000));
    expect(viewModel.elementValues['other-tangible']).toBe(formatEuro(2_000));
    expect(viewModel.elementValues['financial-debts-total']).toBe(formatEuro(3_500));
    expect(viewModel.elementValues['loan-interest-expenses']).toBe(formatEuro(50));
    expect(viewModel.elementValues['building-maintenance-expenses']).toBe(formatEuro(75));
    expect(viewModel.balanced).toBe(true);
    expect(viewModel.equityReconciliation).toBe(2_000);
  });
});
