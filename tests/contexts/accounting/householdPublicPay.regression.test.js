import { describe, test, expect } from '@jest/globals';
import { householdPublicPayOf } from '../../../src/contexts/accounting/domain/policies/HouseholdPublicPayPolicy.js';

// The city pays a household the benefit of its unemployed residents. Civil servants were removed
// (2026-10-10, "suppress it for now") — a resident is either a worker or unemployed, nothing in between.
describe('household public pay — the unemployed receive the benefit', () => {
  test('24 residents, 10 at work: 14 unemployed, at a 100 € reference and a 70 % benefit', () => {
    expect(householdPublicPayOf({ pop: 24, workers: 10, referenceSalaryPerMonth: 100, unemploymentBenefitRate: 0.7 })).toEqual({
      unemployed: 14,
      benefit: 980,
    });
  });
});
