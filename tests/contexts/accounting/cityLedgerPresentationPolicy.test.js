import { describe, test, expect } from '@jest/globals';
import { createEmptyCityLedgerYearLines } from '../../../src/contexts/accounting/domain/value-objects/CityLedgerYearLines.js';
import {
  splitBalanceIntoBenefitAndDeficit,
  cityLedgerNetTotalsForYear,
  enrichCityLedgerYearLinesWithNetColumns,
} from '../../../src/contexts/accounting/domain/policies/CityLedgerNetColumnsPolicy.js';
import {
  cityLedgerNetFlowLabelSuffixes,
  buildCityLedgerTableViewModel,
} from '../../../src/contexts/accounting/presentation/CityLedgerTableViewModel.js';

describe('City ledger net columns + table view model', () => {
  test('splitBalanceIntoBenefitAndDeficit separates sign', () => {
    expect(splitBalanceIntoBenefitAndDeficit(120)).toEqual({ benefit: 120, deficit: 0 });
    expect(splitBalanceIntoBenefitAndDeficit(-45)).toEqual({ benefit: 0, deficit: 45 });
    expect(splitBalanceIntoBenefitAndDeficit(0)).toEqual({ benefit: 0, deficit: 0 });
  });

  test('cityLedgerNetTotalsForYear rolls prior-year balance into nets', () => {
    const yearLines = {
      ...createEmptyCityLedgerYearLines(1),
      totalIncome: 500,
      totalExpenses: 300,
    };

    const nets = cityLedgerNetTotalsForYear(yearLines, -50);

    expect(nets.priorYearBenefit).toBe(0);
    expect(nets.priorYearDeficit).toBe(50);
    expect(nets.netIncome).toBe(500);
    expect(nets.netExpenses).toBe(350);
    expect(nets.netFlow).toBe(150);
  });

  test('enrichCityLedgerYearLinesWithNetColumns stores rounded net columns', () => {
    const enriched = enrichCityLedgerYearLinesWithNetColumns(
      {
        ...createEmptyCityLedgerYearLines(1),
        totalIncome: 200,
        totalExpenses: 100,
        balance: 120,
      },
      30
    );

    expect(enriched.netIncome).toBe(230);
    expect(enriched.netExpenses).toBe(100);
    expect(enriched.netFlow).toBe(130);
  });

  test('cityLedgerNetFlowLabelSuffixes describes benefit and deficit years', () => {
    expect(cityLedgerNetFlowLabelSuffixes(100, -20)).toEqual(['n-1: déficit', 'n: bénéfice']);
    expect(cityLedgerNetFlowLabelSuffixes(0, 0)).toEqual([]);
  });

  test('buildCityLedgerTableViewModel exposes benefit/deficit from prior balances', () => {
    const viewModel = buildCityLedgerTableViewModel({
      thisYear: { ...createEmptyCityLedgerYearLines(2), netFlow: 80, netIncome: 300, netExpenses: 220 },
      lastYear: { ...createEmptyCityLedgerYearLines(1), balance: -25, netFlow: -25 },
      twoYearsAgo: { ...createEmptyCityLedgerYearLines(0), balance: 10 },
      debt: 0,
      message: { text: 'ok', type: 'info' },
    });

    expect(viewModel.benefitLastYear).toBe(0);
    expect(viewModel.deficitLastYear).toBe(25);
    expect(viewModel.twoYearsAgoBenefit).toBe(10);
    expect(viewModel.netFlowLabelSuffixes).toContain('n-1: déficit');
  });
});
