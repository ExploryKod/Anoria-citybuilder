/**
 * The M57 account the city books what it builds against (or the refund of it). What the city pays for a building it holds through the property company that owns
 * every building (the SCI) is a holding in that company (261, titres de participation): the building enters the SCI's books against its capital (see
 * CloseMonthAccounts), so the city's assets and the SCI's are not the same building counted twice when the accounts are consolidated. With no owner standing, the
 * building is the city's own (2131, bâtiments publics). What is not a building (a road) is the city's own network (2151, réseaux de voirie).
 */

import { BUILDING_INVESTMENT_MARKERS, REFUND_INVESTMENT_MARKERS, isBuildingInvestment } from './TreasuryFromJournalPolicy.js';

/**
 * @param {{ description: string, refund?: boolean, ownerStands: boolean }} construction `ownerStands`: whether the property company that owns the buildings exists
 * @returns {'261' | '2131' | '2151'} the account the city's construction (or its refund) is booked against
 */
export function constructionAccountOf({ description, refund = false, ownerStands }) {
  if (typeof description !== 'string') throw new Error('[construction] a construction line needs its description, which says whether it is a building');
  if (typeof ownerStands !== 'boolean') throw new Error('[construction] a construction line must be told whether the owner of the buildings stands');
  if (!isBuildingInvestment(description, refund ? REFUND_INVESTMENT_MARKERS : BUILDING_INVESTMENT_MARKERS)) return '2151';
  return ownerStands ? '261' : '2131';
}

/**
 * @param {string} account the account of the construction
 * @param {number} amount euros, a whole number
 * @param {boolean} refund true for money coming back
 * @returns {Array<{ account: string, debit: number, credit: number }>} the legs, in centimes
 */
export function constructionLegs(account, amount, refund = false) {
  const centimes = Math.round(amount * 100);
  return refund
    ? [{ account: '512', debit: centimes, credit: 0 }, { account, debit: 0, credit: centimes }]
    : [{ account, debit: centimes, credit: 0 }, { account: '512', debit: 0, credit: centimes }];
}
