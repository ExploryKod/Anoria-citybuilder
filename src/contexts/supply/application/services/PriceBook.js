import {
  COST_WINDOW_MONTHS,
  openingUnitCost,
  priceFromCost,
  stageOfBuildingType,
  unitPriceAtStage,
} from '../../../../shared/resource-catalog/ValueChainCatalog.js';
import { MONTHS_PER_YEAR } from '../../../../shared/time/TimeCalendar.js';
import { getResourceBaseValue, getServiceCategories, unsoldRiskDiscount } from '../../../../shared/resource-catalog/ResourceCategoryCatalog.js';
import { getResourceRoles } from '../../../../shared/building-catalog/resourceRoleQueries.js';
import { shelfLifeMonthsAt } from '../../domain/policies/ResourceRolePolicy.js';
import { standardUnitCostOf } from '../../domain/policies/StandardUnitCostPolicy.js';

/** How many months' costs are kept: the month being played and the ones a settlement still prices. */
const MONTHS_KEPT = 4;

const monthKeyOf = (period) => (period.year || 0) * MONTHS_PER_YEAR + (period.monthIndex || 0);

/**
 * The prices the chain sells at, built on what each stage's goods cost it.
 *
 * - A **producer** sells at its standard cost plus its margin: its month at full staffing (workers at the labour market's wage, upkeep, the
 *   inputs it draws at the price its warehouse sells them at) over the units it makes (see StandardUnitCostPolicy). So a wage, a minimum wage, a
 *   customs duty on its fuel reach its price. The energy and the water its plant or tank makes are priced the same way.
 * - A **warehouse** and a **market** sell at the average price they paid for the good over the last `COST_WINDOW_MONTHS` months of deliveries,
 *   marked up by their own margin: a change upstream reaches the shelves as the new deliveries replace the old (the timing effect of a weighted
 *   average cost). It is read from the deliveries logged (nothing is stored), so it is the average price of what came in, not of the exact units
 *   still on the shelf.
 * - Every seller of a good cuts its price by the risk of its stock going bad unsold, derived from how long its place keeps the good (see unsoldRiskDiscount): a
 *   farm of cabbages earns less than a farm of wheat, a stall less than a granary. A stock is still valued at cost (`stockUnitCost`), not at this price.
 * - A service no producer makes (a school's lessons) is priced at its base value, outside the chain.
 *
 * What has no cost to read yet keeps the reference chain: a building with no delivery in the window values its stock at the opening cost, a producer
 * with no workforce declared (a house's own business, until it pays a wage) or a good with no reference value sells at the reference chain's price.
 *
 * A month's costs are read once, when the month opens (`ensure(period)`); `sellingPrice(building, category, period)` is then a plain lookup of that
 * month, so a price can be asked in the middle of a distribution loop, and a settlement can price the month it settles.
 */
export class PriceBook {
  /**
   * @param {object} deps
   * @param {(range: { fromKey: number, toKey: number }) => Promise<Array<{ buyerId: string, category: string, stage: 'hub' | 'distributor', quantity: number, amount: number }>>} deps.sumInflowCosts
   *   the deliveries logged over a range of months (a month's key is `year × MONTHS_PER_YEAR + monthIndex`), summed per buyer and good
   * @param {() => Promise<{ wageRateOf: (skill: string, level: number) => number, maintenanceCostOf: (buildingType: string) => number, employerContributionRate: number }>} deps.loadProducerCosting
   *   what a producer's month costs apart from its inputs: the labour market's wages, the employer's contribution on them and the buildings' upkeep (accounting's)
   */
  constructor({ sumInflowCosts, loadProducerCosting }) {
    if (typeof sumInflowCosts !== 'function') throw new Error('[supply] the price book needs the deliveries logged (sumInflowCosts)');
    if (typeof loadProducerCosting !== 'function') throw new Error('[supply] the price book needs the producers\' costing (loadProducerCosting): without wages and upkeep a producer\'s price is not its cost');
    this.sumInflowCosts = sumInflowCosts;
    this.loadProducerCosting = loadProducerCosting;
    /** @type {Map<number, { averageCosts: Map<string, number>, hubCostByGood: Map<string, number>, costing: object, standardCosts: Map<string, number | null> }>} */
    this.months = new Map();
  }

