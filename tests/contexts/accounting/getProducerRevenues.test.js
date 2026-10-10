import { describe, test, expect } from '@jest/globals';
import { GetProducerRevenues } from '../../../src/contexts/accounting/application/queries/GetProducerRevenues.js';

// Regression: the producer ranking (admin panel, Finances section) is read straight from the journal — goods and
// services sold to houses, summed HT per seller, houses themselves never ranked.
describe('GetProducerRevenues — HT sales to houses, per producer, largest first', () => {
  function query(entries, types) {
    return new GetProducerRevenues({
      getJournalEntries: async () => entries,
      getBuildingTypes: async () => new Map(types),
    });
  }

  test('sums goods and services sold to houses, excludes company-to-company trade', async () => {
    const entries = [
      { type: 'producer_revenue', year: 2, month: 3, accountBuildingId: 'farm', counterpartyBuildingId: 'house-1', amount: 50 },
      { type: 'service_sales', year: 2, month: 3, accountBuildingId: 'farm', counterpartyBuildingId: 'house-2', amount: 30 },
      // Trade between two companies: not a sale to a house, must not be counted.
      { type: 'producer_revenue', year: 2, month: 3, accountBuildingId: 'bakery', counterpartyBuildingId: 'farm', amount: 999 },
      { type: 'service_sales', year: 2, month: 3, accountBuildingId: 'bakery', counterpartyBuildingId: 'house-1', amount: 10 },
      // A different month: must not be counted.
      { type: 'producer_revenue', year: 2, month: 4, accountBuildingId: 'farm', counterpartyBuildingId: 'house-1', amount: 1000 },
    ];
    const types = [
      ['farm', 'Farm-Wheat'],
      ['bakery', 'Bakery'],
      ['house-1', 'House-Blue'],
      ['house-2', 'House-Red'],
    ];

    const ranking = await query(entries, types).execute(2, 2); // monthIndex 2 -> month 3

    expect(ranking).toEqual([
      { buildingId: 'farm', buildingType: 'Farm-Wheat', revenueHT: 80 },
      { buildingId: 'bakery', buildingType: 'Bakery', revenueHT: 10 },
    ]);
  });

  test('a building missing from the hamlet throws: its sales cannot be ranked without a name', async () => {
    const entries = [
      { type: 'producer_revenue', year: 1, month: 1, accountBuildingId: 'gone', counterpartyBuildingId: 'house-1', amount: 5 },
    ];
    await expect(query(entries, [['house-1', 'House-Blue']]).execute(1, 0)).rejects.toThrow(/gone/);
  });
});
