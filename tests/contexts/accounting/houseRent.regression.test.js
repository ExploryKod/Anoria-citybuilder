import { describe, test, expect } from '@jest/globals';
import { SettleHouseRents } from '../../../src/contexts/accounting/application/services/SettleHouseRents.js';
import { rentDebtsOf, rentOfMonth, rentQuoteOf } from '../../../src/contexts/accounting/domain/policies/RentPolicy.js';

// The owner deduces a rent that covers the upkeep it bears; the hamlet's rent control caps it, and what the cap leaves uncovered is the owner's loss.
describe('the rent the owner asks', () => {
  test('without control, the rent covers the upkeep left after the subsidy, shared among the paying houses and rounded up to the centime', () => {
    expect(rentQuoteOf({ upkeepToCover: 12, tenants: 3, margin: 0, cap: null })).toEqual({ breakEven: 4, rent: 4, capped: false, monthlyLoss: 0 });
    expect(rentQuoteOf({ upkeepToCover: 10, tenants: 3, margin: 0, cap: null }).rent).toBe(3.34);
    expect(rentQuoteOf({ upkeepToCover: 12, tenants: 3, margin: 0.5, cap: null }).rent).toBe(6);
  });

  test('a vacant house raises the rent of the others, a full subsidy lowers it to nothing', () => {
    expect(rentQuoteOf({ upkeepToCover: 12, tenants: 2, margin: 0, cap: null }).rent).toBe(6);
    expect(rentQuoteOf({ upkeepToCover: 0, tenants: 3, margin: 0, cap: null }).rent).toBe(0);
  });

  test('a cap under the break-even rent is the rent asked, and the gap is the owner\'s monthly loss', () => {
    expect(rentQuoteOf({ upkeepToCover: 12, tenants: 3, margin: 0, cap: 3 })).toEqual({ breakEven: 4, rent: 3, capped: true, monthlyLoss: 3 });
    expect(rentQuoteOf({ upkeepToCover: 12, tenants: 3, margin: 0, cap: 5 })).toMatchObject({ rent: 4, capped: false, monthlyLoss: 0 });
  });
});

// Every house pays a rent to the owner each month; what it cannot pay stays a debt, derived from the journal, and is paid when it can.
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
    getRentalHouses: async () => ({ ownerId: 'mayor', ownerType: 'House-Mayor', ownerName: 'Administrateurs', tenants: [{ id: 'tenant', name: 'Artisans' }] }),
    getRentQuote: async () => ({ rent: 2 }),
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
    expect(received).toMatchObject({ amount: 4, accountBuildingId: 'mayor', accountKind: 'entreprise:sci', counterpartyBuildingId: 'tenant' });
    expect(rentDebtsOf(journal).get('tenant')).toBe(0);
  });

  test('with no owner, no rent falls due', async () => {
    const journal = [];
    const service = new SettleHouseRents({
      getTimeInfo: () => ({ year: 1, monthIndex: 0, month: 'Janvier' }),
      getRentalHouses: async () => null,
      getRentQuote: async () => ({ rent: 2 }),
      getJournalEntries: async () => journal,
      fundsOf: async () => 10,
      recordLedgerEntry: async (line) => journal.push(line),
    });
    await service.execute({ time: 5, deliveredTime: 4 });
    expect(journal).toEqual([]);
  });
});
