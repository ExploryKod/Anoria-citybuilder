import { describe, test, expect } from '@jest/globals';
import { RevalueMinimumWage } from '../../../src/contexts/accounting/application/services/RevalueMinimumWage.js';

// An indexed minimum wage follows the cost of living; a fixed or absent one is left alone; an unknown cost moves nothing.
describe('RevalueMinimumWage', () => {
  function service({ mode, minimumWage = 6, ratio = 1.5, cost }) {
    const written = [];
    const revalue = new RevalueMinimumWage({
      getSalarySettings: async () => ({ minimumWageMode: mode, minimumWage, minimumWageBasketRatio: ratio }),
      getCostOfLiving: async () => cost,
      setMinimumWage: async (amount) => written.push(amount),
    });
    return { revalue, written };
  }

  test('an indexed floor is revalued to its ratio of the cost of living', async () => {
    const { revalue, written } = service({ mode: 'indexed', cost: { total: 4.2, missing: [] } });

    expect(await revalue.execute()).toEqual({ revalued: true, from: 6, to: 6.3 });
    expect(written).toEqual([6.3]);
  });

  test('a fixed or absent floor is never touched', async () => {
    for (const mode of ['fixed', 'none']) {
      const { revalue, written } = service({ mode, cost: { total: 9, missing: [] } });

      expect(await revalue.execute()).toEqual({ revalued: false, reason: 'not-indexed' });
      expect(written).toEqual([]);
    }
  });

  test('with the cost of living unknown, the floor stays where it was', async () => {
    const { revalue, written } = service({ mode: 'indexed', cost: { total: null, missing: ['light'] } });

    expect(await revalue.execute()).toEqual({ revalued: false, reason: 'cost-unknown', missing: ['light'] });
    expect(written).toEqual([]);
  });
});
