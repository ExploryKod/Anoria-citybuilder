import { describe, test, expect } from '@jest/globals';
import { distributeRoundRobin } from '../../../src/contexts/supply/application/services/RoundRobinDistribution.js';

// A house buys what its money allows; the rest of its need is unpaid when the market still had the good, and a shortage when it did not.
function run({ source, funds, need, price, priceOf = () => price }) {
  const consumers = { house: { id: 'house', stocks: {} } };
  const repository = {
    findById: async (id) => consumers[id],
    saveStocks: async () => {},
  };
  return distributeRoundRobin({
    categories: ['food'],
    sourceStock: { food: source },
    consumerIds: ['house'],
    isEligible: () => true,
    repository,
    createStock: (raw) => ({ ...raw }),
    takeCategory: (stock, category, amount) => ({ ...stock, [category]: stock[category] - amount }),
    addCategory: (stock, category, amount) => ({ ...stock, [category]: (stock[category] ?? 0) + amount }),
    getAmount: (stock, category) => stock[category] ?? 0,
    getCap: () => need,
    money: { fundsOf: async () => funds, priceOf },
  });
}

describe('money gate on the distribution — a house buys what it can pay, partially if need be', () => {
  test('with 2 € for goods at 1 € each, a house needing 5 buys 2 and its 3 missing units are unpaid', async () => {
    const outcome = await run({ source: 10, funds: 2, need: 5, price: 1 });

    expect(outcome.transfers).toHaveLength(2);
    expect(outcome.unmet).toEqual([{ consumerId: 'house', cap: 5, taken: 2, unpaidUnits: 3, shortageUnits: 0 }]);
  });

  test('with money to spare and only 3 units in the market, the 2 missing units are a shortage, not unpaid', async () => {
    const outcome = await run({ source: 3, funds: Infinity, need: 5, price: 1 });

    expect(outcome.transfers).toHaveLength(3);
    expect(outcome.unmet).toEqual([{ consumerId: 'house', cap: 5, taken: 3, unpaidUnits: 0, shortageUnits: 2 }]);
  });

  test('a house pays each unit at its own price: the oldest units, sold first, cost less, so a poor house can still buy them', async () => {
    // Five units: the two oldest are on sale at 0.4 €, the three fresh ones cost 1 €.
    const priceOf = (_category, nth) => (nth < 2 ? 0.4 : 1);
    const outcome = await run({ source: 5, funds: 1, need: 5, priceOf });

    expect(outcome.transfers.map((transfer) => transfer.unitPrice)).toEqual([0.4, 0.4]);
    // 1 € buys the two sold-off units (0.8 €), and the 0.2 € left cannot buy a fresh one: the rest is unpaid, not a shortage.
    expect(outcome.unmet).toEqual([{ consumerId: 'house', cap: 5, taken: 2, unpaidUnits: 3, shortageUnits: 0 }]);
  });
});
