import { describe, test, expect } from '@jest/globals';
import { postingsOf, accountLedgerOf, trialBalanceOf } from '../../../src/contexts/accounting/domain/policies/AccountLedgerPolicy.js';
import { buildYearClosingLine } from '../../../src/contexts/accounting/domain/policies/YearClosingPolicy.js';

const line = (type, amount, extra = {}) => ({ type, amount, turn: 1, year: 0, month: 1, accountBuildingId: 'b1', accountKind: null, ...extra });

describe('the grand livre and the balance of an account (derived from its journal)', () => {
  const entries = [line('producer_purchase', 100), line('producer_revenue', 70), line('deposit', 20)];

  test('a line is two legs of the same amount: money in debits the bank, money out credits it', () => {
    expect(postingsOf(line('producer_revenue', 70), { salesNature: 'merchandise' })).toEqual([
      { account: '512', debit: 7000, credit: 0 },
      { account: '707', debit: 0, credit: 7000 },
    ]);
    expect(postingsOf(line('producer_purchase', 100))).toEqual([
      { account: '607', debit: 10000, credit: 0 },
      { account: '512', debit: 0, credit: 10000 },
    ]);
  });

  test('a deposit names its other leg, the balance balances and the bank is the cash of the account', () => {
    const balance = trialBalanceOf(entries, 'b1', { salesNature: 'merchandise' });
    expect(balance.totals.debit).toBe(balance.totals.credit);
    expect(balance.accounts.find((account) => account.account === '275').debitBalance).toBe(20);
    const bank = accountLedgerOf(entries, 'b1', { salesNature: 'merchandise' }).find((account) => account.account === '512');
    expect(bank.balance).toBe(-50);
  });

  test('a purged year posts the balances it carried, and the balance still balances with the bank unchanged', () => {
    const closing = buildYearClosingLine({ year: 0, hamletId: 'h', accountBuildingId: 'b1', accountKind: null, lines: entries, getTimeInfo: () => ({ monthIndex: 0 }) });
    const balance = trialBalanceOf([closing], 'b1', { salesNature: 'merchandise' });
    expect(balance.totals.debit).toBe(balance.totals.credit);
    expect(balance.accounts.find((account) => account.account === '512').creditBalance).toBe(50);
    expect(balance.accounts.find((account) => account.account === '12')).toBeDefined();
  });

  test('a money line whose type has no account is an error, never skipped', () => {
    expect(() => trialBalanceOf([line('no_such_type', 5)], 'b1')).toThrow();
  });
});
