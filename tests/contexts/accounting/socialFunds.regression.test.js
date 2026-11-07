import { describe, test, expect } from '@jest/globals';
import { unemploymentAllocationOf } from '../../../src/contexts/accounting/domain/policies/SocialAllocationPolicy.js';
import { CloseMonthAccounts } from '../../../src/contexts/accounting/application/services/CloseMonthAccounts.js';
import { legsOfType, odLegsOf, planOfAccount } from '../../../src/shared/accounting-catalog/PcgJournalCatalog.js';
import { booked } from '../../helpers/booked.js';

// The city's social security has two funds: contributions come in on the health fund (431), the unemployment fund (4378) is fed by a monthly allocation of a
// third of them, and each benefit is paid out of its own fund.
const received = (amount, month = 6) => booked({ type: 'social_contribution', amount, accountBuildingId: null, year: 1, month });

describe('social funds — the health fund and the unemployment fund', () => {
  test('each benefit comes out of its own fund', () => {
    expect(legsOfType('unemployment_benefit', planOfAccount(null)).debit).toBe('4378');
    expect(legsOfType('sickness_benefit', planOfAccount(null)).debit).toBe('431');
    expect(odLegsOf('od_social_allocation')).toMatchObject({ debit: '431', credit: '4378' });
  });

  test('the unemployment fund is allocated a third of what the month credited to the health fund, on the city\'s account only', () => {
    const entries = [received(90), received(30), received(500, 7), booked({ type: 'od_payable_contribution', amount: 700, accountBuildingId: 'company-1', accountKind: null, year: 1, month: 6 })];

    expect(unemploymentAllocationOf(entries, { year: 1, month: 6 }, 1 / 3)).toBe(4000); // (90 + 30) × 100 / 3 centimes
  });

  test('closing the month writes the allocation once, between the two funds, and never again', async () => {
    const written = [];
    const entries = [received(90)];
    const service = new CloseMonthAccounts({
      getTimeInfo: () => ({ year: 1, monthIndex: 5, month: 'Juin' }),
      listStockAccounts: async () => [],
      valueStock: async () => [],
      getOwnerHoldings: async () => null,
      getJournalEntries: async () => entries,
      recordLedgerEntry: async (line) => {
        if (written.some((previous) => previous.businessKey === line.businessKey)) return { recorded: false, reason: 'duplicate_business_key' };
        written.push(line);
        return { recorded: true };
      },
    });

    await service.execute({ time: 10, deliveredTime: 9 });
    await service.execute({ time: 10, deliveredTime: 9 });

    expect(written).toHaveLength(1);
    expect(written[0]).toMatchObject({ type: 'od_social_allocation', amount: 30, accountBuildingId: null });
  });
});
