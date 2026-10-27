/**
 * Regression guard for the fiscal rates: each hamlet holds its own, read from its row, and a rate that is
 * missing or out of bounds is an error, never a stand-in.
 */

import Dexie from 'dexie';
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { HamletFiscalRateRepository } from '../../../src/contexts/accounting/infrastructure/persistence/HamletFiscalRateRepository.js';
import { DEFAULT_COMPANY_AID } from '../../../src/contexts/accounting/domain/catalogs/CompanyAidCatalog.js';
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
    await expect(repo.setSalarySettings({ salaryTaxRate1: 2 })).rejects.toThrow(/between 0 and 1/);
  });

  test('the aid policy binds the hamlet for the years the player chose: it cannot be changed before, and can after', async () => {
    await repo.ensureRates(TEST_HAMLET_ID);
    // Nothing chosen yet: the catalog's policy stands and the player may set his own.
    expect((await repo.getCompanyAid()).committedUntilYear).toBeNull();
    const policy = { ...DEFAULT_COMPANY_AID, loanShare: 0.5, loanInterestRate: 0.04, commitmentYears: 3 };

    const written = await repo.setCompanyAid(policy, 1);

    expect(written.committedUntilYear).toBe(4);
    await expect(repo.setCompanyAid({ ...policy, loanShare: 0.1 }, 3)).rejects.toThrow(/binds the hamlet until year 4/);
    expect((await repo.getCompanyAid()).policy.loanShare).toBe(0.5);
    // Once the commitment is over, a new policy is accepted and commits again.
    expect((await repo.setCompanyAid({ ...policy, loanShare: 0.1, commitmentYears: 2 }, 4)).committedUntilYear).toBe(6);
  });

  test('an aid policy out of its bounds, or whose shares leave nothing for the participation, is refused', async () => {
    await repo.ensureRates(TEST_HAMLET_ID);
    await expect(repo.setCompanyAid({ ...DEFAULT_COMPANY_AID, commitmentYears: 1 }, 1)).rejects.toThrow(/between 2 and 8/);
    await expect(repo.setCompanyAid({ ...DEFAULT_COMPANY_AID, loanShare: 0.8, shareholderShare: 0.4 }, 1)).rejects.toThrow(/leave nothing/);
  });
});
