import { describe, test, expect } from '@jest/globals';
import { RecordHouseholdDeposit } from '../../../src/contexts/accounting/application/services/RecordHouseholdDeposit.js';
import { RecordHouseholdWithdrawal } from '../../../src/contexts/accounting/application/services/RecordHouseholdWithdrawal.js';
import { SettleBankDepositInterest } from '../../../src/contexts/accounting/application/services/SettleBankDepositInterest.js';
import { DEPOSIT_INTEREST_TYPES, depositBalanceOf, depositInterestsOf } from '../../../src/contexts/accounting/domain/policies/DepositBalancePolicy.js';
import { booked } from '../../helpers/booked.js';

// Regression: the interest was paid into the house's cash (512) and counted in its savings too, so the house could take it twice.
describe('the interest on savings is added to the savings, once', () => {
  test('it moves no cash: the house\'s claim (275) and the bank\'s debt (165) both grow by it, and stay equal', async () => {
    const journal = [
      booked({ type: 'deposit', amount: 1200, year: 0, month: 1, accountBuildingId: 'house-1', accountKind: 'particulier', counterpartyBuildingId: 'bank-1' }),
      booked({ type: 'deposit_received', amount: 1200, year: 0, month: 1, accountBuildingId: 'bank-1', counterpartyBuildingId: 'house-1' }),
    ];
    const settle = new SettleBankDepositInterest({
      getTimeInfo: () => ({ year: 0, monthIndex: 11 }),
      listBuildings: async () => [{ id: 'house-1', type: 'House-Blue' }, { id: 'bank-1', type: 'Bank' }],
      listDepositInterests: async (year, annualRate) => depositInterestsOf(journal, { year, annualRate }),
      getDepositInterestRate: () => 0.12,
      getBuildingDisplayName: (type) => type,
      recordLedgerEntry: async (line) => {
        journal.push(booked({ ...line, year: 0, month: 12 }));
        return { recorded: true };
      },
    });
    await settle.execute({ deliveredTime: 11 });

    const net = (accountBuildingId, compte) => journal
      .filter((line) => line.accountBuildingId === accountBuildingId)
      .flatMap((line) => line.legs)
      .filter((leg) => leg.account === compte)
      .reduce((sum, leg) => sum + leg.debit - leg.credit, 0);
    // 11 months at 1200 × 12 % / 12 = 132 of interest, on top of the 1200 deposited.
    expect(depositBalanceOf(journal, 'house-1', 'bank-1')).toBe(1332);
    expect(net('house-1', '275')).toBe(133200);
    expect(net('bank-1', '165')).toBe(-133200);
    // The cash moved only by the deposit itself.
    expect(net('house-1', '512')).toBe(-120000);
    expect(net('bank-1', '512')).toBe(120000);
  });
});

// Savings interest is credited once a year, on the lowest balance each month held (a twelfth of the annual rate per month).
describe('the yearly interest on savings', () => {
  const line = (type, amount, year, month) => ({ type, amount, year, month, accountBuildingId: 'house-1', counterpartyBuildingId: 'bank-1' });

  test('a balance held all year earns the annual rate, and a withdrawal within a month earns nothing for that month', () => {
    const held = [line('deposit', 1200, 0, 1)];
    // Deposited in month 1 (earns from the month it opens at 0, so month 1 earns on its lowest: 0), then 11 full months at 1200 × 12 % / 12.
    expect(depositInterestsOf(held, { year: 0, annualRate: 0.12 })).toEqual([{ houseId: 'house-1', bankId: 'bank-1', interest: 132 }]);
    const withdrawn = [...held, line('withdrawal', 1200, 0, 6)];
    // Months 2 to 5 earn; month 6 closes at 0, so its lowest balance is 0.
    expect(depositInterestsOf(withdrawn, { year: 0, annualRate: 0.12 })).toEqual([{ houseId: 'house-1', bankId: 'bank-1', interest: 48 }]);
  });

  test('the interest of an earlier year is part of the balance of the next one', () => {
    const journal = [line('deposit', 1000, 0, 1), line(DEPOSIT_INTEREST_TYPES.house, 100, 0, 12)];
    expect(depositInterestsOf(journal, { year: 1, annualRate: 0.12 })).toEqual([{ houseId: 'house-1', bankId: 'bank-1', interest: 132 }]);
  });
});

// Regression: a deposit must never create or destroy money — the house's own line and the bank's mirror carry
// the exact same amount, and the balance DepositBalancePolicy derives from them is exactly what was moved, never
// a stored, independently-drifting figure (the same "one derivation" discipline GetTreasurySnapshot follows).

function buildJournal() {
  const journal = [];
  const recordLedgerEntry = async (line) => {
    journal.push(line);
    return { recorded: true };
  };
  return { journal, recordLedgerEntry };
}

describe('a deposit moves money, it never invents or loses it', () => {
  test('depositing reduces nothing but the house\'s own cash, and credits the bank by the same amount', async () => {
    const { journal, recordLedgerEntry } = buildJournal();
    const deposit = new RecordHouseholdDeposit({ recordLedgerEntry, fundsOf: async () => 500 });

    const result = await deposit.execute({ turn: 1, houseId: 'house-1', bankId: 'bank-1', amount: 200, description: 'Dépôt' });
    expect(result).toEqual({ recorded: true, skipped: false });

    const houseLine = journal.find((line) => line.type === 'deposit');
    const bankLine = journal.find((line) => line.type === 'deposit_received');
    expect(houseLine.amount).toBe(200);
    expect(bankLine.amount).toBe(200);
    expect(houseLine.accountBuildingId).toBe('house-1');
    expect(bankLine.accountBuildingId).toBe('bank-1');

    expect(depositBalanceOf(journal, 'house-1', 'bank-1')).toBe(200);
  });

  test('refuses a deposit larger than the house actually has', async () => {
    const { journal, recordLedgerEntry } = buildJournal();
    const deposit = new RecordHouseholdDeposit({ recordLedgerEntry, fundsOf: async () => 50 });

    const result = await deposit.execute({ turn: 1, houseId: 'house-1', bankId: 'bank-1', amount: 200, description: 'Dépôt' });
    expect(result).toEqual({ recorded: false, skipped: true, reason: 'insufficient_funds' });
    expect(journal).toHaveLength(0);
  });

  test('a withdrawal exactly reverses a deposit, and refuses more than was ever put in', async () => {
    const { journal, recordLedgerEntry } = buildJournal();
    const deposit = new RecordHouseholdDeposit({ recordLedgerEntry, fundsOf: async () => 500 });
    await deposit.execute({ turn: 1, houseId: 'house-1', bankId: 'bank-1', amount: 300, description: 'Dépôt' });

    // A withdrawal moves money from the house's savings to its current account at the same bank: it never needs the bank's cash.
    const withdrawal = new RecordHouseholdWithdrawal({
      recordLedgerEntry,
      depositBalanceOf: async (houseId, bankId) => depositBalanceOf(journal, houseId, bankId),
    });

    const tooMuch = await withdrawal.execute({ turn: 2, houseId: 'house-1', bankId: 'bank-1', amount: 400, description: 'Retrait' });
    expect(tooMuch).toEqual({ recorded: false, skipped: true, reason: 'insufficient_deposit' });

    const ok = await withdrawal.execute({ turn: 2, houseId: 'house-1', bankId: 'bank-1', amount: 300, description: 'Retrait' });
    expect(ok).toEqual({ recorded: true, skipped: false });

    expect(depositBalanceOf(journal, 'house-1', 'bank-1')).toBe(0);
  });
});
