/**
 * Renders CityLedgerComparison read model into the admin finances table.
 */

import { buildCityLedgerTableViewModel } from '../../../js/acl/accountingPresentation.js';

/**
 * @param {string} fieldId
 * @param {number} value
 * @param {'balance'|'netflow'|'income'|'expense'} type
 */
function updateField(fieldId, value, type = 'balance') {
  const element = document.querySelector(`[data-field="${fieldId}"]`);
  if (!element) {
    return;
  }

  const numValue = Math.round(value || 0);
  const absValue = Math.abs(numValue);
  element.textContent = absValue.toLocaleString('fr-FR');

  if (type === 'balance') {
    const isNegative = numValue < 0;
    element.classList.remove('finances-value-positive', 'finances-value-negative');
    element.classList.add(isNegative ? 'finances-value-negative' : 'finances-value-positive');
  } else if (type === 'netflow') {
    const isNegative = numValue < 0;
    element.classList.remove('finances-value-positive', 'finances-value-negative', 'finances-value-netflow');
    element.classList.add('finances-value-netflow');
    element.classList.add(isNegative ? 'finances-value-negative' : 'finances-value-positive');
  } else if (type === 'income') {
    element.classList.remove('finances-value-negative', 'finances-value-netflow');
    element.classList.add('finances-value-positive');
  } else if (type === 'expense') {
    element.classList.remove('finances-value-positive', 'finances-value-netflow');
    element.classList.add('finances-value-negative');
  }
}

/**
 * @param {number} thisYearNetFlow
 * @param {string[]} suffixes
 */
function updateNetFlowLabel(thisYearNetFlow, suffixes) {
  const netFlowRow = document.querySelector('[data-field="netFlowThisYear"]')?.closest('tr');
  if (!netFlowRow) {
    return;
  }

  const labelCell = netFlowRow.querySelector('.finances-row-label');
  if (!labelCell) {
    return;
  }

  let labelText = 'Flux net';
  if (suffixes.length > 0) {
    labelText += ` (${suffixes.join(' | ')})`;
  }

  labelCell.innerHTML =
    `${labelText}<span class="finances-explanation">Revenus nets - Dépenses nettes</span>`;
}

/** @param {number} balance */
function updateBalanceRow(balance) {
  const balanceRow = document.querySelector('[data-field="balanceThisYear"]')?.closest('tr');
  if (!balanceRow) {
    return;
  }

  balanceRow.classList.remove('negative');
  if (balance < 0) {
    balanceRow.classList.add('negative');
  }
}

/**
 * @param {import('../../../contexts/accounting/domain/read-models/CityLedgerComparison.js').CityLedgerComparison} comparison
 */
export function renderCityLedgerTable(comparison) {
  const viewModel = buildCityLedgerTableViewModel(comparison);
  const { thisYear, lastYear } = viewModel;

  const incomeFields = [
    { key: 'initialFunds', thisYear: 'initialFundsThisYear', lastYear: 'initialFundsLastYear' },
    { key: 'incomeTax', thisYear: 'incomeTaxThisYear', lastYear: 'incomeTaxLastYear' },
    { key: 'payrollTax', thisYear: 'payrollTaxThisYear', lastYear: 'payrollTaxLastYear' },
    { key: 'exports', thisYear: 'exportsThisYear', lastYear: 'exportsLastYear' },
    { key: 'loanCapital', thisYear: 'loanCapitalThisYear', lastYear: 'loanCapitalLastYear' },
  ];

  const expenseFields = [
    { key: 'construction', thisYear: 'constructionThisYear', lastYear: 'constructionLastYear' },
    { key: 'maintenance', thisYear: 'maintenanceThisYear', lastYear: 'maintenanceLastYear' },
    { key: 'salary', thisYear: 'salaryThisYear', lastYear: 'salaryLastYear' },
    { key: 'repairs', thisYear: 'repairsThisYear', lastYear: 'repairsLastYear' },
    { key: 'imports', thisYear: 'importsThisYear', lastYear: 'importsLastYear' },
    { key: 'loanInterest', thisYear: 'loanInterestThisYear', lastYear: 'loanInterestLastYear' },
    { key: 'loanRepayment', thisYear: 'loanRepaymentThisYear', lastYear: 'loanRepaymentLastYear' },
  ];

  incomeFields.forEach((field) => {
    updateField(field.thisYear, thisYear[field.key], 'income');
    updateField(field.lastYear, lastYear[field.key], 'income');
  });

  expenseFields.forEach((field) => {
    updateField(field.thisYear, thisYear[field.key], 'expense');
    updateField(field.lastYear, lastYear[field.key], 'expense');
  });

  updateField('totalIncomeThisYear', thisYear.totalIncome, 'income');
  updateField('totalIncomeLastYear', lastYear.totalIncome, 'income');
  updateField('totalExpensesThisYear', thisYear.totalExpenses, 'expense');
  updateField('totalExpensesLastYear', lastYear.totalExpenses, 'expense');

  updateField('benefitLastYear', viewModel.benefitLastYear, 'income');
  updateField('deficitLastYear', viewModel.deficitLastYear, 'expense');

  updateField('netIncomeThisYear', thisYear.netIncome, 'income');
  updateField('netIncomeLastYear', lastYear.netIncome, 'income');
  updateField('netExpensesThisYear', thisYear.netExpenses, 'expense');
  updateField('netExpensesLastYear', lastYear.netExpenses, 'expense');
  updateField('netFlowLastYear', lastYear.netFlow, 'netflow');
  updateField('netFlowThisYear', thisYear.netFlow, 'netflow');

  updateNetFlowLabel(thisYear.netFlow, viewModel.netFlowLabelSuffixes);

  updateField('balanceThisYear', thisYear.balance, 'balance');
  updateField('balanceLastYear', lastYear.balance, 'balance');
  updateBalanceRow(thisYear.balance);
}

/** @param {number} debt */
export function renderCityLedgerDebt(debt) {
  const debtAmount = document.getElementById('finances-debt-amount');
  if (debtAmount) {
    debtAmount.textContent = Math.round(debt || 0).toString();
  }
}

/** @param {{ text?: string, type?: string }} message */
export function renderCityLedgerMessage(message) {
  const messageArea = document.getElementById('finances-message-area');
  const messageText = document.getElementById('finances-message-text');

  if (messageArea && messageText) {
    messageArea.className = `finances-message-area ${message.type || 'info'}`;
    messageText.textContent = message.text || '';
  }
}

/**
 * @param {import('../../../contexts/accounting/domain/read-models/CityLedgerComparison.js').CityLedgerComparison} comparison
 */
export function renderCityLedger(comparison) {
  renderCityLedgerTable(comparison);
  renderCityLedgerDebt(comparison.debt);
  renderCityLedgerMessage(comparison.message);
}
