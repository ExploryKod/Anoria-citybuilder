import { describe, test, expect } from '@jest/globals';
import {
  computeLoanRate,
  computeLoanRatesByType,
  computeLoanInterestAmount,
} from '../../../src/contexts/accounting/domain/policies/LoanRatePolicy.js';

describe('LoanRatePolicy', () => {
  test('base rates by loan type', () => {
    expect(computeLoanRate({ loanType: 'bank', financialHealthStatus: 'healthy' })).toBe(5);
    expect(computeLoanRate({ loanType: 'commercial', financialHealthStatus: 'healthy' })).toBe(7);
  });

  test('critical health adds bank +5 and commercial +7', () => {
    expect(computeLoanRate({ loanType: 'bank', financialHealthStatus: 'critical' })).toBe(10);
    expect(computeLoanRate({ loanType: 'commercial', financialHealthStatus: 'critical' })).toBe(14);
  });

  test('warning and deficit share the same surcharge', () => {
    expect(computeLoanRate({ loanType: 'bank', financialHealthStatus: 'warning' })).toBe(7);
    expect(computeLoanRate({ loanType: 'commercial', financialHealthStatus: 'deficit' })).toBe(10);
  });

  test('computeLoanRatesByType returns both rates', () => {
    expect(computeLoanRatesByType('critical')).toEqual({ bank: 10, commercial: 14 });
  });

  test('computeLoanInterestAmount rounds percent of principal', () => {
    expect(computeLoanInterestAmount(1000, 5)).toBe(50);
  });
});
