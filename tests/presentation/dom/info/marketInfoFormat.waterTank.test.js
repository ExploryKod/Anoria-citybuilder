/**
 * Regression — the water tank's own État/Stocks tabs (a producer with no hub leg that distributes a quantity): a producer with no
 * hub leg at all (buildingCatalog.js's `hubLink` absence) must not render "buying" copy meant for a
 * market that restocks from a hub, and a single-category quantity entry must not disappear from Stocks
 * just because it legally omits `totalKey`.
 */
import { describe, test, expect } from '@jest/globals';
import {
  formatMarketOverviewModel,
  formatMarketStocksModel,
} from '../../../../src/presentation/dom/info/presenters/formats/marketInfoFormat.js';

function tankVm(stocks = {}) {
  return {
    buildingType: 'WaterTank',
    anchorX: 9,
    anchorY: 9,
    buildingPop: 0,
    supplyView: { maxStock: 480, hubLinks: [] },
    // `food` is the globally shared quantity-consumer total key (the house diet's) — every real stock
    // object carries it regardless of building type, which is what formatMarketOverviewModel's own
    // "does this building hold stock at all" gate checks for.
    stocks: { food: 0, water: 0, ...stocks },
  };
}

describe('formatMarketOverviewModel — WaterTank (no hub leg)', () => {
  test('shows when it produces, not a buying schedule', () => {
    const model = formatMarketOverviewModel(tankVm());
    expect(model.sections[0].rows).toEqual([{ label: 'Produit sur place · Eau', value: 'Toute l\'année' }]);
  });
});

describe('formatMarketStocksModel — WaterTank (single-category, no declared totalKey)', () => {
  test('shows the water stock, not an empty panel', () => {
    const model = formatMarketStocksModel(tankVm({ water: 42 }));
    expect(model.sections).toEqual([
      {
        title: 'Stock · Citerne',
        rows: [{ label: 'Eau', value: '42/480 mètres cubes' }],
      },
    ]);
  });
});
