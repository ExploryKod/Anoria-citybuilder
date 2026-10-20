import {
  buildLedgerBusinessKey,
  inferBusinessKeyFromRow,
  buildLoanInstallmentBusinessKey,
  buildInfoMovementBusinessKey,
  buildLoanCapitalBusinessKey,
  buildCapitalFundsBusinessKey,
  buildCommercialRouteBusinessKey,
} from '../src/contexts/accounting/domain/policies/LedgerBusinessKeys.js';
import { describe, test, expect } from '@jest/globals';

describe('ledgerBusinessKeys', () => {
  test('buildLedgerBusinessKey for monthly types', () => {
    expect(buildLedgerBusinessKey('salary', { year: 1, monthIndex: 2 }, 'h1')).toBe(
      'salary:h1:1:2'
    );
    expect(buildLedgerBusinessKey('payroll_tax', { year: 0, monthIndex: 11 }, 'h1')).toBe(
      'payroll_tax:h1:0:11'
    );
    expect(buildLedgerBusinessKey('maintenance', { year: 3, monthIndex: 0 }, 'h2')).toBe(
      'maintenance:h2:3:0'
    );
    // Two hamlets pay for the same month: two keys, not one.
    expect(buildLedgerBusinessKey('maintenance', { year: 3, monthIndex: 0 }, 'h1')).not.toBe(
      buildLedgerBusinessKey('maintenance', { year: 3, monthIndex: 0 }, 'h2')
    );
  });

  test('buildLedgerBusinessKey for citizen_tax is yearly', () => {
    expect(buildLedgerBusinessKey('citizen_tax', { year: 2, monthIndex: 10 }, 'h1')).toBe(
      'citizen_tax:h1:2'
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

  test('inferBusinessKeyFromRow from month/year fields', () => {
    expect(
      inferBusinessKeyFromRow({
        type: 'salary',
        hamletId: 'h1',
        year: 1,
        month: 3,
        turn: 15,
      })
    ).toBe('salary:h1:1:2');
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
