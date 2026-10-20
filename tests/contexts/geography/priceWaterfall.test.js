import { describe, test, expect } from '@jest/globals';
import { buildPriceWaterfall } from '../../../src/contexts/geography/domain/policies/PriceWaterfallPolicy.js';
import { priceImportDelivery } from '../../../src/contexts/geography/domain/policies/ImportPricePolicy.js';
import { getTradeCatalogEntry } from '../../../src/shared/trade-catalog/TradeCatalog.js';

// A price shown step by step must add up: what the house pays is the reference plus every step, and the duty is the one the import rule charges.
describe('buildPriceWaterfall', () => {
  test('a made-here good adds producer, warehouse, market and VAT to the reference', () => {
    const waterfall = buildPriceWaterfall({ good: 'wheat', reference: 1, producerPrice: 1.2, import: null, warehousePrice: 1.44, marketPrice: 1.8, vatPercent: 10 });

    expect(waterfall.steps.map((step) => step.id)).toEqual(['reference', 'producer', 'warehouse', 'market', 'vat']);
    expect(waterfall.priceHT).toBe(1.8);
    expect(waterfall.vat).toBe(0.18);
    expect(waterfall.priceTTC).toBe(1.98);
    expect(waterfall.dutyShare).toBe(0);
  });

  test('an imported good carries the freight, the duty and the merchants\' margin the import rule charges, and the duty is its share of the price', () => {
    const entry = getTradeCatalogEntry('briga');
    const offer = entry.offers[0];
    const delivery = priceImportDelivery({ cityId: 'briga', offer, quantity: offer.quantityPerOrder, dutyRate: 0.2 });
    const waterfall = buildPriceWaterfall({
      good: offer.good,
      reference: 1.2,
      producerPrice: 1.44,
      import: { cityId: 'briga', cityPrice: delivery.unit.foreign, transport: delivery.unit.transport, dutyRate: 0.2, duty: delivery.unit.duty, merchantMargin: delivery.unit.margin },
      warehousePrice: delivery.unit.sale * 1.2,
      marketPrice: delivery.unit.sale * 1.2 * 1.25,
      vatPercent: 0,
    });

    expect(waterfall.steps.map((step) => step.id)).toEqual(['reference', 'city', 'transport', 'duty', 'merchants', 'warehouse', 'market', 'vat']);
    expect(waterfall.steps.find((step) => step.id === 'duty').amount).toBeCloseTo(delivery.unit.duty, 2);
    expect(waterfall.dutyShare).toBeGreaterThan(0);
    expect(waterfall.priceTTC).toBeCloseTo(delivery.unit.sale * 1.2 * 1.25, 1);
  });

  test('a good no market sells ends at the warehouse, with no VAT', () => {
    const waterfall = buildPriceWaterfall({ good: 'coal', reference: 1, producerPrice: 1.2, import: null, warehousePrice: 1.5, marketPrice: null, vatPercent: 20 });

    expect(waterfall.steps.map((step) => step.id)).toEqual(['reference', 'producer', 'warehouse']);
    expect(waterfall.priceTTC).toBe(1.5);
  });

  test('a missing price throws, naming it', () => {
    expect(() => buildPriceWaterfall({ good: 'wheat', reference: 1, producerPrice: 1.2, import: null, warehousePrice: undefined, marketPrice: 1, vatPercent: 0 })).toThrow(/warehousePrice/);
  });
});
