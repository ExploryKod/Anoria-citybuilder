import { describe, test, expect, jest } from '@jest/globals';
import {
  UNRESOLVED_TERM,
  buildingName,
  goodAmount,
  namesOfBuildings,
  scheduleLabel,
} from '../../../src/presentation/dom/shell/CatalogVocabulary.js';

describe('CatalogVocabulary — words the catalog decides', () => {
  test('a building, a good and its unit are read from the catalog, the unit agreeing with the count', () => {
    expect(buildingName('Windmill-001')).toBe('Moulin');
    expect(goodAmount('wheat', 1)).toBe('1 panier');
    expect(goodAmount('wheat', 12)).toBe('12 paniers');
    expect(goodAmount('wood', 3)).toBe('3 bûches');
  });

  test('who holds a role for a good comes from the catalog: the windmill takes wheat, the warehouse does not', () => {
    expect(namesOfBuildings('hub', ['wheat'])).toEqual(['Moulin']);
    expect(namesOfBuildings('hub', ['wood'])).toEqual(['Entrepôt']);
  });

  test('a schedule is put in words from its own facts', () => {
    expect(scheduleLabel({ unit: 'always' })).toBe("Toute l'année");
    expect(scheduleLabel({ unit: 'month', values: ['december'] })).toBe('Décembre');
    expect(scheduleLabel({ unit: 'season', values: ['autumn'] })).toBe('Automne');
    expect(scheduleLabel({ unit: 'monthIndex', interval: 2, offset: 1 })).toBe('Tous les 2 mois');
  });

  test('a term the catalog does not give is "…", with a warning — never a made-up word', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    expect(buildingName('Not-A-Building')).toBe(UNRESOLVED_TERM);
    expect(goodAmount('not-a-good', 2)).toBe(`2 ${UNRESOLVED_TERM}`);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('[vocabulary]'));
    warn.mockRestore();
  });
});
