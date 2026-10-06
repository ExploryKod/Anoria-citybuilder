/**
 * JournalPresenter — rendu HTML du grand livre (données déjà chargées).
 */

import { TimeManager } from '../../../../shared/time/TimeManager.js';
import { formatJournalEntryDetails } from './formatJournalEntryDescription.js';
import { goodLabel, unresolvedTerm } from '../../shell/CatalogVocabulary.js';
import { formatEuro } from '../../../../contexts/accounting/presentation/formatMoney.js';

/** "Import Blé" / "Export Bois": a trade line is named after the good the catalog names. */
function tradeLabel(type) {
  const trade = /^(import|export)_(.+)$/.exec(type);
  if (!trade) return null;
  return `${trade[1] === 'import' ? 'Import' : 'Export'} ${goodLabel(trade[2])}`;
}

/**
 * @param {number} amount
 * @returns {string}
 */
function formatSignedEuro(amount) {
  return `${amount >= 0 ? '+' : ''}${formatEuro(amount)}`;
}

/**
 * @param {string} sign
 * @param {number} amount
 * @returns {string}
 */
function formatPrefixedEuro(sign, amount) {
  return `${sign}${formatEuro(amount)}`;
}

/**
 * @param {{ label: string, amountHtml: string, className: string, tooltip: string }} params
 * @returns {string}
 */
function renderSummaryItem({ label, amountHtml, className, tooltip }) {
  return `
    <div class="journal-summary-item ${className}" title="${tooltip}">
        <span class="label">
            ${label}
            <span class="journal-summary-help" aria-hidden="true">ⓘ</span>
        </span>
        <span class="amount">${amountHtml}</span>
    </div>`;
}

/**
 * @param {import('../../../../contexts/accounting/domain/read-models/GeneralLedgerView.js').GeneralLedgerYear} yearData
 * @returns {string}
 */
function renderYearSummary(yearData) {
  const netClass = yearData.netFlow >= 0 ? 'positive' : 'negative';
  const resultTooltip =
    `Résultat net de l'année : revenus (+${yearData.incomeTotal} €) − dépenses (−${yearData.expensesTotal} €) = ${formatSignedEuro(yearData.netFlow)}. ` +
    'Ne comprend pas le capital de départ ni les soldes des années précédentes.';

  let html = renderSummaryItem({
    label: 'Revenus:',
    amountHtml: formatPrefixedEuro('+', yearData.incomeTotal),
    className: 'income',
    tooltip: 'Total des entrées comptables de l’année (impôts, exports, capital prêt, etc.).',
  });
  html += renderSummaryItem({
    label: 'Dépenses:',
    amountHtml: formatPrefixedEuro('-', yearData.expensesTotal),
    className: 'expenses',
    tooltip: 'Total des sorties comptables de l’année (salaires, maintenance, imports, intérêts, etc.).',
  });
  html += renderSummaryItem({
    label: 'Résultat:',
    amountHtml: formatSignedEuro(yearData.netFlow),
    className: `netflow ${netClass}`,
    tooltip: resultTooltip,
  });

  if (yearData.isCurrentYear && yearData.treasuryBalance != null) {
    const treasuryClass = yearData.treasuryBalance >= 0 ? 'positive' : 'negative';
    const treasuryTooltip =
      `Trésorerie actuelle en caisse : ${formatSignedEuro(yearData.treasuryBalance)}. ` +
      'Cumul depuis le début de la partie (capital initial + résultats de toutes les années jouées). ' +
      `Diffère du résultat de l'année (${formatSignedEuro(yearData.netFlow)}) si des années antérieures ont dégagé un excédent ou un déficit.`;
    html += renderSummaryItem({
      label: 'Trésorerie:',
      amountHtml: formatSignedEuro(yearData.treasuryBalance),
      className: `treasury ${treasuryClass}`,
      tooltip: treasuryTooltip,
    });
  }

  return html;
}

/**
 * @param {import('../../../../contexts/accounting/domain/read-models/GeneralLedgerView.js').GeneralLedgerMonth} monthData
 * @returns {string}
 */
