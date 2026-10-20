import { unitPriceOf } from '../../src/shared/resource-catalog/ValueChainCatalog.js';

/**
 * A test double for the price book: every seller sells at the reference chain's price of its stage (what the game charged before
 * prices were built on stock costs). Used by the supply and trade tests that are not about prices; the cost rules have their own test.
 */
export const referencePriceBook = Object.freeze({
  ensure: async () => {},
  sellingPrice: (building, category) => unitPriceOf(building.type, category),
});

/** The same, in the shape the trade cycle asks for: `hubSellingPrice(hub, good, period)`. */
export const referenceHubSellingPrice = async (hub, good) => unitPriceOf(hub.type, good);
