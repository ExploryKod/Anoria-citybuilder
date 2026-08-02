import { describe, test, expect } from '@jest/globals';
import { buildTradeGoodsView } from '../../../src/contexts/commerce/application/queries/GetTradeGoodsView.js';
import { createDefaultPartners } from '../../../src/contexts/commerce/domain/catalogs/PartnerCatalog.js';

describe('GetTradeGoodsView', () => {
  test('builds goods rows with stock, partner import capacity and yearly totals', () => {
    const partners = createDefaultPartners();
    const goods = buildTradeGoodsView({
      productConfig: [
        { id: 'wood', name: 'Bois brut', sellingMax: 25, buyingMax: 0, exportEnabled: true },
        { id: 'figs', name: 'Figues', sellingMax: 0, buyingMax: 10, importEnabled: true },
      ],
      stats: {
        yearlyExports: { wood: 3 },
        yearlyImports: { figs: 2 },
      },
      stockByProductId: { wood: 5, figs: 1 },
      partners,
    });

    expect(goods).toHaveLength(2);
    expect(goods[0]).toMatchObject({
      id: 'wood',
      stock: 5,
      yearlyExport: 3,
      exportCap: 25,
      exportEnabled: true,
      maxImportUpTo: 0,
    });
    expect(goods[0].status).toContain('Export ON');
    expect(goods[1]).toMatchObject({
      id: 'figs',
      yearlyImport: 2,
      importCap: 10,
      partnerImportCapacity: 10,
      maxImportUpTo: 10,
      effectiveImportCap: 10,
      importEnabled: true,
      importUpTo: 10,
    });
    expect(goods[1].status).toContain('Import ON');
  });
});