function renderMonthSummary(monthData) {
  const monthNetClass = monthData.netFlow >= 0 ? 'positive' : 'negative';
  const monthTooltip =
    `Résultat net du mois : revenus (+${monthData.incomeTotal} €) − dépenses (−${monthData.expensesTotal} €) = ${formatSignedEuro(monthData.netFlow)}.`;

  return (
    renderSummaryItem({
      label: 'Revenus:',
      amountHtml: formatPrefixedEuro('+', monthData.incomeTotal),
      className: 'income',
      tooltip: 'Entrées comptables du mois.',
    }) +
    renderSummaryItem({
      label: 'Dépenses:',
      amountHtml: formatPrefixedEuro('-', monthData.expensesTotal),
      className: 'expenses',
      tooltip: 'Sorties comptables du mois.',
    }) +
    renderSummaryItem({
      label: 'Résultat:',
      amountHtml: formatSignedEuro(monthData.netFlow),
      className: `netflow ${monthNetClass}`,
      tooltip: monthTooltip,
    })
  );
}

/**
 * @param {import('../../../../contexts/accounting/domain/read-models/GeneralLedgerView.js').GeneralLedgerView} ledger
 * @param {{
 *   INFO_JOURNAL_TYPE_LABELS: Record<string, string>,
 *   isInfoPseudoMovementType: (type: string) => boolean,
 *   labelForInfoJournalType: (type: string) => string,
 * }} accounting
 * @param {Map<string, string>} hamletNames
 * @param {string} scopeLabel The hamlet shown in each year header, or "Tous les hameaux".
 * @returns {string}
 */
export function renderJournalList(ledger, accounting, hamletNames, scopeLabel) {
  const sortHint = `
        <p class="journal-sort-hint">Plus récent en haut — années et mois triés du plus récent au plus ancien.</p>
    `;

  return (
    sortHint +
    ledger.years
      .map((yearData) => {
        const yearDisplay = yearData.year === 0 ? '0 JC' : `${yearData.year} ap JC`;

        return `
            <div class="journal-year-group">
                <div class="journal-year-header">
                    <h3>Année ${yearDisplay} <span class="journal-year-scope">${scopeLabel}</span></h3>
                    <div class="journal-year-summary">
                        ${renderYearSummary(yearData)}
                    </div>
                </div>

                ${yearData.months
                  .map((monthData) => {
                    const yearDisplayMonth =
                      monthData.year === 0 ? '0 JC' : `${monthData.year} ap JC`;

                    return `
                        <div class="journal-month-group">
                            <div class="journal-month-header">
                                <h4>${monthData.monthName} ${yearDisplayMonth}</h4>
                                <div class="journal-month-summary">
                                    ${renderMonthSummary(monthData)}
                                </div>
                            </div>
                            <div class="journal-month-entries">
                                ${monthData.entries.map((entry) => createJournalEntryHTML(entry, accounting, hamletNames)).join('')}
                            </div>
                        </div>
                    `;
                  })
                  .join('')}
            </div>
        `;
      })
      .join('')
  );
}

/**
 * @param {object} entry
 * @param {{
 *   INFO_JOURNAL_TYPE_LABELS: Record<string, string>,
 *   isInfoPseudoMovementType: (type: string) => boolean,
 *   labelForInfoJournalType: (type: string) => string,
 * }} accounting
 * @returns {string}
 */
