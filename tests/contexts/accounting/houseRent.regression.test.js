import { describe, test, expect } from '@jest/globals';
import { SettleHouseRents } from '../../../src/contexts/accounting/application/services/SettleHouseRents.js';
import { rentDebtsOf, rentOfMonth } from '../../../src/contexts/accounting/domain/policies/RentPolicy.js';

// Every house but the owner's pays a rent to the owner each month; what it cannot pay stays a debt, derived from the journal, and is paid when it can.
describe('the rent of a month', () => {
  test('a house pays what it owes as far as its money goes, and the rest is its debt', () => {
    expect(rentOfMonth({ rent: 2, debt: 0, funds: 10 })).toEqual({ due: 2, paid: 2, debtAfter: 0 });
    expect(rentOfMonth({ rent: 2, debt: 0, funds: 0 })).toEqual({ due: 2, paid: 0, debtAfter: 2 });
    expect(rentOfMonth({ rent: 2, debt: 3, funds: 4 })).toEqual({ due: 2, paid: 4, debtAfter: 1 });
  });
});

function settleMonths(months) {
  const journal = [];
  const service = new SettleHouseRents({
    getTimeInfo: () => ({ year: 1, monthIndex: 0, month: 'Janvier' }),
    getRentalHouses: async () => ({ ownerId: 'mayor', ownerName: 'Administrateurs', tenants: [{ id: 'tenant', name: 'Artisans' }] }),
    getRentPerHouse: async () => 2,
    getJournalEntries: async () => journal,
    fundsOf: async () => months.shift(),
    recordLedgerEntry: async (line) => {
      journal.push(line);
      return { recorded: true };
    },
  });
  return { service, journal };
}

describe('the settlement of the rents', () => {
  test('a rent the house cannot pay falls due and stays a debt; the next month it pays what it owes, the owner receiving the same amount', async () => {
    const { service, journal } = settleMonths([0, 10]);

    await service.execute({ time: 5, deliveredTime: 4 });
    expect(journal.map((line) => line.type)).toEqual(['info_rent_due']);
    expect(rentDebtsOf(journal).get('tenant')).toBe(2);

    await service.execute({ time: 10, deliveredTime: 9 });
    const paid = journal.find((line) => line.type === 'rent_paid');
    const received = journal.find((line) => line.type === 'rent_received');
    expect(paid).toMatchObject({ amount: 4, accountBuildingId: 'tenant', accountKind: 'particulier', counterpartyBuildingId: 'mayor' });
    expect(received).toMatchObject({ amount: 4, accountBuildingId: 'mayor', accountKind: 'entreprise', counterpartyBuildingId: 'tenant' });
    expect(rentDebtsOf(journal).get('tenant')).toBe(0);
  });

  test('with no owner, no rent falls due', async () => {
    const journal = [];
    const service = new SettleHouseRents({
      getTimeInfo: () => ({ year: 1, monthIndex: 0, month: 'Janvier' }),
      getRentalHouses: async () => null,
      getRentPerHouse: async () => 2,
      getJournalEntries: async () => journal,
      fundsOf: async () => 10,
      recordLedgerEntry: async (line) => journal.push(line),
    });
    await service.execute({ time: 5, deliveredTime: 4 });
    expect(journal).toEqual([]);
  });
});
