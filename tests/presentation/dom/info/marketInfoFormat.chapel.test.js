/**
 * Regression — Chapel's own État/Stocks tabs (2026-10-10, faith leaving flag mode): a producer with no
 * hub leg at all (buildingCatalog.js's `hubLink` absence) must not render "buying" copy meant for a
 * market that restocks from a hub, and a single-category quantity entry must not disappear from Stocks
 * just because it legally omits `totalKey`.
 */
import { describe, test, expect } from '@jest/globals';
import {
  formatMarketOverviewModel,
  formatMarketStocksModel,
} from '../../../../src/presentation/dom/info/presenters/formats/marketInfoFormat.js';

function chapelVm(stocks = {}) {
  return {
    buildingType: 'Chapel',
    anchorX: 9,
    anchorY: 9,
    buildingPop: 0,
    supplyView: { maxStock: 120, hubLinks: [] },
    // `food` is the globally shared quantity-consumer total key (the house diet's) — every real stock
    // object carries it regardless of building type, which is what formatMarketOverviewModel's own
    // "does this building hold stock at all" gate checks for.
    stocks: { food: 0, faith: 0, ...stocks },
  };
}

describe('formatMarketOverviewModel — Chapel (no hub leg)', () => {
  test('shows when it produces, not a buying schedule', () => {
    const model = formatMarketOverviewModel(chapelVm());
    expect(model.sections[0].rows).toEqual([{ label: 'Produit sur place · Foi', value: 'Toute l\'année' }]);
  });
});

describe('formatMarketStocksModel — Chapel (single-category, no declared totalKey)', () => {
  test('shows the faith stock, not an empty panel', () => {
    const model = formatMarketStocksModel(chapelVm({ faith: 42 }));
    expect(model.sections).toEqual([
      {
        title: 'Stock · Chapelle',
        rows: [{ label: 'Foi', value: '42/120 cérémonies' }],
      },
    ]);
  });
});
