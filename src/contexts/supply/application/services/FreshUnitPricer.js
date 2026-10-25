import { freshnessFactorOfNthUnit } from '../../domain/policies/FreshnessPricePolicy.js';
import { reconcileAges } from '../../domain/policies/StockAgingPolicy.js';
import { shelfLifeTurnsAt } from '../../domain/policies/ResourceRolePolicy.js';
import { getCategoryAmount } from '../../domain/value-objects/ResourceStock.js';
import { getFreshnessPriceCurve, getServiceCategories } from '../../../../shared/resource-catalog/ResourceCategoryCatalog.js';
import { TimeManager } from '../../../../shared/time/TimeManager.js';

/**
 * The price of the n-th unit a seller hands out of a good, by its freshness: the units of a stock go oldest first, and
 * what is about to go bad is sold off (see FreshnessPricePolicy.js). The base price is the seller's own (PriceBook,
 * prepared for the month with `ensure`); the age of the units is read from the seller's stock at the moment of the sale.
 *
 * @param {object} params
 * @param {object} params.seller The seller's row (type, stockAges)
 * @param {object} params.stock The seller's stock the units are taken from
 * @param {{ sellingPrice: Function }} params.priceBook
 * @param {{ year?: number, monthIndex?: number, turn: number }} params.period
 * @returns {(category: string, nth: number) => number} nth counts from 0, the oldest unit first
 */
export function freshUnitPricer({ seller, stock, priceBook, period }) {
  if (!Number.isFinite(period?.turn)) throw new Error(`[supply] a sale needs the turn it takes place on to price its units by their freshness, got ${period?.turn}`);
  const serviceCategories = getServiceCategories();
  const pricing = new Map();
  return (category, nth) => {
    if (!pricing.has(category)) {
      // A service (the water of a tank) is not a stock that goes bad: it keeps its price.
      const lifeTurns = serviceCategories.includes(category) ? Infinity : shelfLifeTurnsAt(seller.type, category, TimeManager.DAYS_PER_MONTH);
      pricing.set(category, {
        base: priceBook.sellingPrice(seller, category, period),
        lifeTurns,
        curve: lifeTurns === Infinity ? null : getFreshnessPriceCurve(category),
        ages: lifeTurns === Infinity ? [] : reconcileAges(seller.stockAges?.[category], getCategoryAmount(stock, category), period.turn),
      });
    }
    const { base, lifeTurns, curve, ages } = pricing.get(category);
    if (lifeTurns === Infinity) return base;
    return Math.round(base * freshnessFactorOfNthUnit({ ages, nth, turn: period.turn, lifeTurns, curve }) * 100) / 100;
  };
}
