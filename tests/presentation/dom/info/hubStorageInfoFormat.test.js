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
});
