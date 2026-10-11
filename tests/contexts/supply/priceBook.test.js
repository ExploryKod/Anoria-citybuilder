import { describe, test, expect } from '@jest/globals';
import { PriceBook } from '../../../src/contexts/supply/application/services/PriceBook.js';
import { MARGIN_BY_STAGE, unitPriceAtStage } from '../../../src/shared/resource-catalog/ValueChainCatalog.js';

// A warehouse prices what it sells on what its stock cost it: the average of its deliveries over the last months, plus its margin.
const warehouse = { id: 'warehouse-1', type: 'Warehouse' };
const market = { id: 'market-1', type: 'Market-Stall-Red' };

const bookWith = (inflows) => new PriceBook({ sumInflowCosts: async () => inflows });

describe('PriceBook — prices built on the cost of the stock', () => {
  test('with no delivery in the window, a warehouse values its stock at the reference chain (the opening cost)', async () => {
    const book = bookWith([]);
    await book.ensure({ year: 1, monthIndex: 4 });

    expect(book.sellingPrice(warehouse, 'wheat')).toBe(unitPriceAtStage('hub', 'wheat'));
  });

  test('a dearer delivery reaches the price: the warehouse sells at its average cost plus its margin', async () => {
    // 10 units bought at 2.00 and 30 at 1.00: an average cost of 1.25.
    const book = bookWith([{ buyerId: 'warehouse-1', category: 'coal', quantity: 40, amount: 10 * 2 + 30 * 1 }]);
    await book.ensure({ year: 1, monthIndex: 4 });

    expect(book.sellingPrice(warehouse, 'coal')).toBeCloseTo(1.25 * (1 + MARGIN_BY_STAGE.hub), 2);
  });

  test('a market marks up what it paid the warehouse, so the duty is in the shelf price', async () => {
    const book = bookWith([{ buyerId: 'market-1', category: 'coal', quantity: 10, amount: 15 }]);
    await book.ensure({ year: 1, monthIndex: 4 });

    expect(book.sellingPrice(market, 'coal')).toBeCloseTo(1.5 * (1 + MARGIN_BY_STAGE.distributor), 2);
  });

  test('a producer sells at the reference chain whatever it was paid before', async () => {
    const book = bookWith([{ buyerId: 'farm-1', category: 'wheat', quantity: 5, amount: 50 }]);
    await book.ensure({ year: 1, monthIndex: 4 });

    expect(book.sellingPrice({ id: 'farm-1', type: 'Farm-Wheat' }, 'wheat')).toBe(unitPriceAtStage('producer', 'wheat'));
  });

  test('a price asked before any month was prepared throws', () => {
    expect(() => bookWith([]).sellingPrice(warehouse, 'wheat')).toThrow(/prepared/);
  });
});
