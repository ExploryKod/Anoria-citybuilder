/**
 * Query (CQRS read): what the basic needs of each house cost it in a month, at the prices the markets sell at now. For every consumer building and every need that is a stock (what
 * the citizens eat, wear out, burn for heat and light), the units its residents use up in a month (the catalog's `amount` per inhabitant) and what they cost at the average market
 * price of the need's goods, and what the same units cost at the reference chain's prices (the same goods, the prices the catalog gives a market). A need no market sells yet has no price: it is
 * reported as unpriced, never given one. Read-only; the prices come from the price book through `marketPriceOf`.
 */
import { getQuantityConsumerEntries, listQuantityConsumerNeeds } from '../../../../shared/building-catalog/resourceRoleQueries.js';
import { unitPriceAtStage } from '../../../../shared/resource-catalog/ValueChainCatalog.js';

export class DescribeResidentBasket {
  /**
   * @param {import('../ports/SupplyBuildingRepository.js').SupplyBuildingRepository} supplyBuildingRepository
   * @param {object} deps
   * @param {() => Promise<(category: string) => number | null>} deps.marketPrices the unit price the markets sell a good at now (the average of the markets that sell it), null for a good none sells
   */
  constructor(supplyBuildingRepository, { marketPrices }) {
    if (typeof marketPrices !== 'function') throw new Error('[supply] the resident basket needs the markets\' prices (marketPrices)');
    this.supplyBuildingRepository = supplyBuildingRepository;
    this.marketPrices = marketPrices;
  }

  /**
   * @returns {Promise<Array<{ houseId: string, type: string, pop: number, cost: number, needs: Array<{ totalKey: string, categories: string[], units: number, unitPrice: number | null, cost: number, referenceCost: number }> }>>}
   *   `cost` is the sum of the priced needs; a need with `unitPrice` null is not in it. `referenceCost`: the same units at the reference prices (0 for an unpriced need)
   */
  async execute() {
    const priceOf = await this.marketPrices();
    const needs = listQuantityConsumerNeeds().filter((entry) => entry.totalKey);
    const consumers = new Map();
    for (const need of needs) {
      for (const consumer of await this.supplyBuildingRepository.findByResourceRole('consumer', need.categories)) consumers.set(consumer.id, consumer);
    }
    const baskets = [];
    for (const consumer of consumers.values()) {
      const lines = [];
      for (const entry of getQuantityConsumerEntries(consumer.type).filter((candidate) => candidate.totalKey)) {
        const priced = entry.categories.filter((category) => priceOf(category) !== null);
        const prices = priced.map(priceOf);
        const unitPrice = prices.length === 0 ? null : prices.reduce((sum, price) => sum + price, 0) / prices.length;
        const referencePrice = priced.length === 0 ? 0 : priced.reduce((sum, category) => sum + unitPriceAtStage('distributor', category), 0) / priced.length;
        const units = (consumer.pop ?? 0) * entry.amount;
        lines.push({ totalKey: entry.totalKey, categories: [...entry.categories], units, unitPrice, cost: unitPrice === null ? 0 : Math.round(units * unitPrice * 100) / 100, referenceCost: Math.round(units * referencePrice * 100) / 100 });
      }
      baskets.push({ houseId: consumer.id, type: consumer.type, pop: consumer.pop ?? 0, cost: Math.round(lines.reduce((sum, line) => sum + line.cost, 0) * 100) / 100, needs: lines });
    }
    return baskets;
  }
}