  /**
   * Reads the costs of the window before a month, once per month.
   * @param {{ year?: number, monthIndex?: number }} period
   */
  async ensure(period) {
    const key = monthKeyOf(period);
    if (this.months.has(key)) return;
    const rows = await this.sumInflowCosts({ fromKey: key - COST_WINDOW_MONTHS, toKey: key - 1 });
    const averageCosts = new Map();
    const hubTotals = new Map();
    for (const row of rows) {
      if (!(row.quantity > 0)) continue;
      averageCosts.set(`${row.buyerId}|${row.category}`, row.amount / row.quantity);
      if (row.stage === 'hub') {
        const total = hubTotals.get(row.category) ?? { quantity: 0, amount: 0 };
        total.quantity += row.quantity;
        total.amount += row.amount;
        hubTotals.set(row.category, total);
      }
    }
    const hubCostByGood = new Map([...hubTotals].map(([category, total]) => [category, total.amount / total.quantity]));
    this.months.set(key, { averageCosts, hubCostByGood, costing: await this.loadProducerCosting(), standardCosts: new Map() });
    for (const kept of [...this.months.keys()].sort((a, b) => a - b).slice(0, -MONTHS_KEPT)) this.months.delete(kept);
  }

  /** The price a warehouse sells a good at, as a producer's input: what the warehouses paid for it plus their margin, the reference chain before any delivery. */
  #inputPriceOf(state, category) {
    const paid = state.hubCostByGood.get(category);
    return paid === undefined ? unitPriceAtStage('hub', category) : priceFromCost('hub', paid);
  }

  /** @returns {number | null} the standard cost of a unit a producer type makes, null when its catalog entry declares no workforce */
  #standardCost(state, buildingType, category) {
    const key = `${buildingType}|${category}`;
    if (!state.standardCosts.has(key)) {
      state.standardCosts.set(
        key,
        standardUnitCostOf({
          buildingType,
          category,
          wageRateOf: state.costing.wageRateOf,
          maintenanceCostOf: state.costing.maintenanceCostOf,
          employerContributionRate: state.costing.employerContributionRate,
          inputPriceOf: (input) => this.#inputPriceOf(state, input),
        }),
      );
    }
    return state.standardCosts.get(key);
  }

  /**
   * What a unit of a good in a building's stock cost it, for the balance sheet: a producer's standard cost (what it costs to make), a warehouse's or a
   * market's average cost of its deliveries. No margin: a stock is valued at cost, never at its selling price.
   * @param {{ id: string, type: string }} building
   * @param {string} category a good (not a service)
   * @param {{ year?: number, monthIndex?: number }} period the month whose costs are used (prepared with `ensure`)
   * @returns {number} the unit cost HT, in euros
   */
  stockUnitCost(building, category, period) {
    const state = this.months.get(monthKeyOf(period));
    if (!state) throw new Error(`[supply] the price book was asked ${building.type}'s stock cost for a month that was not prepared (ensure): year ${period.year}, month ${period.monthIndex}`);
    const stage = stageOfBuildingType(building.type);
    const makesIt = getResourceRoles(building.type).some((entry) => entry.role === 'producer' && entry.categories.includes(category));
    if (stage === 'producer' || makesIt) {
      const cost = getResourceBaseValue(category) > 0 ? this.#standardCost(state, building.type, category) : null;
      return cost === null ? unitPriceAtStage('producer', category) : cost;
    }
    return state.averageCosts.get(`${building.id}|${category}`) ?? openingUnitCost(stage, category);
  }

  /** A good's price less the risk its seller carries of the stock going bad unsold; a service keeps its price. */
  #withUnsoldRisk(building, category, price) {
    if (getServiceCategories().includes(category)) return price;
    return Math.round(price * (1 - unsoldRiskDiscount(shelfLifeMonthsAt(building.type, category))) * 100) / 100;
  }

  /**
   * @param {{ id: string, type: string }} building the seller
   * @param {string} category the good or service
   * @param {{ year?: number, monthIndex?: number }} period the month whose price is asked (it must have been prepared with `ensure`)
   * @returns {number} the unit price HT, in euros
   */
  sellingPrice(building, category, period) {
    const state = this.months.get(monthKeyOf(period));
    if (!state) throw new Error(`[supply] the price book was asked ${building.type}'s price for a month that was not prepared (ensure): year ${period.year}, month ${period.monthIndex}`);
    const stage = stageOfBuildingType(building.type);
    const makesIt = getResourceRoles(building.type).some((entry) => entry.role === 'producer' && entry.categories.includes(category));
    if (getServiceCategories().includes(category) && !makesIt) return unitPriceAtStage(stage, category);
    if (stage === 'producer' || makesIt) {
      // A good with no reference value (a service-like one) has nothing to be marked up from: it stays at the reference chain.
      const cost = getResourceBaseValue(category) > 0 ? this.#standardCost(state, building.type, category) : null;
      return cost === null ? unitPriceAtStage(stage, category) : this.#withUnsoldRisk(building, category, priceFromCost('producer', cost));
    }
    const cost = state.averageCosts.get(`${building.id}|${category}`) ?? openingUnitCost(stage, category);
    return this.#withUnsoldRisk(building, category, priceFromCost(stage, cost));
  }
}
