import { describe, test, expect } from '@jest/globals';
import { buildTradePartnersView } from '../../../src/contexts/commerce/application/queries/GetTradePartnersView.js';

describe('GetTradePartnersView', () => {
  test('builds partner cards with partner prices and yearly quotas', () => {
    const view = buildTradePartnersView({
      partners: [
        {
          id: 'olivea',
          name: 'Olivea',
          description: 'Test',
          isActive: true,
          buysFromUs: [
            {
              productId: 'wood',
              productName: 'Bois brut',
              months: [0],
              maxPerTurn: 1,
              yearlyQuota: 25,
              currentYearly: 2,
              pricePerUnit: 25,
            },
          ],
          sellsToUs: [
            {
              productId: 'figs',
              productName: 'Figues',
              months: [6],
              yearlyQuota: 10,
              currentYearly: 1,
              pricePerUnit: 14,
            },
          ],
        },
      ],
      stats: {
        yearlyExports: { wood: 1 },
        yearlyImports: { figs: 0 },
      },
      productConfig: [
        { id: 'wood', sellingMax: 25, buyingMax: 0 },
        { id: 'figs', sellingMax: 0, buyingMax: 10 },
      ],
      activationByPartnerId: {
        olivea: { canActivate: true, unmetConditions: [] },
      },
    });

    expect(view).toHaveLength(1);
    expect(view[0].buysFromUs[0].pricePerUnit).toBe(25);
    expect(view[0].sellsToUs[0].pricePerUnit).toBe(14);
    expect(view[0].buysFromUs[0].currentYearly).toBe(2);
  });
});
