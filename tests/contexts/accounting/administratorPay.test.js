import { administratorPayStatusOf } from '../../../src/contexts/accounting/domain/policies/AdministratorPayPolicy.js';

describe('administrators stipend against the cost of living', () => {
  test('a stipend under the cost of living is too low, at or over it is not', () => {
    expect(administratorPayStatusOf({ stipend: 5, costOfLiving: 5.8 })).toEqual({ known: true, tooLow: true, floor: 5.8 });
    expect(administratorPayStatusOf({ stipend: 6, costOfLiving: 5.8 })).toEqual({ known: true, tooLow: false, floor: 5.8 });
  });

  test('an unknown cost of living judges nothing, it is not guessed', () => {
    expect(administratorPayStatusOf({ stipend: 1, costOfLiving: null })).toEqual({ known: false, tooLow: false, floor: null });
  });
});
