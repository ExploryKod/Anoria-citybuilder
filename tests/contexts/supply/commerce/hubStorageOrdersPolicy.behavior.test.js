import { describe, test, expect } from '@jest/globals';
import {
  adjustHubStoragePercent,
  canCreditHubProduct,
  cycleHubStorageMode,
  getHubProductMaxUnits,
  getHubProductRemainingInbound,
  normalizeHubStorageOrders,
  tryAdjustHubStoragePercent,
} from '../../../../src/contexts/supply/domain/policies/HubStorageOrdersPolicy.js';

describe('HubStorageOrdersPolicy', () => {
  const productIds = ['wood', 'furniture', 'figs'];

  test('maxPercent sets per-good fill ceiling', () => {
    const orders = normalizeHubStorageOrders(
      {
        wood: { mode: 'accept', maxPercent: 30 },
        furniture: { mode: 'accept', maxPercent: 30 },
        figs: { mode: 'accept', maxPercent: 30 },
      },
      productIds
    );
    const stocks = { wood: 10, furniture: 0, figs: 0 };

    expect(getHubProductMaxUnits(orders.wood, 60)).toBe(18);
    expect(
      getHubProductRemainingInbound({
        productId: 'wood',
        productIds,
        orders,
        stocks,
        totalCapacity: 60,
      })
    ).toBe(8);
  });

  test('free warehouse space is shared up to each product max', () => {
    const orders = normalizeHubStorageOrders(
      {
        wood: { mode: 'accept', maxPercent: 50 },
        furniture: { mode: 'accept', maxPercent: 50 },
        figs: { mode: 'accept', maxPercent: 100 },
      },
      productIds
    );
    const stocks = { wood: 30, furniture: 0, figs: 0 };

    expect(
      getHubProductRemainingInbound({
        productId: 'furniture',
        productIds,
        orders,
        stocks,
        totalCapacity: 60,
      })
    ).toBe(30);
  });

  test('default max is 100% of warehouse capacity', () => {
    const orders = normalizeHubStorageOrders({}, productIds);
    expect(orders.wood).toEqual({ mode: 'accept', maxPercent: 100 });
    expect(getHubProductMaxUnits(orders.wood, 20)).toBe(20);
  });

  test('refusing incoming blocks credits', () => {
    const orders = normalizeHubStorageOrders(
      { figs: { mode: 'refuse', maxPercent: 100 } },
      productIds
    );
    expect(
      canCreditHubProduct({
        productId: 'figs',
        productIds,
        orders,
        stocks: { wood: 0, furniture: 0, figs: 0 },
        totalCapacity: 60,
        quantity: 1,
      })
    ).toBe(false);
  });

  test('mode cycles accept → refuse → fetch', () => {
    expect(cycleHubStorageMode('accept')).toBe('refuse');
    expect(cycleHubStorageMode('refuse')).toBe('fetch');
    expect(cycleHubStorageMode('fetch')).toBe('accept');
  });

  test('adjustHubStoragePercent steps by 10', () => {
    expect(adjustHubStoragePercent({ mode: 'accept', maxPercent: 50 }, 1)).toEqual({
      mode: 'accept',
      maxPercent: 60,
    });
    expect(adjustHubStoragePercent({ mode: 'accept', maxPercent: 100 }, 1)).toEqual({
      mode: 'accept',
      maxPercent: 100,
    });
    expect(adjustHubStoragePercent({ mode: 'accept', maxPercent: 10 }, -1)).toEqual({
      mode: 'accept',
      maxPercent: 10,
    });
  });

  test('tryAdjust blocks percent reduction when stock exceeds new max', () => {
    const result = tryAdjustHubStoragePercent({
      order: { mode: 'accept', maxPercent: 100 },
      deltaSteps: -1,
      currentAmount: 60,
      totalCapacity: 60,
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe('stock_exceeds_new_max');
    expect(result.newPercent).toBe(90);
    expect(result.newMaxCap).toBe(54);
  });

  test('legacy shareNum/shareDen migrate to maxPercent', () => {
    const orders = normalizeHubStorageOrders(
      { wood: { mode: 'accept', shareNum: 1, shareDen: 2 } },
      productIds
    );
    expect(orders.wood.maxPercent).toBe(50);
  });
});
