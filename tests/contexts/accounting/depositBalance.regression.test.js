import { describe, test, expect } from '@jest/globals';
import { RecordHouseholdDeposit } from '../../../src/contexts/accounting/application/services/RecordHouseholdDeposit.js';
import { RecordHouseholdWithdrawal } from '../../../src/contexts/accounting/application/services/RecordHouseholdWithdrawal.js';
import { depositBalanceOf } from '../../../src/contexts/accounting/domain/policies/DepositBalancePolicy.js';

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

    const withdrawal = new RecordHouseholdWithdrawal({
      recordLedgerEntry,
      depositBalanceOf: async (houseId, bankId) => depositBalanceOf(journal, houseId, bankId),
      fundsOf: async () => 1000, // the bank has plenty of cash
    });

    const tooMuch = await withdrawal.execute({ turn: 2, houseId: 'house-1', bankId: 'bank-1', amount: 400, description: 'Retrait' });
    expect(tooMuch).toEqual({ recorded: false, skipped: true, reason: 'insufficient_deposit' });

    const ok = await withdrawal.execute({ turn: 2, houseId: 'house-1', bankId: 'bank-1', amount: 300, description: 'Retrait' });
    expect(ok).toEqual({ recorded: true, skipped: false });

    expect(depositBalanceOf(journal, 'house-1', 'bank-1')).toBe(0);
  });

  test('refuses a withdrawal the bank itself cannot cover', async () => {
    const { journal, recordLedgerEntry } = buildJournal();
    const deposit = new RecordHouseholdDeposit({ recordLedgerEntry, fundsOf: async () => 500 });
    await deposit.execute({ turn: 1, houseId: 'house-1', bankId: 'bank-1', amount: 300, description: 'Dépôt' });

    const withdrawal = new RecordHouseholdWithdrawal({
      recordLedgerEntry,
      depositBalanceOf: async (houseId, bankId) => depositBalanceOf(journal, houseId, bankId),
      fundsOf: async () => 50, // the bank lent most of its cash out
    });

    const result = await withdrawal.execute({ turn: 2, houseId: 'house-1', bankId: 'bank-1', amount: 300, description: 'Retrait' });
    expect(result).toEqual({ recorded: false, skipped: true, reason: 'bank_insufficient_funds' });
  });
});
