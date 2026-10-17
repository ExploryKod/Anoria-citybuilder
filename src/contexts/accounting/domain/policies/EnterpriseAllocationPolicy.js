import { PERSONAL_ACCOUNT } from './AccountKeyPolicy.js';

const centimes = (amount) => Math.round(amount * 100) / 100;

/**
 * How an enterprise of a house shares its result, by the rule of its legal form (`regime` of LegalFormCatalog.js): the residents' part (the
 * participation, a charge before the tax), the corporate tax on what is left (when the form is taxed), and what the associates are paid, after the
 * tax. The rest stays in the business as reserves. Only a surplus is shared (a loss shares nothing and is not carried), and only what the business holds
 * in cash can leave it: the participation first, then the dividend after the tax is set aside.
 *
 * @param {object} params
 * @param {number} params.result the surplus before the participation and the tax: what the business took in less what it spent
 * @param {number} params.businessCash what the business account holds now
 * @param {{ workers: number, associates: number, enterprise: number }} params.shares
 * @param {number} params.corporateTaxRate a fraction, the rate in force; 0 for a form that is not taxed
 * @returns {{ participation: number, corporateTax: number, dividend: number }}
 */
export function allocateEnterpriseResult({ result, businessCash, shares, corporateTaxRate }) {
  if (!Number.isFinite(result) || !Number.isFinite(businessCash)) throw new Error(`[enterprise] the result and the cash must be numbers, got ${result} and ${businessCash}`);
  if (Math.abs(shares.workers + shares.associates + shares.enterprise - 1) > 1e-9) throw new Error('[enterprise] the three shares of a result must add up to one');
  if (!(result > 0)) return { participation: 0, corporateTax: 0, dividend: 0 };
  const cash = Math.max(0, businessCash);
  const participation = centimes(Math.min(result * shares.workers, cash));
  // The tax is due on what is left after the participation, even when the cash is short (the account then runs a deficit, like any company's).
  const corporateTax = centimes(Math.max(0, result - participation) * corporateTaxRate);
  const dividend = centimes(Math.min(result * shares.associates, Math.max(0, cash - participation - corporateTax)));
  return { participation, corporateTax, dividend };
}

/**
 * The journal lines of an enterprise's sharing: each part leaves its business account and, for the residents' two, reaches the house's personal
 * account; the tax reaches the city. `businessAccount` is the account of the enterprise that shares (see businessAccountOf).
 * @param {{ houseId: string, businessAccount: string, participation: number, corporateTax: number, dividend: number }} sharing
 * @returns {Array<{ kind: string, amount: number, holder: string | null, counterparty: string | null, accountKind: string | null }>}
 */
export function enterpriseLines({ houseId, businessAccount, participation, corporateTax, dividend }) {
  if (typeof businessAccount !== 'string') throw new Error(`[enterprise] the sharing of ${houseId} needs the business account of the enterprise that shares`);
  const lines = [];
  if (participation > 0) {
    lines.push({ kind: 'enterprise_participation', amount: participation, holder: houseId, counterparty: houseId, accountKind: businessAccount });
    lines.push({ kind: 'household_participation', amount: participation, holder: houseId, counterparty: houseId, accountKind: PERSONAL_ACCOUNT });
  }
  if (corporateTax > 0) {
    lines.push({ kind: 'corporate_tax', amount: corporateTax, holder: houseId, counterparty: null, accountKind: businessAccount });
    lines.push({ kind: 'corporate_tax_revenue', amount: corporateTax, holder: null, counterparty: houseId, accountKind: null });
  }
  if (dividend > 0) {
    lines.push({ kind: 'enterprise_dividend', amount: dividend, holder: houseId, counterparty: houseId, accountKind: businessAccount });
    lines.push({ kind: 'household_dividend', amount: dividend, holder: houseId, counterparty: houseId, accountKind: PERSONAL_ACCOUNT });
  }
  return lines;
}
