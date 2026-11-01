import { plotsToBuy } from '../../domain/policies/LandPurchasePolicy.js';
import { findNaturalSourcesInRange } from '../../domain/policies/ResourceRangePolicy.js';

/**
 * The producers that run short of natural sources buy land to plant their own: each month, a producer whose catalog declares a `landPurchase` and whose range holds
 * fewer sources than it wants buys the nearest plots the owner's house put up for sale for its use (see LandPurchasePolicy). The price is the one the owner's house set for
 * that use; it comes out of the producer's cash and into the owner's property company (the books refuse it when the producer cannot pay, and then it buys nothing).
 * The plots it buys become its own: they are saved with its id, and the map is told.
 */
export class RunMonthlyLandPurchases {
  /**
   * @param {object} deps
   * @param {() => Promise<Array<{ id: string, type: string, x: number, y: number, name: string, landPurchase: object, resource: string, range: number }>>} deps.listBuyers
   *   the producers that can buy land, with what they gather and how far they reach
   * @param {() => Promise<Array<{ id: string, type: string, x: number, y: number, stocks?: object }>>} deps.listNaturalResources
   * @param {() => Promise<Array<{ x: number, y: number, use: string, owner: string | null }>>} deps.listPlots
   * @param {(plots: Array<object>) => Promise<void>} deps.savePlots the whole list as it now stands
   * @param {(use: string) => Promise<number>} deps.priceOf the price per tile the owner's house asks for a use
   * @param {(params: { buyerId: string, tileCount: number, pricePerTile: number, turn: number, label: string }) => Promise<{ sold: boolean, reason?: string }>} deps.sellLand
   * @param {() => void} deps.onPlotsChanged
   */
  constructor(deps) {
    this.deps = deps;
  }

  /** @param {{ time: number, label: string }} params the turn the books are dated by, and the month it is */
  async execute({ time, label }) {
    let changed = false;
    for (const buyer of await this.deps.listBuyers()) {
      const sources = findNaturalSourcesInRange(buyer, await this.deps.listNaturalResources(), { resource: buyer.resource, range: buyer.range, draw: true });
      // The plots are read again for each buyer: what one bought is no longer for sale to the next.
      const plots = await this.deps.listPlots();
      const wanted = plotsToBuy({ buyer, sourcesInRange: sources.length, plots, landPurchase: buyer.landPurchase, range: buyer.range });
      if (wanted.length === 0) continue;
      const pricePerTile = await this.deps.priceOf(buyer.landPurchase.use);
      const sale = await this.deps.sellLand({ buyerId: buyer.id, tileCount: wanted.length, pricePerTile, turn: time, label: `${buyer.name} - ${label}` });
      if (!sale.sold) continue;
      const bought = new Set(wanted.map(({ x, y }) => `${x},${y}`));
      await this.deps.savePlots(plots.map((plot) => (bought.has(`${plot.x},${plot.y}`) ? { ...plot, owner: buyer.id } : plot)));
      changed = true;
    }
    if (changed) this.deps.onPlotsChanged();
  }
}
