import {
  buildLedgerBusinessKey,
  inferBusinessKeyFromRow,
} from '../src/js/stores/ledgerBusinessKeys.js';
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
