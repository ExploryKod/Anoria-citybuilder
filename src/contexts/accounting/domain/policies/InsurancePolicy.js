import { MONTHS_PER_YEAR } from '../../../../shared/time/TimeCalendar.js';
import { INSURANCE_SERVICE } from '../../../../shared/accounting-catalog/InsuranceCatalog.js';

/**
 * The insurance of the households, read from the journal and nothing else (see InsuranceCatalog.js for the rules). A premium is a household's
 * `service_purchase` of the service `INSURANCE_SERVICE` from a company; whose members a household is, and since when, is what these lines say.
 */

/**
 * The month a premium was settled for: the settlement of a month dates its lines on the first turn of the next one, so a line stamped with month M was settled for M - 1.
 * @param {{ year: number, month: number }} entry a journal line stamped with its fiscal year and its month (1 to 12)
 * @returns {number} months counted from year 0, the same count as `monthKey` of `membershipOf`
 */
const monthKeyOf = (entry) => entry.year * MONTHS_PER_YEAR + (entry.month - 1) - 1;

/**
 * The months each household paid a premium to each company.
 * @param {Array<{ type: string, resource?: string | null, year?: number, month?: number, accountBuildingId?: string | null, counterpartyBuildingId?: string | null }>} entries
 * @returns {Map<string, Map<string, Set<number>>>} by household, by company, the month keys paid
 */
export function premiumsPaidOf(entries) {
  const byHouse = new Map();
  for (const entry of entries) {
    if (entry.type !== 'service_purchase' || entry.resource !== INSURANCE_SERVICE) continue;
    if (!entry.accountBuildingId || !entry.counterpartyBuildingId || typeof entry.year !== 'number' || typeof entry.month !== 'number') {
      throw new Error(`[insurance] a premium line carries no household, company or month (turn ${entry.turn}): the affiliation cannot be read`);
    }
    const byCompany = byHouse.get(entry.accountBuildingId) ?? new Map();
    byHouse.set(entry.accountBuildingId, byCompany);
    const months = byCompany.get(entry.counterpartyBuildingId) ?? new Set();
    byCompany.set(entry.counterpartyBuildingId, months);
    months.add(monthKeyOf(entry));
  }
  return byHouse;
}

/**
 * The company a household is a member of for a month, and whether it is covered: the company it paid the month before, among the ones that stand, and the
 * number of premiums in a row it has paid it (the waiting period is that many months).
 * @param {Map<string, Set<number>> | undefined} paidByCompany the months a household paid, by company
 * @param {number} monthKey the month settled
 * @param {number} waitingMonths
 * @param {Set<string>} standing the ids of the companies that stand
 * @returns {{ companyId: string | null, covered: boolean }}
 */
export function membershipOf(paidByCompany, monthKey, waitingMonths, standing) {
  if (paidByCompany) {
    for (const [companyId, months] of paidByCompany) {
      if (!standing.has(companyId) || !months.has(monthKey - 1)) continue;
      let streak = 0;
      while (months.has(monthKey - 1 - streak)) streak += 1;
      return { companyId, covered: streak >= waitingMonths };
    }
  }
  return { companyId: null, covered: false };
}

/**
 * The company a household with no company joins: the one that holds the most per member (its reserve over its members, the newcomer counted), the
 * first of the list when equal. Every company is the household's choice only if it can pay its premium.
 * @param {Array<{ id: string, reserve: number, members: number }>} companies in catalog order
 * @returns {string | null}
 */
export function companyToJoin(companies) {
  let best = null;
  for (const company of companies) {
    const perMember = company.reserve / (company.members + 1);
    if (best === null || perMember > best.perMember) best = { id: company.id, perMember };
  }
  return best && best.id;
}

/**
 * What an insurer pays its members for a month: their claims, whole when its reserve covers them, otherwise shared in proportion to each claim so that it never
 * pays more than it holds. Sums are in centimes, the last claim takes what the rounding left.
 * @param {Array<{ houseId: string, amount: number }>} claims in euros
 * @param {number} reserve what the company holds, in euros
 * @returns {Array<{ houseId: string, amount: number }>} in euros, to the centime
 */
export function claimsPaidOf(claims, reserve) {
  const wanted = claims.reduce((sum, claim) => sum + Math.round(claim.amount * 100), 0);
  const available = Math.max(0, Math.round(reserve * 100));
  const payable = Math.min(wanted, available);
  let given = 0;
  return claims.map((claim, index) => {
    const share = index === claims.length - 1
      ? payable - given
      : Math.round((Math.round(claim.amount * 100) * payable) / (wanted || 1));
    given += share;
    return { houseId: claim.houseId, amount: share / 100 };
  });
}
