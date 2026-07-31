/** Strip embedded breakdown JSON from legacy descriptions. */
export function stripBreakdownMarkup(description) {
  if (!description) {
    return '';
  }
  return description.replace(/\|BREAKDOWN\|.*?\|BREAKDOWN\|/, '').trim();
}

const MONTH_NAMES =
  'Janvier|Février|Mars|Avril|Mai|Juin|Juillet|Août|Septembre|Octobre|Novembre|Décembre';

/** Remove type label prefix already shown in the entry badge. */
const DESCRIPTION_PREFIX_BY_TYPE = {
  payroll_tax: /^Impôt sur les salaires\s*-\s*/i,
  salary: /^Salaires fonctionnaires\s*-\s*/i,
  maintenance: /^Maintenance mensuelle\s*-\s*/i,
  citizen_tax: /^Impôt Citoyen(?:\s*\([^)]*\))?\s*-\s*/i,
  construction: /^Building:\s*/i,
  capital_funds: /^Capital de départ:\s*/i,
  loan_capital: /^Capital prêt\s*-\s*/i,
  loan_interest: /^Intérêts prêt\s*-\s*/i,
  loan_repayment: /^Remboursement prêt\s*-\s*/i,
  info_loan_interest: /^\[Informatif\]\s+Intérêts prêt\s*—\s*/i,
  info_loan_repayment: /^\[Informatif\]\s+Capital prêt\s*—\s*/i,
  loan_default_interest: /^Intérêts prêt\s+\w+\s+impayés\s*\(/i,
  loan_default_repayment: /^Capital prêt\s+\w+\s+impayé\s*\(/i,
  commercial_route: /^Commission\s*-\s*/i,
  exceptional_expenses: /^Réparation\s*-\s*/i,
  carry_forward: /^Report à nouveau de l'année\s+/i,
  cumul_maintenance: /^Cumul Maintenance\s*-\s*/i,
  cumul_construction: /^Cumul Construction\s*-\s*/i,
  cumul_salary: /^Cumul Salaires\s*-\s*/i,
  cumul_exceptional_expenses: /^Cumul Réparations\s*-\s*/i,
  cumul_loan_interest: /^Cumul Intérêts Prêt\s*-\s*/i,
  cumul_loan_repayment: /^Cumul Remboursement Prêt\s*-\s*/i,
};

const PERIOD_LABEL_PATTERN = new RegExp(
  `^(?:${MONTH_NAMES})\\s+(?:\\d+\\s*(?:ap\\s+)?JC|\\d+)(?:\\s*\\((.+)\\))?\\s*$`,
  'i'
);

const MONTH_ONLY_PATTERN = new RegExp(`^(?:${MONTH_NAMES})\\s*$`, 'i');
const YEAR_ONLY_PATTERN = /^Année\s+\d+\s*(?:ap\s+)?JC\s*$/i;

/**
 * @param {string} text
 * @returns {{ remainder: string, parenthetical: string | null }}
 */
function splitPeriodLabel(text) {
  const periodMatch = text.match(PERIOD_LABEL_PATTERN);
  if (periodMatch) {
    return {
      remainder: '',
      parenthetical: periodMatch[1] || null,
    };
  }

  if (MONTH_ONLY_PATTERN.test(text) || YEAR_ONLY_PATTERN.test(text)) {
    return { remainder: '', parenthetical: null };
  }

  const parenMatch = text.match(/^\((.+)\)$/);
  if (parenMatch) {
    return { remainder: '', parenthetical: parenMatch[1] };
  }

  return { remainder: text, parenthetical: null };
}

/**
 * @typedef {{ label: string, value: string }} JournalEntryDetail
 */

/**
 * @param {{ type?: string, description?: string }} entry
 * @returns {JournalEntryDetail[]} Labeled detail rows (month/year omitted — shown in section headers).
 */
export function formatJournalEntryDetails(entry) {
  const raw = stripBreakdownMarkup(entry.description || '');
  if (!raw) {
    return [];
  }

  if (entry.type === 'balance' && /^Solde$/i.test(raw)) {
    return [];
  }

  if (entry.type === 'payroll_tax') {
    const rate = raw.match(/\((\d+%)\)/);
    return rate ? [{ label: 'Taux', value: rate[1] }] : [];
  }

  if (entry.type === 'salary') {
    const calc = raw.match(/\((\d+\s*hab\.\s*×\s*\d+€)\)/i);
    return calc ? [{ label: 'Calcul', value: calc[1] }] : [];
  }

  if (entry.type === 'citizen_tax') {
    const population = raw.match(/\((\d+\s*hab\.)\)/i);
    return population ? [{ label: 'Population', value: population[1] }] : [];
  }

  if (
    entry.type === 'maintenance' ||
    entry.type?.startsWith('import_') ||
    entry.type?.startsWith('export_') ||
    entry.type?.startsWith('cumul_')
  ) {
    return [];
  }

  if (entry.type === 'construction') {
    const building = raw.replace(/^Building:\s*/i, '').trim();
    return building ? [{ label: 'Bâtiment', value: building }] : [];
  }

  if (entry.type === 'carry_forward') {
    const balance = raw.replace(/^Report à nouveau de l'année\s+/i, '').trim();
    return balance ? [{ label: 'Solde antérieur', value: balance }] : [];
  }

  if (entry.type === 'capital_funds') {
    const amount = raw.replace(/^Capital de départ:\s*/i, '').trim();
    return amount ? [{ label: 'Montant', value: amount }] : [];
  }

  let text = raw;
  const prefix = entry.type ? DESCRIPTION_PREFIX_BY_TYPE[entry.type] : null;
  if (prefix) {
    text = text.replace(prefix, '').trim();
  }

  if (entry.type?.startsWith('import_') || entry.type?.startsWith('export_')) {
    text = text.replace(/^(Import|Export)\s+\S+\s*/i, '').trim();
  }

  const { remainder, parenthetical } = splitPeriodLabel(text);
  const value = parenthetical || remainder;

  if (!value) {
    return [];
  }

  return [{ label: 'Détail', value }];
}

/**
 * @param {{ type?: string, description?: string }} entry
 * @returns {string} Plain-text fallback (e.g. exports).
 */
export function formatJournalEntryDescription(entry) {
  return formatJournalEntryDetails(entry)
    .map(({ label, value }) => `${label}: ${value}`)
    .join(' · ');
}
