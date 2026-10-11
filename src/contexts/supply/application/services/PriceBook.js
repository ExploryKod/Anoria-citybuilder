import {
  COST_WINDOW_MONTHS,
  openingUnitCost,
  priceFromCost,
  stageOfBuildingType,
  unitPriceAtStage,
} from '../../../../shared/resource-catalog/ValueChainCatalog.js';
import { MONTHS_PER_YEAR } from '../../../../shared/time/TimeCalendar.js';
import { getServiceCategories } from '../../../../shared/resource-catalog/ResourceCategoryCatalog.js';

/**
 * The prices the chain sells at, built on what each stock cost. A producer sells at the reference chain's price; a warehouse and a market
 * sell at the average price they paid for the good over the last `COST_WINDOW_MONTHS` months of deliveries, marked up by their own margin.
 * So a customs duty, a longer freight or a dearer producer reaches the shelves as the new deliveries replace the old: the timing effect of a
 * weighted average cost. The average is read from the deliveries logged (nothing is stored: the log is the single source), so it is the
 * average price of what came in, not of the exact units still on the shelf.
 *
 * A building that has had no delivery in the window values its stock at the opening cost (the reference chain's price of the stage before it).
 *
 * The month's costs are read once, when the month opens (`ensure`); `sellingPrice` is then a plain lookup, so a price can be asked in the
 * middle of a distribution loop.
 */
export class PriceBook {
  /**
   * @param {{ sumInflowCosts: (range: { fromKey: number, toKey: number }) => Promise<Array<{ buyerId: string, category: string, quantity: number, amount: number }>> }} deps
   *   the deliveries logged over a range of months (a month's key is `year × MONTHS_PER_YEAR + monthIndex`), summed per buyer and good
   */
  constructor({ sumInflowCosts }) {
    if (typeof sumInflowCosts !== 'function') throw new Error('[supply] the price book needs the deliveries logged (sumInflowCosts)');
    this.sumInflowCosts = sumInflowCosts;
    this.monthKey = null;
    /** @type {Map<string, number>} `${buyerId}|${category}` → average unit price of the window's deliveries */
    this.averageCosts = new Map();
  }

  /**
   * Reads the costs of the window before this month, once per month.
   * @param {{ year?: number, monthIndex?: number }} period
   */
  async ensure(period) {
    const key = (period.year || 0) * MONTHS_PER_YEAR + (period.monthIndex || 0);
    if (key === this.monthKey) return;
    const rows = await this.sumInflowCosts({ fromKey: key - COST_WINDOW_MONTHS, toKey: key - 1 });
    const averages = new Map();
    for (const row of rows) {
      if (row.quantity > 0) averages.set(`${row.buyerId}|${row.category}`, row.amount / row.quantity);
    }
    this.averageCosts = averages;
    this.monthKey = key;
  }

  /**
   * @param {{ id: string, type: string }} building the seller
   * @param {string} category the good or service
   * @returns {number} the unit price HT, in euros
   */
  sellingPrice(building, category) {
    if (this.monthKey === null) throw new Error(`[supply] the price book was asked ${building.type}'s price before any month was prepared (ensure)`);
    if (getServiceCategories().includes(category)) return unitPriceAtStage(stageOfBuildingType(building.type), category);
    const stage = stageOfBuildingType(building.type);
    if (stage === 'producer') return unitPriceAtStage('producer', category);
    const cost = this.averageCosts.get(`${building.id}|${category}`) ?? openingUnitCost(stage, category);
    return priceFromCost(stage, cost);
  }
}
