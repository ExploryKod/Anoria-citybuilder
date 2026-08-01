/**
 * JournalPresenter — rendu HTML du grand livre (données déjà chargées).
 */

import { TimeManager } from '../../../../shared/time/TimeManager.js';
import { formatJournalEntryDetails } from './formatJournalEntryDescription.js';

/**
 * @param {import('../../../../contexts/accounting/domain/read-models/GeneralLedgerView.js').GeneralLedgerView} ledger
 * @param {{
 *   INFO_JOURNAL_TYPE_LABELS: Record<string, string>,
 *   isInfoPseudoMovementType: (type: string) => boolean,
 *   labelForInfoJournalType: (type: string) => string,
 * }} accounting
 * @returns {string}
 */
export function renderJournalList(ledger, accounting) {
  const sortHint = `
        <p class="journal-sort-hint">Plus récent en haut — années et mois triés du plus récent au plus ancien.</p>
    `;

  return (
    sortHint +
    ledger.years
      .map((yearData) => {
        const yearDisplay = yearData.year === 0 ? '0 JC' : `${yearData.year} ap JC`;
        const displayBalance = yearData.displayBalance;
        const balanceClass = displayBalance >= 0 ? 'positive' : 'negative';

        return `
            <div class="journal-year-group">
                <div class="journal-year-header">
                    <h3>Année ${yearDisplay}</h3>
                    <div class="journal-year-summary">
                        <div class="journal-summary-item income">
                            <span class="label">Revenus:</span>
                            <span class="amount">+${yearData.incomeTotal}€</span>
                        </div>
                        <div class="journal-summary-item expenses">
                            <span class="label">Dépenses:</span>
                            <span class="amount">-${yearData.expensesTotal}€</span>
                        </div>
                        <div class="journal-summary-item netflow ${balanceClass}">
                            <span class="label">Solde:</span>
                            <span class="amount">${displayBalance >= 0 ? '+' : ''}${displayBalance}€</span>
                        </div>
                    </div>
                </div>

                ${yearData.months
                  .map((monthData) => {
                    const yearDisplayMonth =
                      monthData.year === 0 ? '0 JC' : `${monthData.year} ap JC`;
                    const monthNetClass = monthData.netFlow >= 0 ? 'positive' : 'negative';

                    return `
                        <div class="journal-month-group">
                            <div class="journal-month-header">
                                <h4>${monthData.monthName} ${yearDisplayMonth}</h4>
                                <div class="journal-month-summary">
                                    <div class="journal-summary-item income">
                                        <span class="label">Revenus:</span>
                                        <span class="amount">+${monthData.incomeTotal}€</span>
                                    </div>
                                    <div class="journal-summary-item expenses">
                                        <span class="label">Dépenses:</span>
                                        <span class="amount">-${monthData.expensesTotal}€</span>
                                    </div>
                                    <div class="journal-summary-item netflow ${monthNetClass}">
                                        <span class="label">Solde:</span>
                                        <span class="amount">${monthData.netFlow >= 0 ? '+' : ''}${monthData.netFlow}€</span>
                                    </div>
                                </div>
                            </div>
                            <div class="journal-month-entries">
                                ${monthData.entries.map((entry) => createJournalEntryHTML(entry, accounting)).join('')}
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
function createJournalEntryHTML(entry, accounting) {
  const {
    INFO_JOURNAL_TYPE_LABELS,
    isInfoPseudoMovementType,
    labelForInfoJournalType,
  } = accounting;
  const date = new Date(entry.date);
  const formattedDate = date.toLocaleString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  let yearDisplay = '';
  if (entry.turn !== undefined) {
    const timeInfo = TimeManager.getTimeInfo(entry.turn);
    yearDisplay = timeInfo.year === 0 ? '0 JC' : `${timeInfo.year} ap JC`;
  }

  let isIncome = false;

  if (
    entry.type === 'cumul_maintenance' ||
    entry.type === 'cumul_construction' ||
    entry.type === 'cumul_salary' ||
    entry.type === 'cumul_exceptional_expenses' ||
    entry.type === 'cumul_loan_interest' ||
    entry.type === 'cumul_loan_repayment' ||
    isInfoPseudoMovementType(entry.type) ||
    entry.type === 'loan_default_interest' ||
    entry.type === 'loan_default_repayment'
  ) {
    isIncome = false;
  } else if (entry.type === 'balance') {
    isIncome = entry.amount >= 0;
  } else if (
    entry.type === 'citizen_tax' ||
    entry.type === 'payroll_tax' ||
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
  } else if (entry.type === 'carry_forward') {
    isIncome = entry.isCarryForwardIncome !== undefined ? entry.isCarryForwardIncome : true;
  }

  const typeClass = isIncome ? 'positive' : 'negative';

  const typeLabels = {
    citizen_tax: 'Impôt Citoyen',
    payroll_tax: 'Impôt sur les salaires (assiette citoyens)',
    capital_funds: 'Capital de départ',
    carry_forward: 'Report à nouveau',
    construction: 'Construction',
    construction_refund: 'Remboursement construction',
    exceptional_expenses: 'Réparation',
    maintenance: 'Maintenance mensuelle',
    salary: 'Salaires fonctionnaires',
    unemployment_benefit: 'Salaires chômeurs',
    import_wheat: 'Import Blé',
    import_carrot: 'Import Carotte',
    import_cabbage: 'Import Chou',
    import_wood: 'Import Bois',
    import_dattes: 'Import Dattes',
    export_wheat: 'Export Blé',
    export_carrot: 'Export Carotte',
    export_cabbage: 'Export Chou',
    export_wood: 'Export Bois',
    export_dattes: 'Export Dattes',
    commercial_route: 'Commission Négociants',
    loan_capital: 'Capital Prêt',
    loan_interest: 'Intérêts prêt',
    loan_repayment: 'Remboursement prêt',
    ...INFO_JOURNAL_TYPE_LABELS,
    loan_default_interest: labelForInfoJournalType('info_loan_interest'),
    loan_default_repayment: labelForInfoJournalType('info_loan_repayment'),
    cumul_maintenance: 'Cumul Maintenance',
    cumul_construction: 'Cumul Construction',
    cumul_salary: 'Cumul salaires fonctionnaires',
    cumul_exceptional_expenses: 'Cumul Réparations',
    cumul_loan_interest: 'Cumul Intérêts Prêt',
    cumul_loan_repayment: 'Cumul Remboursement Prêt',
    balance: 'Solde',
  };

  const breakdownMatch = entry.description?.match(/\|BREAKDOWN\|(.*?)\|BREAKDOWN\|/);
  let breakdownItems = null;

  const supportsBreakdown =
    entry.type === 'maintenance' ||
    entry.type === 'commercial_route' ||
    entry.type.startsWith('import_') ||
    entry.type.startsWith('export_');

  if (breakdownMatch && supportsBreakdown) {
    try {
      breakdownItems = JSON.parse(breakdownMatch[1]);
    } catch (e) {
      console.warn('Failed to parse breakdown:', e);
    }
  }

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
                <span class="journal-entry-type ${entry.type}">${typeLabels[entry.type] || entry.type}</span>
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
                ${
                  breakdownItems
                    ? `
                <ul class="journal-maintenance-breakdown">
                    ${breakdownItems
                      .map(
                        (item) => `
                        <li class="journal-breakdown-item">
                            <span class="breakdown-label">${item.label}:</span>
                            <span class="breakdown-count">${item.quantity || item.count}</span>
                            <span class="breakdown-multiply">×</span>
                            <span class="breakdown-unit-cost">${item.unitCost}€</span>
                            <span class="breakdown-equals">=</span>
                            <span class="breakdown-total">${item.total}€</span>
                        </li>
                    `
                      )
                      .join('')}
                </ul>
                `
                    : ''
                }
                <div class="journal-entry-meta">
                    ${entry.id != null ? `<span class="journal-entry-id">N° ${entry.id}</span>` : ''}
                    ${entry.buildingInstanceId ? `<span class="journal-entry-asset-id" title="${entry.buildingInstanceId}">Id bâtiment: ${entry.buildingInstanceId}</span>` : ''}
                    ${yearDisplay ? `<span class="journal-entry-year">Année: ${yearDisplay}</span>` : ''}
                    ${entry.turn !== undefined ? `<span class="journal-entry-turn-number">Tour: ${entry.turn}</span>` : ''}
                    <span class="journal-entry-date">${formattedDate}</span>
                </div>
            </div>
        </div>
    `;
}
