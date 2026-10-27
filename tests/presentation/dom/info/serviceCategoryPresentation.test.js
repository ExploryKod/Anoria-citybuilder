import { describe, expect, jest, test } from '@jest/globals';
import { getServiceCategoryDisplay } from '../../../../src/presentation/dom/info/presenters/formats/serviceCategoryPresentation.js';
import { getServiceCategories } from '../../../../src/shared/resource-catalog/ResourceCategoryCatalog.js';
import { getConsumerEntries } from '../../../../src/shared/building-catalog/resourceRoleQueries.js';

describe('the display of a service category', () => {
  test('every service a house is covered by is named: a new one cannot reach the player unnamed', () => {
    const covering = new Set(getConsumerEntries('House-Red').filter((entry) => entry.consumption === 'flag').flatMap((entry) => entry.categories));
    expect(covering.size).toBeGreaterThan(0);
    for (const category of covering) {
      expect(getServiceCategories()).toContain(category);
      expect(getServiceCategoryDisplay(category).label).not.toBe('…');
    }
  });

  test('a category it does not name shows as "…" with a warning, never a label made up from its id', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    expect(getServiceCategoryDisplay('futureService')).toEqual({ label: '…', emoji: '…' });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('[vocabulary]'));
    warn.mockRestore();
  });
});
