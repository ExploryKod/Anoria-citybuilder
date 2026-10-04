/**
 * Regression guard for the fiscal rates: each hamlet holds its own, read from its row, and a rate that is
 * missing or out of bounds is an error, never a stand-in.
 */

import Dexie from 'dexie';
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { HamletFiscalRateRepository } from '../../../src/contexts/accounting/infrastructure/persistence/HamletFiscalRateRepository.js';
import { DEFAULT_HAMLET_FISCAL_RATES } from '../../../src/contexts/accounting/domain/catalogs/FiscalRateCatalog.js';
import { TEST_HAMLET_ID } from '../../helpers/testHamlet.js';

describe('HamletFiscalRateRepository', () => {
  let testDb;
  let repo;

  beforeEach(async () => {
    testDb = new Dexie('testHamletFiscalRatesDb');
    testDb.version(1).stores({ hamlets: 'id' });
    await testDb.open();
    await testDb.hamlets.put({ id: TEST_HAMLET_ID, slug: 'eraanurbs', name: 'Anoria' });
    repo = new HamletFiscalRateRepository(testDb);
  });

  afterEach(async () => {
    testDb.close();
    await Dexie.delete('testHamletFiscalRatesDb');
  });

  test('a hamlet with no rate throws: nothing stands in for it', async () => {
    await expect(repo.getCitizenTaxPerCapita()).rejects.toThrow(/has no citizenTaxPerCapita/);
  });

  test('ensureRates writes the defaults once, then keeps what was set', async () => {
    await repo.ensureRates(TEST_HAMLET_ID);
    expect(await repo.getCitizenTaxPerCapita()).toBe(DEFAULT_HAMLET_FISCAL_RATES.citizenTaxPerCapita);

    await repo.setCitizenTaxPerCapita(150);
    await repo.ensureRates(TEST_HAMLET_ID);
    expect(await repo.getCitizenTaxPerCapita()).toBe(150);
  });

  test('a value out of its bounds is refused, not clamped', async () => {
    await repo.ensureRates(TEST_HAMLET_ID);
    await expect(repo.setCitizenTaxPerCapita(9999)).rejects.toThrow(/between 0 and 1000/);
    await expect(repo.setSalarySettings({ salaryTaxRate: 2 })).rejects.toThrow(/between 0 and 1/);
  });
});
