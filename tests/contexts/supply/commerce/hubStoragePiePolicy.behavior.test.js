import { describe, test, expect } from '@jest/globals';
import { buildHubStoragePieSegments } from '../../../../src/contexts/supply/domain/policies/HubStoragePiePolicy.js';
import {
  getHubProductRemainingInbound,
  normalizeHubStorageOrders,
  tryAdjustHubStoragePercent,
} from '../../../../src/contexts/supply/domain/policies/HubStorageOrdersPolicy.js';

describe('HubStoragePiePolicy', () => {
  test('full wood stock fills the whole pie', () => {
    const lines = [
      {
        productId: 'wood',
        emoji: '🪵',
        label: 'Bois',
        amount: 60,
        maxCap: 60,
        maxPercent: 100,
        remainingInbound: 0,
      },
      {
        productId: 'furniture',
        emoji: '🪑',
        label: 'Meubles',
        amount: 0,
        maxCap: 60,
        maxPercent: 100,
        remainingInbound: 0,
      },
      {
        productId: 'figs',
        emoji: '🍇',
        label: 'Figues',
        amount: 0,
        maxCap: 60,
        maxPercent: 100,
        remainingInbound: 0,
      },
    ];

    const segments = buildHubStoragePieSegments({ lines, totalCapacity: 60 });
    const wood = segments.find((s) => s.productId === 'wood');
    const furniture = segments.find((s) => s.productId === 'furniture');

    expect(wood.emoji).toBe('🪵');
    expect(wood.label).toBe('Bois');
    expect(wood.darkAngle).toBe(360);
    expect(furniture.darkAngle).toBe(0);
    expect(segments.some((s) => s.kind === 'free')).toBe(false);
  });

  test('free space is a contested grey wedge, not split among products', () => {
    const lines = [
      {
        productId: 'wood',
        emoji: '🪵',
        label: 'Bois',
        amount: 0,
        maxCap: 60,
        maxPercent: 100,
        remainingInbound: 60,
      },
      {
        productId: 'furniture',
        emoji: '🪑',
        label: 'Meubles',
        amount: 0,
        maxCap: 60,
        maxPercent: 100,
        remainingInbound: 60,
      },
    ];

    const segments = buildHubStoragePieSegments({ lines, totalCapacity: 60 });
    const free = segments.find((s) => s.kind === 'free');
    expect(free).toBeDefined();
    expect(free.idleAngle).toBe(360);
    expect(segments.filter((s) => s.kind === 'product').every((s) => s.paleAngle === 0)).toBe(true);
  });
});

describe('first-come overlapping ceilings', () => {
  const productIds = ['wood', 'furniture', 'figs'];

  test('each overlapping 100% product can claim the same free space until it is taken', () => {
    const orders = normalizeHubStorageOrders(
      {
        wood: { mode: 'accept', maxPercent: 100 },
        furniture: { mode: 'accept', maxPercent: 100 },
        figs: { mode: 'accept', maxPercent: 100 },
      },
      productIds
    );
    const empty = { wood: 0, furniture: 0, figs: 0 };

    expect(
      getHubProductRemainingInbound({
        productId: 'wood',
        productIds,
        orders,
        stocks: empty,
        totalCapacity: 60,
      })
    ).toBe(60);
    expect(
      getHubProductRemainingInbound({
        productId: 'furniture',
        productIds,
        orders,
        stocks: empty,
        totalCapacity: 60,
      })
    ).toBe(60);

    const afterWood = { wood: 40, furniture: 0, figs: 0 };
    expect(
      getHubProductRemainingInbound({
        productId: 'furniture',
        productIds,
        orders,
        stocks: afterWood,
        totalCapacity: 60,
      })
    ).toBe(20);
    expect(
      getHubProductRemainingInbound({
        productId: 'wood',
        productIds,
        orders,
        stocks: afterWood,
        totalCapacity: 60,
      })
    ).toBe(20);
  });
});

describe('tryAdjustHubStoragePercent', () => {
  test('blocks percent reduction when stock exceeds new max', () => {
    const result = tryAdjustHubStoragePercent({
      order: { mode: 'accept', maxPercent: 100 },
      deltaSteps: -5,
      currentAmount: 30,
      totalCapacity: 40,
    });

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('stock_exceeds_new_max');
    expect(result.newPercent).toBe(50);
    expect(result.newMaxCap).toBe(20);
  });

  test('allows percent increase', () => {
    const result = tryAdjustHubStoragePercent({
      order: { mode: 'accept', maxPercent: 50 },
      deltaSteps: 1,
      currentAmount: 20,
      totalCapacity: 60,
    });

    expect(result.ok).toBe(true);
    expect(result.newPercent).toBe(60);
  });
});
