import { describe, test, expect } from '@jest/globals';
import {
  canImportProduct,
  canExportProduct,
} from '../../../src/contexts/commerce/domain/policies/ProductTradePolicy.js';

describe('ProductTradePolicy', () => {
  test('canImportProduct respects yearly max and stockpiling flag', () => {
    expect(
      canImportProduct({
        productConfig: { buyingMax: 10, stockpiling: false },
        quantity: 3,
        currentYearlyTotal: 5,
      })
    ).toBe(true);

    expect(
      canImportProduct({
        productConfig: { buyingMax: 10, stockpiling: false },
        quantity: 6,
        currentYearlyTotal: 5,
      })
    ).toBe(false);

    expect(
      canImportProduct({
        productConfig: { buyingMax: 10, stockpiling: true },
        quantity: 1,
        currentYearlyTotal: 0,
      })
    ).toBe(false);
  });

  test('canExportProduct respects stock and yearly max', () => {
    expect(
      canExportProduct({
        productConfig: { sellingMax: 10, stockpiling: false },
        quantity: 2,
        currentYearlyTotal: 0,
        availableStock: 5,
        productId: 'carrot',
      })
    ).toBe(true);

    expect(
      canExportProduct({
        productConfig: { sellingMax: 10, stockpiling: false },
        quantity: 2,
        currentYearlyTotal: 0,
        availableStock: 1,
        productId: 'carrot',
      })
    ).toBe(false);
  });
});
