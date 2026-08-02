import { describe, test, expect } from '@jest/globals';
import {
  canExecuteTrade,
  mergeProductTradeToggles,
  getTradeToggleStatusLabel,
  getPlayerImportCap,
  getMaxImportUpTo,
} from '../../../src/contexts/commerce/domain/policies/PlayerTradeTogglePolicy.js';
import { getPartnerImportCapacity } from '../../../src/contexts/commerce/domain/policies/PartnerTradePolicy.js';
import { createDefaultPartners } from '../../../src/contexts/commerce/domain/catalogs/PartnerCatalog.js';

describe('PlayerTradeTogglePolicy', () => {
  const partners = createDefaultPartners();

  test('mergeProductTradeToggles applies MVP defaults', () => {
    expect(mergeProductTradeToggles({ id: 'figs' })).toMatchObject({
      exportEnabled: false,
      importEnabled: true,
    });
    expect(mergeProductTradeToggles({ id: 'wood' })).toMatchObject({
      exportEnabled: true,
      importEnabled: false,
    });
  });

  test('getPartnerImportCapacity sums partner sellsToUs quotas', () => {
    expect(getPartnerImportCapacity('figs', partners)).toBe(10);
    expect(getPartnerImportCapacity('wood', partners)).toBe(0);
  });

  test('getMaxImportUpTo uses partner cumulative capacity', () => {
    expect(getMaxImportUpTo({ id: 'figs', buyingMax: 10 }, partners)).toBe(10);
    expect(getMaxImportUpTo({ id: 'figs', buyingMax: 20 }, partners)).toBe(10);
  });

  test('getPlayerImportCap limits imports below partner and city caps', () => {
    const figs = { id: 'figs', buyingMax: 10, importUpTo: 4 };
    expect(getPlayerImportCap(figs, partners)).toBe(4);
    expect(getPlayerImportCap({ ...figs, importUpTo: 15 }, partners)).toBe(10);
  });

  test('canExecuteTrade respects toggles and export threshold', () => {
    const wood = { id: 'wood', exportEnabled: true, exportFromThreshold: 5 };
    expect(canExecuteTrade({ operation: 'export', productConfig: wood, stock: 3 })).toBe(false);
    expect(canExecuteTrade({ operation: 'export', productConfig: wood, stock: 6 })).toBe(true);
    expect(
      canExecuteTrade({
        operation: 'import',
        productConfig: { id: 'figs', importEnabled: false, buyingMax: 10 },
        partners,
      })
    ).toBe(false);
  });

  test('getTradeToggleStatusLabel summarizes player settings', () => {
    const label = getTradeToggleStatusLabel(
      { id: 'wood', exportEnabled: true, exportFromThreshold: 10, industryActive: true },
      25,
      0
    );
    expect(label).toContain('Export ON');
    expect(label).toContain('≥ 10');
  });
});
