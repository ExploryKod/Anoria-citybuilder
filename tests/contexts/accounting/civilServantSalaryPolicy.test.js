import { describe, test, expect } from '@jest/globals';
import {
  computeCitizenPayrollTaxBase,
  computeCivilServantSalaryExpense,
  computeCivilServantPayrollBreakdown,
} from '../../../src/contexts/accounting/domain/policies/CivilServantSalaryPolicy.js';

describe('CivilServantSalaryPolicy (legacy wrappers)', () => {
  test('computeCivilServantPayrollBreakdown delegates to reference salary policy', () => {
    expect(
      computeCivilServantPayrollBreakdown({
        population: 53,
        unemployed: 4,
        referenceSalaryPerMonth: 100,
        unemploymentBenefitRate: 0.5,
        salaryTaxRate: 0.2,
      })
    ).toMatchObject({
      civilServantCount: 4,
      payrollTaxBase: 5100,
      civilServantExpense: 400,
    });
  });

  test('deprecated helpers remain compatible when unemployment is zero', () => {
    expect(computeCivilServantSalaryExpense(53, 100)).toBe(400);
    expect(computeCitizenPayrollTaxBase(53, 100)).toBe(5300);
  });
});
