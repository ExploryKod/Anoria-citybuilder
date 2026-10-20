/**
 * What the city builds is booked against the account that says what it is: a holding in the property company that owns the buildings (261) when it stands, its own
 * building (2131) when it does not, a road (2151). The building enters the owner's books against its capital, so the two are not the same building counted twice.
 */
import { describe, test, expect } from '@jest/globals';
import { constructionAccountOf, constructionLegs } from '../../../src/contexts/accounting/domain/policies/ConstructionAccountPolicy.js';
import { assertBalanced, entryLegsOf } from '../../../src/contexts/accounting/domain/policies/EntryLegsPolicy.js';

describe('constructionAccountOf — the account of what the city builds', () => {
  test('a building is a holding in the owner while it stands, the city\'s own building when it does not', () => {
    expect(constructionAccountOf({ description: 'Building: Farm-Wheat', ownerStands: true })).toBe('261');
    expect(constructionAccountOf({ description: 'Building: Farm-Wheat', ownerStands: false })).toBe('2131');
  });

  test('what is not a building is a road of the city, owner or not', () => {
    expect(constructionAccountOf({ description: 'Route', ownerStands: true })).toBe('2151');
    expect(constructionAccountOf({ description: 'Route', ownerStands: false })).toBe('2151');
  });

  test('a refund goes back against the same account', () => {
    expect(constructionAccountOf({ description: 'Refund for Building: Farm-Wheat', refund: true, ownerStands: true })).toBe('261');
  });

  test('a writer that does not say whether the owner stands, or what it builds, is an error', () => {
    expect(() => constructionAccountOf({ description: 'Building: Farm-Wheat' })).toThrow(/owner of the buildings/);
    expect(() => constructionAccountOf({ ownerStands: true })).toThrow(/description/);
  });

  test('the legs the journal is given balance, and the journal books them', () => {
    const legs = constructionLegs('261', 30);

    expect(legs).toEqual([{ account: '261', debit: 3000, credit: 0 }, { account: '512', debit: 0, credit: 3000 }]);
    expect(() => assertBalanced(legs, 'construction')).not.toThrow();
    expect(entryLegsOf({ type: 'construction', amount: 30, accountBuildingId: null, legs }).legs).toEqual(legs);
    expect(constructionLegs('261', 30, true)[0]).toEqual({ account: '512', debit: 3000, credit: 0 });
  });
});
