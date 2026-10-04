import { describe, test, expect, beforeEach } from '@jest/globals';
import {
  LocalStorageFiscalSettingsRepository,
  DEFAULT_FISCAL_SETTINGS,
} from '../../../src/contexts/accounting/infrastructure/persistence/LocalStorageFiscalSettingsRepository.js';

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => {
      map.set(k, String(v));
    },
    removeItem: (k) => {
      map.delete(k);
    },
  };
}

/** The city's customs rate only: the hamlets' rates live in their own rows (see hamletFiscalRates.test.js). */
describe('LocalStorageFiscalSettingsRepository — customs', () => {
  let repo;

  beforeEach(() => {
    repo = new LocalStorageFiscalSettingsRepository(memoryStorage());
  });

  test('a missing customs rate throws until boot writes its default', () => {
    expect(() => repo.getCustomsRate()).toThrow(/not set/);
    repo.ensureCustomsRate();
    expect(repo.getCustomsRate()).toBe(DEFAULT_FISCAL_SETTINGS.customsRate);
  });

  test('persists the customs rate and refuses a value out of its bounds', () => {
    expect(repo.setCustomsRate(0.2)).toBe(0.2);
    expect(repo.getCustomsRate()).toBe(0.2);
    expect(() => repo.setCustomsRate(2)).toThrow(/between 0 and 0.5/);
  });
});
