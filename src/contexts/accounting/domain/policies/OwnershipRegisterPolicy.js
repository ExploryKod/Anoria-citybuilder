import { stakeOf } from './CompanyAidPolicy.js';

/**
 * Who owns what (docs/gameplay/PLAN_OWNERSHIP.md), put together from what the journal and the buildings already say: nothing is stored. A party is
 * `{ kind: 'city' | 'building' | 'external' | 'central-bank', id?, name }`.
 *   - the companies: who holds their capital (the city, for now) and how much of the dividends it is entitled to (its stake);
 *   - the buildings: who owns each (a house, the property company; a company's premises, the company; any other building, the city);
 *   - the claims: every debt with its two sides, the creditor's claim and the debtor's debt, so a lender sees its receivable as the borrower sees its debt.
 * Amounts are in euros.
 */

const city = (name) => Object.freeze({ kind: 'city', name });
const building = (id, name) => Object.freeze({ kind: 'building', id, name });

/**
 * @param {object} input
 * @param {string} input.cityName
 * @param {string} input.centralBankName
 * @param {(buildingId: string) => string} input.nameOf the name of a building of the hamlet (throws for one that is gone)
 * @param {Array<{ id: string, name: string, kind: 'house' | 'company' | 'public' }>} input.buildings the buildings that can be owned (not the roads, not the nature)
 * @param {string | null} input.propertyOwnerId the house whose property company owns the houses, null when none stands
 * @param {Array<{ id: string, capital: number, cityShares: number, totalShares: number, privateHolders: Array<{ holderId: string, capital: number, shares: number }>, aidOutstanding: number, bankCredit: number }>} input.companies
 *   `cityShares`: the shares the city holds now; `privateHolders`: those it sold shares to (`capital`: what they paid)
 * @param {Array<{ id: string, name: string, residents: number }>} input.cooperatives the houses whose own business belongs to their residents
 * @param {string | null} input.bankId
 * @param {Array<{ id: string, type: string, amount: number, lenderBuildingId: string | null, lenderCityId?: string, lenderCityName?: string }>} input.cityLoans
 * @param {number} input.refinancing what the bank owes the central bank
 * @param {Array<{ houseId: string, amount: number }>} input.deposits the savings of the houses at the bank
 * @param {Array<{ creditorId: string, label: string, amount: number }>} input.stateArrears what the State owes
 * @param {Array<{ debtorId: string, creditorId: string | null, label: string, amount: number }>} input.payables what the companies owe (the creditor null: the city)
 * @returns {{ companies: Array<object>, buildings: Array<object>, claims: Array<object> }}
 */
export function ownershipRegisterOf(input) {
  const theCity = city(input.cityName);
  const party = (id) => (id === null ? theCity : building(id, input.nameOf(id)));

  const companies = input.companies.map((company) => ({
    id: company.id,
    name: input.nameOf(company.id),
    capital: company.capital,
    // The city paid the capital but what it sold to private holders; the stake is the share of the dividends a holder is entitled to (its shares over all the shares).
    shareholders: [
      {
        party: theCity,
        capital: company.capital - company.privateHolders.reduce((sum, holder) => sum + holder.capital, 0),
        share: company.capital > 0 ? (company.capital - company.privateHolders.reduce((sum, holder) => sum + holder.capital, 0)) / company.capital : 0,
        dividendStake: stakeOf({ shareholderShares: company.cityShares, totalShares: company.totalShares }),
      },
      ...company.privateHolders.map((holder) => ({
        party: party(holder.holderId),
        capital: holder.capital,
        share: company.capital > 0 ? holder.capital / company.capital : 0,
        dividendStake: stakeOf({ shareholderShares: holder.shares, totalShares: company.totalShares }),
      })),
    ],
  }));

  const buildings = input.buildings.map((entry) => {
    const owner = entry.kind === 'house'
      ? (input.propertyOwnerId ? building(input.propertyOwnerId, input.nameOf(input.propertyOwnerId)) : theCity)
      : entry.kind === 'company' ? building(entry.id, entry.name) : theCity;
    return { id: entry.id, name: entry.name, kind: entry.kind, owner };
  });

  const claims = [];
  const claim = (kind, label, creditor, debtor, amount) => {
    if (amount > 0) claims.push({ kind, label, creditor, debtor, amount });
  };
  for (const loan of input.cityLoans) {
    // Every loan names its lender: a bank of the game, or a city outside it. A loan that names neither is a defect, not an anonymous creditor.
    let creditor;
    if (loan.lenderBuildingId) creditor = party(loan.lenderBuildingId);
    else if (loan.lenderCityId) creditor = Object.freeze({ kind: 'external', id: loan.lenderCityId, name: loan.lenderCityName });
    else throw new Error(`[ownership] the loan ${loan.id} names no lender`);
    claim('city-loan', 'Prêt à la ville', creditor, theCity, loan.amount);
  }
  for (const company of input.companies) {
    if (input.bankId) claim('bank-credit', 'Crédit de la banque', party(input.bankId), party(company.id), company.bankCredit);
    claim('aid-loan', 'Prêt de la ville', theCity, party(company.id), company.aidOutstanding);
  }
  if (input.bankId) {
    claim('refinancing', 'Refinancement', Object.freeze({ kind: 'central-bank', name: input.centralBankName }), party(input.bankId), input.refinancing);
    for (const deposit of input.deposits) claim('savings', 'Épargne', party(deposit.houseId), party(input.bankId), deposit.amount);
  }
  for (const arrears of input.stateArrears) claim('state-arrears', arrears.label, party(arrears.creditorId), theCity, arrears.amount);
  for (const payable of input.payables) claim('payable', payable.label, party(payable.creditorId), party(payable.debtorId), payable.amount);

  // The business of a house is a cooperative: its residents share what it earns (CooperativeAllocationPolicy).
  const cooperatives = input.cooperatives.map((cooperative) => ({
    id: cooperative.id,
    name: cooperative.name,
    owners: `Les ${cooperative.residents} habitant${cooperative.residents > 1 ? 's' : ''} de la maison`,
  }));

  return { companies, buildings, cooperatives, claims };
}
