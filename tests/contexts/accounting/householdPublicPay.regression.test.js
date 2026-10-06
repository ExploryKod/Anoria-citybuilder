import { describe, test, expect } from '@jest/globals';
import { householdPublicPayOf } from '../../../src/contexts/accounting/domain/policies/HouseholdPublicPayPolicy.js';

// The city pays a household the civil servants it gives, and the benefit of its unemployed residents.
describe('household public pay — civil servants are paid by the city, the unemployed receive the benefit', () => {
  test('24 residents, 10 at work: 2 civil servants and 12 unemployed, at a 100 € reference and a 70 % benefit', () => {
    expect(householdPublicPayOf({ pop: 24, workers: 10, referenceSalaryPerMonth: 100, unemploymentBenefitRate: 0.7 })).toEqual({
      civilServants: 2,
      unemployed: 12,
      publicPay: 200,
      benefit: 840,
    });
  });
});
