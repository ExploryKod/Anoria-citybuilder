import { describe, test, expect } from '@jest/globals';
import {
  buildRealtimeBudgetViewModel,
  buildLoanInterestDetailHtml,
  financialHealthStatusLabel,
  treasuryFundsDisplayStyle,
  netFlowDisplayStyle,
} from '../../../src/contexts/accounting/presentation/RealtimeBudgetViewModel.js';

describe('RealtimeBudgetViewModel', () => {
  test('financialHealthStatusLabel maps known statuses', () => {
    expect(financialHealthStatusLabel('healthy')).toBe('Sain');
    expect(financialHealthStatusLabel('unknown')).toBe('Inconnu');
  });

  test('treasuryFundsDisplayStyle reflects low funds', () => {
    expect(treasuryFundsDisplayStyle(5).color).toBe('#ff6b6b');
    expect(treasuryFundsDisplayStyle(100).color).toBe('var(--cta)');
  });

  test('netFlowDisplayStyle reflects sign', () => {
    expect(netFlowDisplayStyle(10).color).toBe('var(--success)');
    expect(netFlowDisplayStyle(-5).color).toBe('var(--danger)');
  });

  test('buildRealtimeBudgetViewModel derives net flow from treasury snapshot', () => {
    const viewModel = buildRealtimeBudgetViewModel({
      treasurySnapshot: {
        funds: 1200,
        income: 400,
        expenses: 250,
        turn: 7,
        totalLoanInterestExpenses: 12,
      },
      financialHealth: { status: 'healthy', message: 'OK' },
      incomeBreakdown: { taxes: 300, otherIncome: 100 },
      expenseBreakdown: { buildingMaintenance: 80, investments: 50 },
      population: 42,
    });

    expect(viewModel.funds.text).toBe('1\u202f200€');
    expect(viewModel.income).toBe('400€');
    expect(viewModel.expenses).toBe('250€');
    expect(viewModel.netFlow.text).toBe('150€');
    expect(viewModel.turn).toBe(7);
    expect(viewModel.taxes).toBe('300€');
    expect(viewModel.loanInterest).toBe('12€');
    expect(viewModel.health.statusText).toBe('Sain');
  });

  test('buildLoanInterestDetailHtml lists active loans', () => {
    const html = buildLoanInterestDetailHtml([
      { id: 'loan-abc123', type: 'bank', amount: 1000, interestRate: 12, duration: 4 },
    ]);

    expect(html).toContain('Prêt Bancaire');
    expect(html).toContain('abc123');
    expect(html).toContain('Total Intérêts par Tour');
  });

  test('buildLoanInterestDetailHtml handles empty portfolio', () => {
    expect(buildLoanInterestDetailHtml([])).toContain('Aucun prêt actif');
  });
});
