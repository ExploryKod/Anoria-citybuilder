/**
 * An écriture is booked with its two or more legs, which must balance, in the chart of accounts its account follows: the PCG for a company or a house,
 * M57 for the city. Real catalog and policy.
 */
import { describe, test, expect } from '@jest/globals';
import { assertBalanced, entryLegsOf } from '../../../src/contexts/accounting/domain/policies/EntryLegsPolicy.js';

describe('entryLegsOf — the legs of an écriture', () => {
  test('a company books its sale in the PCG: the bank debited, the sales credited', () => {
    expect(entryLegsOf({ type: 'producer_revenue', amount: 12.5, accountBuildingId: 'farm-1' })).toEqual({
      journal: 'BQ',
      legs: [{ account: '512', debit: 1250, credit: 0 }, { account: '707', debit: 0, credit: 1250 }],
    });
  });

  test('the city books the same kind of flow in M57: a tax is a product of class 7, not a debt to the taxpayer', () => {
    const { legs } = entryLegsOf({ type: 'citizen_tax', amount: 3, accountBuildingId: null });
    expect(legs).toEqual([{ account: '512', debit: 300, credit: 0 }, { account: '73111', debit: 0, credit: 300 }]);
  });

  test('a company that writes a type only the city books throws, naming it', () => {
    expect(() => entryLegsOf({ type: 'citizen_tax', amount: 3, accountBuildingId: 'farm-1' })).toThrow(/citizen_tax.*pcg/);
  });

  test('an opération diverse with no charge or product (a contribution in kind) is booked in the OD journal, not refused', () => {
    expect(entryLegsOf({ type: 'od_asset_contribution', amount: 120, accountBuildingId: 'sci' })).toEqual({
      journal: 'OD',
      legs: [{ account: '213', debit: 12000, credit: 0 }, { account: '101', debit: 0, credit: 12000 }],
    });
  });

  test('an écriture that does not balance is refused', () => {
    expect(() => assertBalanced([{ account: '607', debit: 1000, credit: 0 }, { account: '512', debit: 0, credit: 900 }], 'producer_purchase')).toThrow(/does not balance/);
    expect(() => entryLegsOf({ type: 'salary', amount: 10, accountBuildingId: 'farm-1', legs: [{ account: '6411', debit: 1000, credit: 0 }, { account: '421', debit: 0, credit: 900 }] })).toThrow();
  });

  test('an écriture with more than two legs brings its own, and they must add up to its amount', () => {
    const payroll = [
      { account: '6411', debit: 1000, credit: 0 },
      { account: '645', debit: 400, credit: 0 },
      { account: '421', debit: 0, credit: 800 },
      { account: '431', debit: 0, credit: 600 },
    ];
    expect(entryLegsOf({ type: 'salary', amount: 14, accountBuildingId: 'farm-1', legs: payroll }).legs).toHaveLength(4);
    expect(() => entryLegsOf({ type: 'salary', amount: 13, accountBuildingId: 'farm-1', legs: payroll })).toThrow(/debits add up/);
  });
});
