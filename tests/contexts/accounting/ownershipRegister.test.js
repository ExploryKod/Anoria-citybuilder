import { describe, test, expect } from '@jest/globals';
import { ownershipRegisterOf } from '../../../src/contexts/accounting/domain/policies/OwnershipRegisterPolicy.js';

// Who owns what: the city its public buildings and the capital of its companies, the property company the houses, and every debt shows both its creditor and its debtor.
const names = { bank: 'Banque', farm: 'Ferme', mayor: 'Maison du maire', house: 'Maison', school: 'École' };
const base = {
  cityName: 'La ville',
  centralBankName: 'Banque centrale',
  nameOf: (id) => names[id] ?? (() => { throw new Error(`no name for ${id}`); })(),
  buildings: [
    { id: 'house', name: 'Maison', kind: 'house' }, { id: 'farm', name: 'Ferme', kind: 'company' }, { id: 'school', name: 'École', kind: 'public' },
  ],
  propertyOwnerId: 'mayor',
  companies: [{ id: 'farm', capital: 400, cityShares: 1, totalShares: 4, privateHolders: [{ holderId: 'mayor', capital: 100, shares: 1 }], aidOutstanding: 100, bankCredit: 50 }],
  cooperatives: [{ id: 'house', name: 'Maison', residents: 3 }],
  bankId: 'bank',
  cityLoans: [
    { id: 'l1', type: 'bank', amount: 500, lenderBuildingId: 'bank' },
    { id: 'l2', type: 'external', amount: 800, lenderBuildingId: null, lenderCityId: 'olivea', lenderCityName: 'Olivea' },
  ],
  refinancing: 200,
  deposits: [{ houseId: 'house', amount: 60 }],
  stateArrears: [],
  payables: [],
};

describe('the ownership register', () => {
  test('who owns the buildings and the companies', () => {
    const { buildings, companies } = ownershipRegisterOf(base);
    expect(Object.fromEntries(buildings.map((b) => [b.id, b.owner.name]))).toEqual({ house: 'Maison du maire', farm: 'Ferme', school: 'La ville' });
    // The city paid 400 but sold a quarter of the capital's worth to the property company: each holds the dividends its shares give.
    expect(companies[0].shareholders.map((holder) => [holder.party.name, holder.capital, holder.dividendStake])).toEqual([['La ville', 300, 0.25], ['Maison du maire', 100, 0.25]]);
    expect(ownershipRegisterOf(base).cooperatives[0].owners).toBe('Les 3 habitants de la maison');
  });

  test('every debt shows its creditor and its debtor, a lender outside the game by its city', () => {
    const { claims } = ownershipRegisterOf(base);
    const loan = claims.filter((c) => c.kind === 'city-loan').map((c) => [c.creditor.name, c.debtor.name, c.amount]);
    expect(loan).toEqual([['Banque', 'La ville', 500], ['Olivea', 'La ville', 800]]);
    expect(claims.find((c) => c.kind === 'refinancing')).toMatchObject({ creditor: { name: 'Banque centrale' }, debtor: { name: 'Banque' }, amount: 200 });
    expect(claims.find((c) => c.kind === 'savings')).toMatchObject({ creditor: { name: 'Maison' }, debtor: { name: 'Banque' } });
  });

  test('a loan that names no lender is a defect, never an anonymous creditor', () => {
    expect(() => ownershipRegisterOf({ ...base, cityLoans: [{ id: 'l3', type: 'bank', amount: 1, lenderBuildingId: null }] })).toThrow(/names no lender/);
  });
});
