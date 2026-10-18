/**
 * Naming policy — journal lines that look like income/expense but do NOT move treasury.
 *
 * Convention:
 * - `type`: `info_{sourceType}` (e.g. `info_loan_interest`)
 * - `businessKey`: `info:{sourceType}:{entityId}:{turn}`
 * - UI label: explicit « informatif » (+ nature impayée le cas échéant)
 * - `description`: prefixed with `[Informatif]`
 */

/** Prefix for pseudo-movement journal types (no treasury). */
export const INFO_JOURNAL_TYPE_PREFIX = 'info_';

/** Prefix for idempotence keys of pseudo-movements. */
export const INFO_BUSINESS_KEY_PREFIX = 'info';

const INFO_SOURCE_TYPES = new Set(['loan_interest', 'loan_repayment']);

/** @param {string} type */
export function isInfoPseudoMovementType(type) {
  return typeof type === 'string' && type.startsWith(INFO_JOURNAL_TYPE_PREFIX);
}

/**
 * @param {'loan_interest' | 'loan_repayment'} sourceType
 * @returns {string}
 */
export function infoJournalTypeFor(sourceType) {
  return `${INFO_JOURNAL_TYPE_PREFIX}${sourceType}`;
}

/**
 * @param {string} infoType — e.g. `info_loan_interest`
 * @returns {string|null}
 */
export function sourceTypeFromInfoJournalType(infoType) {
  if (!isInfoPseudoMovementType(infoType)) {
    return null;
  }
  const source = infoType.slice(INFO_JOURNAL_TYPE_PREFIX.length);
  return INFO_SOURCE_TYPES.has(source) ? source : source;
}

/**
 * @param {'loan_interest' | 'loan_repayment'} sourceType
 * @param {string} entityId
 * @param {number} turn
 * @returns {string|null}
 */
export function buildInfoMovementBusinessKey(sourceType, entityId, turn) {
  if (!INFO_SOURCE_TYPES.has(sourceType)) {
    return null;
  }
  if (!entityId || typeof turn !== 'number' || Number.isNaN(turn)) {
    return null;
  }
  return `${INFO_BUSINESS_KEY_PREFIX}:${sourceType}:${entityId}:${turn}`;
}

/** Display labels keyed by info journal type. */
export const INFO_JOURNAL_TYPE_LABELS = {
  info_loan_interest: 'Intérêts prêt (informatif — impayé)',
  info_loan_repayment: 'Capital prêt (informatif — impayé)',
  // A house's rent for the month, whether or not it could pay it: the debt of a house is what is due less what it paid (see RentDebtPolicy).
  info_rent_due: 'Loyer dû (informatif)',
  // The month's closing (opérations diverses): no money moves, the lines say what the books must show.
  od_stock_up_merchandise: 'Variation de stock : le stock grandit (OD)',
  od_stock_down_merchandise: 'Variation de stock : le stock baisse (OD)',
  od_stock_up_production: 'Production stockée : le stock grandit (OD)',
  od_stock_down_production: 'Production stockée : le stock baisse (OD)',
  od_depreciation: 'Dotation aux amortissements (OD)',
  od_payable_wage: 'Salaires dus non payés (OD)',
  od_payable_contribution: 'Cotisations dues non payées (OD)',
  od_payable_corporate_tax: 'Impôt dû non payé (OD)',
  od_payable_premises_rent: 'Loyer du local dû non payé (OD)',
  od_receivable_premises_rent: 'Loyer du local à encaisser (OD)',
  od_forgiven_wage: 'Salaires dus abandonnés à la liquidation (OD)',
  od_forgiven_contribution: 'Cotisations dues abandonnées à la liquidation (OD)',
  od_forgiven_corporate_tax: 'Impôt dû abandonné à la liquidation (OD)',
  od_forgiven_premises_rent: 'Loyer du local dû abandonné à la liquidation (OD)',
  od_bad_debt_contribution: 'Cotisations irrécouvrables (OD)',
  od_bad_debt_corporate_tax: 'Impôt irrécouvrable (OD)',
  od_bad_debt_premises_rent: 'Loyer du local irrécouvrable (OD)',
  od_asset_contribution: 'Apport de constructions par la ville (OD)',
  od_asset_disposal_amortization: 'Sortie d’actif : amortissement soldé (OD)',
  od_asset_disposal_loss: 'Sortie d’actif : valeur nette perdue (OD)',
  // The rent debt of a house its inhabitants all left: the owner knows it will not be paid (no prosecution in the game), so the debt is written off.
  info_rent_written_off: 'Loyer impayé abandonné (informatif)',
  // What a building's spoiled goods would have sold for: a loss of opportunity, never a charge, so it moves no money.
  info_goods_spoiled: 'Avarie — manque à gagner (informatif)',
  // The day a company was liquidated: from then on it is closed (see LiquidationPolicy).
  info_company_liquidated: 'Entreprise liquidée (informatif)',
};

/**
 * @param {string} infoType
 * @returns {string}
 */
export function labelForInfoJournalType(infoType) {
  return INFO_JOURNAL_TYPE_LABELS[infoType] ?? `[Informatif] ${infoType}`;
}

/**
 * @param {'loan_interest' | 'loan_repayment'} sourceType
 * @param {string} detail — free text after the dash
 * @returns {string}
 */
export function formatInfoMovementDescription(sourceType, detail) {
  const head =
    sourceType === 'loan_interest'
      ? 'Intérêts prêt'
      : sourceType === 'loan_repayment'
        ? 'Capital prêt'
        : sourceType;
  return `[Informatif] ${head} — ${detail}`;
}
