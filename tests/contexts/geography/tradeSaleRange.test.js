/**
 * Regression: a merchant's sale price is drawn in the range the catalog declares around the good's
 * baseMultiplier, and an event's bias moves that range — it used to be the relation's fixed multiplier,
 * reset every month, so nothing could move a sale's price.
 */

import { describe, test, expect } from '@jest/globals';
import { RunMonthlyCityTradeCycle } from '../../../src/contexts/geography/application/workflows/RunMonthlyCityTradeCycle.js';
import { getTradeCatalogEntry } from '../../../src/shared/trade-catalog/TradeCatalog.js';
import { getResourceBaseValue } from '../../../src/shared/resource-catalog/ResourceCategoryCatalog.js';
import { takeCategoryAmount } from '../../../src/contexts/supply/domain/value-objects/ResourceStock.js';
import { getCategoriesForRole, getTotalKeyForRole } from '../../../src/contexts/supply/domain/policies/ResourceRolePolicy.js';

/** Sells `silvania`'s book (baseMultiplier 1.5, the first want) at the given draw and bias; returns its unit price. */
async function unitPriceSold({ draw, bias }) {
  const sales = [];
  const relation = { cityId: 'silvania', status: 'active', demandMultiplier: 1, satisfactionScore: 50, lastOrderMonth: null };
  const hub = { id: 'hub1', type: 'TradeWarehouse', stocks: { book: 10, goods: 10 } };
  const cycle = new RunMonthlyCityTradeCycle({
    cityTradeRepository: {
      async getActiveRelations() { return [relation]; },
      async saveRelation() {},
    },
    supplyBuildingRepository: {
      async findByResourceRole() { return [hub]; },
      async saveStocks() {},
    },
    hubServing: {
      async availableTo() { return 10; },
      async take({ amount, category }) { return [{ amount, category }]; },
      async recordDemand() {},
    },
    takeHubStock: (h, category, amount) =>
      takeCategoryAmount(h.stocks, category, amount, getCategoriesForRole(h.type, 'hub'), getTotalKeyForRole(h.type, 'hub')),
    recordCommerceExportIncome: async () => {},
    recordMerchantSale: async (sale) => sales.push(sale),
    getCustomsRate: () => 0.1,
    random: () => draw,
    saleBias: () => bias,
  });
  await cycle.execute({ turn: 1, monthIndex: 0, monthNumber: 0, year: 0 });
  const book = sales.find((sale) => sale.good === 'book');
  expect(book).toBeDefined();
  return book.unitPrice;
}

describe('trade sale price — drawn in the catalog range, moved by events', () => {
  const entry = getTradeCatalogEntry('silvania');
  const bookBase = getResourceBaseValue('book');
  const centre = bookBase * 1.5;

  test('an unbiased draw stays within baseMultiplier ± spread', async () => {
    const low = await unitPriceSold({ draw: 0, bias: 0 });
    const high = await unitPriceSold({ draw: 0.999999, bias: 0 });
    expect(low).toBeGreaterThanOrEqual(centre * (1 - entry.sale.spread));
    expect(high).toBeLessThanOrEqual(centre * (1 + entry.sale.spread));
    expect(low).toBeLessThan(high);
  });

  test('a favourable bias lifts the same draw above the unbiased one', async () => {
    const neutral = await unitPriceSold({ draw: 0.999999, bias: 0 });
    const favoured = await unitPriceSold({ draw: 0.999999, bias: 1 });
    expect(favoured).toBeGreaterThan(neutral);
  });
});
