import { describe, test, expect } from '@jest/globals';
import { RunMonthlyLandPurchases } from '../../../src/contexts/supply/application/commands/RunMonthlyLandPurchases.js';
import { plotsToBuy } from '../../../src/contexts/supply/domain/policies/LandPurchasePolicy.js';

const landPurchase = { use: 'forest', resource: 'tree', buysBelowSources: 2, tilesPerPurchase: 2 };
const buyer = { id: 'lumberjack-1', type: 'Lumberjack', x: 5, y: 5, name: 'Bûcheron', landPurchase, resource: 'tree', range: 6 };
const plot = (x, y, owner = null) => ({ x, y, use: 'forest', owner });

function service({ plots, sources = [], sold = true }) {
  const state = { plots, sales: [], changed: 0 };
  const run = new RunMonthlyLandPurchases({
    listBuyers: async () => [buyer],
    listNaturalResources: async () => sources,
    listPlots: async () => state.plots,
    savePlots: async (next) => { state.plots = next; },
    priceOf: async () => 20,
    sellLand: async (sale) => { state.sales.push(sale); return { sold }; },
    onPlotsChanged: () => { state.changed += 1; },
  });
  return { state, run: () => run.execute({ time: 10, label: 'mars 1' }) };
}

describe('a producer short of natural sources buys land from the owner\'s house', () => {
  test('it buys the nearest plots in its range, pays the price per tile, and they become its own', async () => {
    const { state, run } = service({ plots: [plot(5, 9), plot(5, 6), plot(6, 5), plot(40, 40)] });
    await run();

    expect(state.sales).toEqual([expect.objectContaining({ buyerId: 'lumberjack-1', tileCount: 2, pricePerTile: 20 })]);
    expect(state.plots.filter((p) => p.owner === 'lumberjack-1').map((p) => `${p.x},${p.y}`).sort()).toEqual(['5,6', '6,5']);
    expect(state.changed).toBe(1);
  });

  test('with enough sources in range it buys nothing', () => {
    expect(plotsToBuy({ buyer, sourcesInRange: 2, plots: [plot(5, 6)], landPurchase, range: 6 })).toEqual([]);
  });

  test('a plot already bought is not for sale, and a buyer that cannot pay leaves the plots as they were', async () => {
    const unsold = service({ plots: [plot(5, 6), plot(6, 5, 'lumberjack-2')], sold: false });
    await unsold.run();

    expect(unsold.state.plots.every((p) => p.owner === null || p.owner === 'lumberjack-2')).toBe(true);
    expect(unsold.state.sales[0].tileCount).toBe(1);
    expect(unsold.state.changed).toBe(0);
  });
});
