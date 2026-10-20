import { houseEnterprises } from '../../../src/shared/population/workforceQueries.js';
import { SOCIAL_CATEGORY } from '../../../src/shared/population/socialCategoryCatalog.js';
import { legalFormOf } from '../../../src/shared/accounting-catalog/LegalFormCatalog.js';

describe('the enterprises of a house, from its social category', () => {
  test('the administrators run a property company, the other houses a cooperative, and each tab opens on its only enterprise', () => {
    expect(houseEnterprises('House-Mayor')).toMatchObject({ defaultId: 'sci', enterprises: [{ id: 'sci', label: 'SCI', activity: 'rental' }] });
    expect(houseEnterprises('House-Red')).toMatchObject({ defaultId: 'cooperative', enterprises: [{ id: 'cooperative', activity: 'recipes' }] });
  });

  test('every enterprise a category declares has a legal form that says how it shares its result and what it calls it', () => {
    for (const category of Object.values(SOCIAL_CATEGORY)) {
      for (const enterprise of category.enterprises) {
        const form = legalFormOf(enterprise.id);
        expect(form.regime.shares.workers + form.regime.shares.associates + form.regime.shares.enterprise).toBeCloseTo(1, 10);
        expect(form.terms.dividend.paid).toEqual(expect.any(String));
      }
    }
  });

  test('a type that is no house has no enterprise to show: an error, not an empty tab', () => {
    expect(() => houseEnterprises('Farm-Wheat')).toThrow('declares no enterprise');
  });
});
