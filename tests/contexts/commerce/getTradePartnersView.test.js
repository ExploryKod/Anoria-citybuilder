import { describe, test, expect } from '@jest/globals';
import { buildTradePartnersView } from '../../../src/contexts/commerce/application/queries/GetTradePartnersView.js';

describe('GetTradePartnersView', () => {
  test('builds partner cards with partner prices and yearly quotas', () => {
    const view = buildTradePartnersView({
      partners: [
        {
          id: 'deserta',
          name: 'Deserta',
          description: 'Test',
          isActive: true,
          imports: [
            {
              productId: 'carrot',
              productName: 'Carotte',
              months: [7],
              maxPerTurn: 8,
              maxOccurrences: 9,
              currentYearly: 2,
              pricePerUnit: 18,
            },
          ],
          exports: [
            {
              productId: 'dattes',
              productName: 'Dattes',
              months: [0],
              maxOccurrences: 2,
              currentYearly: 1,
              pricePerUnit: 12,
            },
          ],
        },
      ],
      stats: {
        yearlyExports: { carrot: 1 },
        yearlyImports: { dattes: 0 },
      },
      productConfig: [
        { id: 'carrot', sellingMax: 8, buyingMax: 400 },
        { id: 'dattes', sellingMax: 0, buyingMax: 200 },
      ],
      hasCommercializableWindmills: true,
      activationByPartnerId: {
        deserta: { canActivate: true, unmetConditions: [] },
      },
    });

    expect(view).toHaveLength(1);
    expect(view[0].buysFromUs[0].pricePerUnit).toBe(18);
    expect(view[0].sellsToUs[0].pricePerUnit).toBe(12);
    expect(view[0].buysFromUs[0].currentYearly).toBe(2);
  });
});
