import { PERSONAL_ACCOUNT, BUSINESS_ACCOUNT } from './AccountKeyPolicy.js';

const centimes = (amount) => Math.round(amount * 100) / 100;

/**
 * How a cooperative (a house's own business) shares a month's surplus (see COOPERATIVE_SHARES): the residents' part (the participation, a charge
 * before the tax), the corporate tax on what is left, and the interest on the parts sociales, paid after the tax. The rest stays in the business as
 * reserves. Only a surplus is shared (a loss shares nothing and is not carried), and only what the business holds in cash can leave it: the
 * participation first, then the dividend after the tax is set aside.
 *
 * @param {object} params
 * @param {number} params.result the month's surplus before the participation and the tax: what the business sold less what it bought
 * @param {number} params.businessCash what the business account holds now
 * @param {{ workers: number, associates: number, enterprise: number }} params.shares
 * @param {number} params.corporateTaxRate a fraction
 * @returns {{ participation: number, corporateTax: number, dividend: number }}
 */
export function allocateCooperativeResult({ result, businessCash, shares, corporateTaxRate }) {
  if (!Number.isFinite(result) || !Number.isFinite(businessCash)) throw new Error(`[cooperative] the result and the cash must be numbers, got ${result} and ${businessCash}`);
  if (Math.abs(shares.workers + shares.associates + shares.enterprise - 1) > 1e-9) throw new Error('[cooperative] the three shares of a surplus must add up to one');
  if (!(result > 0)) return { participation: 0, corporateTax: 0, dividend: 0 };
  const cash = Math.max(0, businessCash);
  const participation = centimes(Math.min(result * shares.workers, cash));
  // The tax is due on what is left after the participation, even when the cash is short (the account then runs a deficit, like any company's).
  const corporateTax = centimes(Math.max(0, result - participation) * corporateTaxRate);
  const dividend = centimes(Math.min(result * shares.associates, Math.max(0, cash - participation - corporateTax)));
  return { participation, corporateTax, dividend };
}

/**
 * The journal lines of a cooperative's sharing: each part leaves the business account and, for the residents' two, reaches the house's personal
 * account; the tax reaches the city.
 * @param {{ houseId: string, participation: number, corporateTax: number, dividend: number }} sharing
 * @returns {Array<{ kind: string, amount: number, holder: string | null, counterparty: string | null, accountKind: string | null }>}
 */
export function cooperativeLines({ houseId, participation, corporateTax, dividend }) {
  const lines = [];
  if (participation > 0) {
    lines.push({ kind: 'cooperative_participation', amount: participation, holder: houseId, counterparty: houseId, accountKind: BUSINESS_ACCOUNT });
    lines.push({ kind: 'household_participation', amount: participation, holder: houseId, counterparty: houseId, accountKind: PERSONAL_ACCOUNT });
  }
  if (corporateTax > 0) {
    lines.push({ kind: 'corporate_tax', amount: corporateTax, holder: houseId, counterparty: null, accountKind: BUSINESS_ACCOUNT });
    lines.push({ kind: 'corporate_tax_revenue', amount: corporateTax, holder: null, counterparty: houseId, accountKind: null });
  }
  if (dividend > 0) {
    lines.push({ kind: 'cooperative_dividend', amount: dividend, holder: houseId, counterparty: houseId, accountKind: BUSINESS_ACCOUNT });
    lines.push({ kind: 'household_dividend', amount: dividend, holder: houseId, counterparty: houseId, accountKind: PERSONAL_ACCOUNT });
  }
  return lines;
}
