import { describe, test, expect } from '@jest/globals';
import {
  computeUnemploymentBenefitAmount,
  formatUnemploymentBenefitJournalDescription,
} from '../../../src/contexts/accounting/domain/policies/UnemploymentBenefitPolicy.js';

describe('UnemploymentBenefitPolicy', () => {
  test('computes monthly benefit from unemployed count and reference salary', () => {
    expect(
      computeUnemploymentBenefitAmount({
        unemployed: 4,
        salaryPerMonth: 100,
        benefitRate: 0.5,
      })
    ).toBe(200);
  });

  test('returns zero when there are no unemployed workers', () => {
    expect(
      computeUnemploymentBenefitAmount({
        unemployed: 0,
        salaryPerMonth: 100,
        benefitRate: 0.5,
      })
    ).toBe(0);
  });

  test('formats journal description for chomeur salaries', () => {
    expect(
      formatUnemploymentBenefitJournalDescription({
        monthName: 'Juin',
        yearDisplay: '0 JC',
        unemployedCount: 4,
        referenceSalaryPerMonth: 100,
        unemploymentBenefitRate: 0.5,
      })
    ).toBe('Salaires chômeurs - Juin 0 JC (4 chôm. × 100€ × 50%)');
  });
});
