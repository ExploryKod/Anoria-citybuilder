import { describe, test, expect, beforeEach } from '@jest/globals';
import { LocalStorageFiscalSettingsRepository } from '../../../src/contexts/accounting/infrastructure/persistence/LocalStorageFiscalSettingsRepository.js';
import { defaultCustomsDuty, DEFAULT_CUSTOMS_DUTY } from '../../../src/contexts/accounting/domain/catalogs/FiscalRateCatalog.js';
import { listTradedGoods } from '../../../src/shared/trade-catalog/TradeCatalog.js';

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

/** The city's customs duties: one per traded good and per flow; the hamlets' rates live in their own rows (see hamletFiscalRates.test.js). */
describe('LocalStorageFiscalSettingsRepository — customs duties per good', () => {
  test('only Anoria\'s customs exist: another authority throws, and so does a duty asked for no turn', () => {
    const repo = new LocalStorageFiscalSettingsRepository(memoryStorage());
    repo.ensureCustomsDuties([{ good: 'coal', flows: ['import'] }]);
    expect(() => repo.getCustomsDuty('maris', 'import', 'coal', 0)).toThrow(/not modelled/);
    expect(() => repo.getCustomsDuty('anoria', 'import', 'coal')).toThrow(/no turn/);
  });

  let repo;

  beforeEach(() => {
    repo = new LocalStorageFiscalSettingsRepository(memoryStorage());
  });

  test('a duty is unknown until boot writes the catalog defaults', () => {
    expect(() => repo.getCustomsDuty('anoria', 'import', 'coal', 0)).toThrow(/not set/);
    repo.ensureCustomsDuties(listTradedGoods());
    expect(repo.getCustomsDuty('anoria', 'import', 'coal', 0)).toBe(defaultCustomsDuty('import', 'coal'));
    expect(repo.getCustomsDuty('anoria', 'export', 'wood', 0)).toBe(defaultCustomsDuty('export', 'wood'));
  });

  test('imports are taxed lightly and exports left free, but for the goods that stand apart', () => {
    expect(defaultCustomsDuty('import', 'coal')).toBeGreaterThan(DEFAULT_CUSTOMS_DUTY.import);
    expect(defaultCustomsDuty('export', 'wood')).toBeGreaterThan(DEFAULT_CUSTOMS_DUTY.export);
    expect(defaultCustomsDuty('export', 'oil')).toBe(DEFAULT_CUSTOMS_DUTY.export);
  });

  test('a good only has the flows the trade catalog gives it', () => {
    repo.ensureCustomsDuties(listTradedGoods());
    expect(() => repo.getCustomsDuty('anoria', 'export', 'coal', 0)).toThrow(/not a good this city trades/);
    expect(() => repo.getCustomsDuty('anoria', 'import', 'wood', 0)).toThrow(/not a good this city trades/);
  });

  test('a duty the player set survives the next boot, a good the table lacked gets its default', () => {
    repo.ensureCustomsDuties(listTradedGoods());
    repo.setCustomsDuty('import', 'coal', 0.45);
    repo.ensureCustomsDuties([...listTradedGoods(), { good: 'olive', flows: ['export'] }]);
    expect(repo.getCustomsDuty('anoria', 'import', 'coal', 0)).toBe(0.45);
    expect(repo.getCustomsDuty('anoria', 'export', 'olive', 0)).toBe(defaultCustomsDuty('export', 'olive'));
  });

  test('refuses a duty out of its bounds or for an unknown flow', () => {
    repo.ensureCustomsDuties(listTradedGoods());
    expect(() => repo.setCustomsDuty('import', 'coal', 2)).toThrow(/between 0 and 1/);
    expect(() => repo.setCustomsDuty('transit', 'coal', 0.1)).toThrow(/unknown customs flow/);
  });
});