function createJournalEntryHTML(entry, accounting, hamletNames) {
  const hamletName = hamletNames.get(entry.hamletId);
  if (hamletName === undefined) {
    throw new Error(`[journal] entry ${entry.id} belongs to an unknown hamlet ${entry.hamletId}`);
  }
  const {
    INFO_JOURNAL_TYPE_LABELS,
    isInfoPseudoMovementType,
    labelForInfoJournalType,
  } = accounting;
  // The date the player reads is the game's: a turn is a day, so the entry is dated by its turn in the calendar.
  const gameDate = TimeManager.formatGameDate(entry.turn);

  let isIncome = false;

  if (
    isInfoPseudoMovementType(entry.type) ||
    entry.type === 'loan_default_interest' ||
    entry.type === 'loan_default_repayment'
  ) {
    isIncome = false;
  } else if (
    entry.type === 'citizen_tax' ||
    entry.type === 'payroll_tax' ||
    entry.type === 'vat' ||
    entry.type === 'producer_revenue' ||
    entry.type === 'corporate_tax_revenue' ||
    entry.type === 'service_sales' ||
    entry.type === 'service_subsidy_received' ||
    entry.type === 'household_wage' ||
    entry.type === 'capital_funds' ||
    entry.type === 'loan_capital'
  ) {
    isIncome = true;
  } else if (entry.type.startsWith('export_')) {
    isIncome = true;
  } else if (entry.type.startsWith('import_')) {
    isIncome = false;
  } else if (
    entry.type === 'salary' ||
    entry.type === 'maintenance' ||
    entry.type === 'construction' ||
    entry.type === 'construction_refund' ||
    entry.type === 'exceptional_expenses' ||
    entry.type === 'commercial_route'
  ) {
    isIncome = false;
  }

  const typeClass = isIncome ? 'positive' : 'negative';

  const typeLabels = {
    citizen_tax: 'Impôt Citoyen',
    payroll_tax: 'Impôt sur le revenu (IR)',
    vat: 'TVA ventes',
    producer_revenue: 'Ventes HT',
    producer_purchase: 'Achats HT',
    producer_wage: 'Salaires des ouvriers',
    household_wage: 'Salaire perçu',
    corporate_tax: 'Impôt sur les sociétés',
    corporate_tax_revenue: 'Impôt sur les sociétés perçu',
    subsidy_companies: 'Subvention entretien entreprise',
    subsidy_housing: 'Subvention entretien habitation',
    capital_funds: 'Capital de départ',
    construction: 'Construction',
    construction_refund: 'Remboursement construction',
    exceptional_expenses: 'Réparation',
    maintenance: 'Maintenance mensuelle',
    salary: 'Salaires fonctionnaires',
    unemployment_benefit: 'Salaires chômeurs',
    service_subsidy: 'Subventions des services',
    service_sales: 'Ventes de services',
    consumer_purchase: 'Achats des maisons',
    income_tax: 'Impôt sur le revenu retenu',
    public_wage: 'Salaire de fonctionnaire perçu',
    household_benefit: 'Allocation chômage perçue',
    service_purchase: 'Achats de services',
    service_subsidy_received: 'Subvention reçue',
    commercial_route: 'Commission Négociants',
    contribution: 'Contribution',
    loan_capital: 'Capital Prêt',
    loan_interest: 'Intérêts prêt',
    loan_repayment: 'Remboursement prêt',
    ...INFO_JOURNAL_TYPE_LABELS,
    loan_default_interest: labelForInfoJournalType('info_loan_interest'),
    loan_default_repayment: labelForInfoJournalType('info_loan_repayment'),
  };

  const entryDetails = formatJournalEntryDetails(entry);

  let partnerName = null;
  if (
    entry.partnerId &&
    (entry.type.startsWith('import_') ||
      entry.type.startsWith('export_') ||
      entry.type === 'commercial_route')
  ) {
    try {
      const partnersData = localStorage.getItem('commerce_partners');
      if (partnersData) {
        const partners = JSON.parse(partnersData);
        const partner = partners.find((p) => p.id === entry.partnerId);
        if (partner) {
          partnerName = partner.name;
        }
      }
    } catch (e) {
      console.warn('Failed to get partner name:', e);
    }
  }

  return `
        <div class="journal-entry">
            <div class="journal-entry-header">
                <span class="journal-entry-type ${entry.type}">${typeLabels[entry.type] ?? tradeLabel(entry.type) ?? unresolvedTerm('journal line label', entry.type)}</span>
                <span class="journal-entry-hamlet">${hamletName}</span>
                ${partnerName ? `<span class="journal-entry-partner">🤝 ${partnerName}</span>` : ''}
                <span class="journal-entry-amount ${typeClass}">
                    ${typeClass === 'positive' ? '+' : '-'}${Math.abs(entry.amount)}€
                </span>
            </div>
            <div class="journal-entry-details">
                ${
                  entryDetails.length
                    ? `
                <div class="journal-entry-facts">
                    ${entryDetails
                      .map(
                        ({ label, value }) => `
                        <span class="journal-entry-fact">
                            <span class="journal-entry-fact-label">${label}:</span>
                            <span class="journal-entry-fact-value">${value}</span>
                        </span>
                    `
                      )
                      .join('')}
                </div>
                `
                    : ''
                }
                <div class="journal-entry-meta">
                    ${entry.id != null ? `<span class="journal-entry-id">N° ${entry.id}</span>` : ''}
                    ${entry.buildingInstanceId ? `<span class="journal-entry-asset-id" title="${entry.buildingInstanceId}">Id bâtiment: ${entry.buildingInstanceId}</span>` : ''}
                    ${entry.turn !== undefined ? `<span class="journal-entry-turn-number">Tour: ${entry.turn}</span>` : ''}
                    <span class="journal-entry-date">${gameDate}</span>
                </div>
            </div>
        </div>
    `;
}
