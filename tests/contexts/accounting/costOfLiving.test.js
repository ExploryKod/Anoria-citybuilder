import { describe, test, expect } from '@jest/globals';
import { costOfLivingOf } from '../../../src/contexts/accounting/domain/policies/CostOfLivingPolicy.js';

// The cost of living of a reference household's citizen: the cheapest good that serves each need, the services shared between the residents,
// and no price guessed for what nobody sells.
describe('costOfLivingOf — what a month costs a citizen', () => {
  test('a need is met by its cheapest good, a service is shared between the residents', () => {
    const cost = costOfLivingOf({
      needs: [
        { key: 'food', quantity: 1, unitPrices: [1.44, 0.9, 1.08] },
        { key: 'heat', quantity: 0.1, unitPrices: [1.8] },
      ],
      services: [{ key: 'doctor', unitPrices: [2.4, 3] }],
      householdSize: 12,
    });

    expect(cost.missing).toEqual([]);
    expect(cost.lines.map((line) => [line.key, line.amount])).toEqual([['food', 0.9], ['heat', 0.18], ['doctor', 0.2]]);
    expect(cost.total).toBeCloseTo(1.28, 2);
  });

  test('a need nobody sells has no price: the total is unknown and names it, nothing stands in', () => {
    const cost = costOfLivingOf({
      needs: [{ key: 'food', quantity: 1, unitPrices: [1] }, { key: 'light', quantity: 0.1, unitPrices: [] }],
      services: [],
      householdSize: 6,
    });

    expect(cost.total).toBeNull();
    expect(cost.missing).toEqual(['light']);
  });
});
