import {
  buildLedgerBusinessKey,
  inferBusinessKeyFromRow,
  buildLoanInstallmentBusinessKey,
  buildInfoMovementBusinessKey,
  buildLoanCapitalBusinessKey,
  buildCapitalFundsBusinessKey,
  buildCommercialRouteBusinessKey,
  buildCarryForwardBusinessKey,
  buildCumulBusinessKey,
} from '../src/composition/facades/accountingLedgerKeys.js';
import { describe, test, expect } from '@jest/globals';

describe('ledgerBusinessKeys', () => {
  test('buildLedgerBusinessKey for monthly types', () => {
    expect(buildLedgerBusinessKey('salary', { year: 1, monthIndex: 2 })).toBe(
      'salary:1:2'
    );
    expect(buildLedgerBusinessKey('payroll_tax', { year: 0, monthIndex: 11 })).toBe(
      'payroll_tax:0:11'
    );
    expect(buildLedgerBusinessKey('maintenance', { year: 3, monthIndex: 0 })).toBe(
      'maintenance:3:0'
    );
  });

  test('buildLedgerBusinessKey for citizen_tax is yearly', () => {
    expect(buildLedgerBusinessKey('citizen_tax', { year: 2, monthIndex: 10 })).toBe(
      'citizen_tax:2'
    );
  });

  test('buildLedgerBusinessKey returns null for non-idempotent types', () => {
    expect(buildLedgerBusinessKey('construction', { year: 0, monthIndex: 0 })).toBeNull();
  });

  test('buildLoanInstallmentBusinessKey is per loan and turn', () => {
    expect(
      buildLoanInstallmentBusinessKey('loan_interest', 'loan_abc', 12)
    ).toBe('loan_interest:loan_abc:12');
    expect(
      buildLoanInstallmentBusinessKey('loan_repayment', 'loan_abc', 12)
    ).toBe('loan_repayment:loan_abc:12');
    expect(buildLoanInstallmentBusinessKey('loan_interest', null, 12)).toBeNull();
  });

  test('buildInfoMovementBusinessKey uses info namespace', () => {
    expect(
      buildInfoMovementBusinessKey('loan_interest', 'loan_abc', 12)
    ).toBe('info:loan_interest:loan_abc:12');
    expect(
      buildInfoMovementBusinessKey('loan_repayment', 'loan_abc', 12)
    ).toBe('info:loan_repayment:loan_abc:12');
  });

  test('buildCommercialRouteBusinessKey is per partner', () => {
    expect(buildCommercialRouteBusinessKey('city_savana')).toBe(
      'commercial_route:city_savana'
    );
    expect(buildCommercialRouteBusinessKey(null)).toBeNull();
  });

  test('buildCapitalFundsBusinessKey is fixed for turn 0', () => {
    expect(buildCapitalFundsBusinessKey()).toBe('capital_funds:0');
  });

  test('buildCarryForwardBusinessKey and buildCumulBusinessKey are yearly', () => {
    expect(buildCarryForwardBusinessKey(2)).toBe('carry_forward:2');
    expect(buildCumulBusinessKey('cumul_salary', 1)).toBe('cumul_salary:1');
  });

  test('inferBusinessKeyFromRow from month/year fields', () => {
    expect(
      inferBusinessKeyFromRow({
        type: 'salary',
        year: 1,
        month: 3,
        turn: 15,
      })
    ).toBe('salary:1:2');
  });

  test('inferBusinessKeyFromRow prefers stored businessKey', () => {
    expect(
      inferBusinessKeyFromRow({
        type: 'salary',
        businessKey: 'salary:9:9',
        year: 1,
        month: 1,
      })
    ).toBe('salary:9:9');
  });
});
