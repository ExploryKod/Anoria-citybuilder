import { describe, test, expect } from '@jest/globals';
import {
  CITIZENS_PER_CIVIL_SERVANT,
  computeCivilServantCount,
  computeReferenceSalaryPayrollBreakdown,
  formatCivilServantSalaryJournalDescription,
  formatPayrollTaxJournalDescription,
} from '../../../src/contexts/accounting/domain/policies/ReferenceSalaryPayrollPolicy.js';

describe('ReferenceSalaryPayrollPolicy', () => {
  test('derives fonctionnaires, chômeurs and citoyens from reference salary', () => {
    const breakdown = computeReferenceSalaryPayrollBreakdown({
      population: 53,
      unemployed: 4,
      referenceSalaryPerMonth: 100,
      unemploymentBenefitRate: 0.5,
      salaryTaxRate: 0.2,
    });

    expect(breakdown.civilServantCount).toBe(4);
    expect(breakdown.unemployedCount).toBe(4);
    expect(breakdown.citizenCount).toBe(45);
    expect(breakdown.civilServantPayrollMass).toBe(400);
    expect(breakdown.unemploymentPayrollMass).toBe(200);
    expect(breakdown.citizenPayrollMass).toBe(4500);
    expect(breakdown.payrollTaxBase).toBe(5100);
    expect(breakdown.payrollTax).toBe(1020);
    expect(breakdown.cityExpenseTotal).toBe(600);
  });

  test('excludes élites from active citizen payroll mass', () => {
    const breakdown = computeReferenceSalaryPayrollBreakdown({
      population: 53,
      unemployed: 4,
      eliteCount: 3,
      referenceSalaryPerMonth: 100,
      unemploymentBenefitRate: 0.5,
      salaryTaxRate: 0.2,
    });

    expect(breakdown.civilServantCount).toBe(4);
    expect(breakdown.unemployedCount).toBe(4);
    expect(breakdown.citizenCount).toBe(42);
    expect(breakdown.citizenPayrollMass).toBe(4200);
    expect(breakdown.payrollTaxBase).toBe(4800);
  });

  test('uses one civil servant per twelve inhabitants', () => {
    expect(CITIZENS_PER_CIVIL_SERVANT).toBe(12);
    expect(computeCivilServantCount(53)).toBe(4);
    expect(computeCivilServantCount(12)).toBe(1);
  });

  test('formats journal lines from breakdown components', () => {
    const breakdown = computeReferenceSalaryPayrollBreakdown({
      population: 28,
      unemployed: 4,
      referenceSalaryPerMonth: 100,
      unemploymentBenefitRate: 0.5,
      salaryTaxRate: 0.2,
    });

    expect(
      formatCivilServantSalaryJournalDescription({
        monthName: 'Juin',
        yearDisplay: '0 JC',
        civilServantCount: breakdown.civilServantCount,
        referenceSalaryPerMonth: 100,
      })
    ).toBe('Salaires fonctionnaires - Juin 0 JC (2 fonct. × 100€)');

    expect(
      formatPayrollTaxJournalDescription({
        monthName: 'Juin',
        yearDisplay: '0 JC',
        salaryTaxRate: 0.2,
        breakdown,
      })
    ).toContain('assiette 2600€');
  });
});
