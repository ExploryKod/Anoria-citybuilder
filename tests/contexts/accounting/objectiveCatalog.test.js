import { describe, test, expect } from '@jest/globals';
import {
  OBJECTIVE_CATALOG,
  isObjectiveRequirementMet,
  getObjectiveFundThreshold,
} from '../../../src/contexts/accounting/domain/catalogs/ObjectiveCatalog.js';

describe('ObjectiveCatalog', () => {
  test('fund threshold is defined once in catalog', () => {
    expect(OBJECTIVE_CATALOG.budget_challenge_5000.fundThreshold).toBe(5000);
    expect(getObjectiveFundThreshold('budget_challenge_5000')).toBe(5000);
  });

  test('isObjectiveRequirementMet checks current funds against threshold', () => {
    expect(isObjectiveRequirementMet('budget_challenge_5000', { currentFunds: 4999 })).toBe(false);
    expect(isObjectiveRequirementMet('budget_challenge_5000', { currentFunds: 5000 })).toBe(true);
  });
});
