/**
 * Hub panel — the short summary under the pie: capacity, how long the stock lasts, what is old.
 */
import { describe, test, expect } from '@jest/globals';
import { formatHubStockSummary } from '../../../../src/presentation/dom/info/presenters/formats/hubStorageInfoFormat.js';

describe('formatHubStockSummary', () => {
  test('always says how full the hub is', () => {
    expect(formatHubStockSummary({ currentTotal: 670, totalCapacity: 2880 })).toEqual(['📦 670 / 2880']);
  });

  test('says how many months the stock lasts once the hub has been drawn on', () => {
    const lines = formatHubStockSummary({ currentTotal: 670, totalCapacity: 2880, autonomyMonths: 6 });
    expect(lines).toContain('⏳ Tient environ 6 mois');
  });

  test('says less than a month rather than "0 mois"', () => {
    const lines = formatHubStockSummary({ currentTotal: 100, totalCapacity: 2880, autonomyMonths: 0 });
    expect(lines).toContain('⏳ Tient moins d\'un mois');
  });

  test('says nothing about autonomy while nothing has left the hub', () => {
    const lines = formatHubStockSummary({ currentTotal: 670, totalCapacity: 2880, autonomyMonths: null });
    expect(lines.some((line) => line.includes('Tient'))).toBe(false);
  });

  test('mentions what is left of the previous harvests, only when there is some', () => {
    const withOld = formatHubStockSummary({ currentTotal: 1450, totalCapacity: 2880, carryOverTotal: 10 });
    expect(withOld).toContain('🗓️ dont 10 des récoltes précédentes');
    const none = formatHubStockSummary({ currentTotal: 1440, totalCapacity: 2880, carryOverTotal: 0 });
    expect(none.some((line) => line.includes('précédentes'))).toBe(false);
  });

  describe('against the next harvest', () => {
    const view = (autonomyMonths, harvestInMonths) => ({ currentTotal: 670, totalCapacity: 2880, autonomyMonths, harvestInMonths });

    test('says when the next harvest comes', () => {
      expect(formatHubStockSummary(view(6, 5))).toContain('🌾 Récolte dans 5 mois');
      expect(formatHubStockSummary(view(6, 1))).toContain('🌾 Récolte le mois prochain');
    });

    test('reassures when the stock reaches the harvest', () => {
      // The harvest of the coming tick lands before that tick's meal: 5 months off needs 4 meals covered.
      expect(formatHubStockSummary(view(4, 5))).toContain('✅ Tient jusqu\'à la récolte');
      expect(formatHubStockSummary(view(6, 5))).toContain('✅ Tient jusqu\'à la récolte');
    });

    test('warns, with how many months will be short, when it does not', () => {
      expect(formatHubStockSummary(view(2, 5))).toContain('⚠️ Il manquera environ 2 mois avant la récolte');
      expect(formatHubStockSummary(view(0, 2))).toContain('⚠️ Il manquera environ 1 mois avant la récolte');
    });

    test('an empty hub says so, instead of reassuring about a harvest still to come', () => {
      const lines = formatHubStockSummary({ buildingType: 'Windmill-001', currentTotal: 0, totalCapacity: 2880, autonomyMonths: 0, harvestInMonths: 1 });
      // The hub is named as the catalog names it: another hub type says its own name.
      expect(lines).toContain('⚠️ Moulin vide');
      expect(formatHubStockSummary({ buildingType: 'Warehouse', currentTotal: 0, totalCapacity: 500, harvestInMonths: 1 })).toContain('⚠️ Entrepôt vide');
      expect(lines.some((line) => line.includes('✅'))).toBe(false);
    });

    test('says nothing about the harvest when it is unknown, and no verdict without a pace', () => {
      expect(formatHubStockSummary(view(6, null)).some((line) => line.includes('écolte'))).toBe(false);
      const noPace = formatHubStockSummary(view(null, 5));
      expect(noPace).toContain('🌾 Récolte dans 5 mois');
      expect(noPace.some((line) => line.includes('✅') || line.includes('⚠️'))).toBe(false);
    });
  });
});

