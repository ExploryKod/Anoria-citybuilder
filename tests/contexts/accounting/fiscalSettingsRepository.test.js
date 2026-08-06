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

describe('LocalStorageFiscalSettingsRepository', () => {
  let repo;

  beforeEach(() => {
    repo = new LocalStorageFiscalSettingsRepository(memoryStorage());
  });

  test('defaults when empty', () => {
    expect(repo.getCitizenTaxPerCapita()).toBe(DEFAULT_FISCAL_SETTINGS.citizenTaxPerCapita);
    expect(repo.getSalarySettings()).toEqual({
      salaryPerMonth: DEFAULT_FISCAL_SETTINGS.salaryPerMonth,
      salaryTaxRate: DEFAULT_FISCAL_SETTINGS.salaryTaxRate,
      unemploymentBenefitRate: DEFAULT_FISCAL_SETTINGS.unemploymentBenefitRate,
    });
  });

  test('persists citizen tax and salary settings', () => {
    expect(repo.setCitizenTaxPerCapita(150)).toBe(150);
    expect(repo.getCitizenTaxPerCapita()).toBe(150);

    const salary = repo.setSalarySettings({
      salaryPerMonth: 120,
      salaryTaxRate: 0.25,
      unemploymentBenefitRate: 0.4,
    });
    expect(salary).toEqual({
      salaryPerMonth: 120,
      salaryTaxRate: 0.25,
      unemploymentBenefitRate: 0.4,
    });
    expect(repo.getSalarySettings()).toEqual(salary);
  });

  test('clamps out-of-range values', () => {
    expect(repo.setCitizenTaxPerCapita(9999)).toBe(1000);
    expect(repo.setSalarySettings({ salaryPerMonth: 1 }).salaryPerMonth).toBe(10);
    expect(repo.setSalarySettings({ salaryTaxRate: 2 }).salaryTaxRate).toBe(1);
    expect(repo.setSalarySettings({ unemploymentBenefitRate: 2 }).unemploymentBenefitRate).toBe(
      1
    );
  });
});
