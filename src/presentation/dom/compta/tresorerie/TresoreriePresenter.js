/**
 * TresoreriePresenter — rendu snapshot trésorerie dans le panel temps réel.
 */

import {
  buildLoanInterestDetailHtml,
  buildRealtimeBudgetViewModel,
  financialHealthStatusLabel,
} from '../../../../contexts/accounting/presentation/index.js';

/** @param {HTMLElement|null} element @param {string} text */
function setTextContent(element, text) {
  if (element) {
    element.textContent = text;
  }
}

/** @param {HTMLElement|null} element @param {Record<string, string>} style */
function applyStyle(element, style) {
  if (!element || !style) {
    return;
  }
  for (const [key, value] of Object.entries(style)) {
    element.style[key] = value;
  }
}

/** @param {HTMLElement|null} parent @param {string} text */
function setNestedSpanText(parent, text) {
  if (!parent) {
    return;
  }
  const span = parent.querySelector('span');
  if (span) {
    span.textContent = text;
  } else {
    parent.textContent = text;
  }
}

/**
 * @param {ReturnType<typeof buildRealtimeBudgetViewModel>} viewModel
 */
export function renderTresoreriePanel(viewModel) {
  const realtimeFundsEl = document.getElementById('realtime-funds');
  if (!realtimeFundsEl) {
    return false;
  }

  setTextContent(realtimeFundsEl, viewModel.funds.text);
  applyStyle(realtimeFundsEl, viewModel.funds.style);

  setTextContent(document.getElementById('realtime-income'), viewModel.income);
  setTextContent(document.getElementById('realtime-expenses'), viewModel.expenses);

  const netflowEl = document.getElementById('realtime-netflow');
  setTextContent(netflowEl, viewModel.netFlow.text);
  applyStyle(netflowEl, viewModel.netFlow.style);

  setNestedSpanText(document.getElementById('realtime-turn'), String(viewModel.turn));

  const populationEl = document.getElementById('realtime-population');
  const populationSpan = populationEl?.querySelector('span');
  if (populationSpan) {
    populationSpan.textContent = viewModel.population.text;
    populationSpan.style.color = viewModel.population.error ? '#ff6b6b' : '#fff';
    if (populationEl) {
      populationEl.title = viewModel.population.title;
    }
  } else {
    setTextContent(populationEl, viewModel.population.text);
  }

  const healthStatusEl = document.getElementById('realtime-health-status');
  const healthMessageEl = document.getElementById('realtime-health-message');
  if (healthStatusEl && healthMessageEl) {
    healthStatusEl.textContent = viewModel.health.statusText;
    healthMessageEl.textContent = viewModel.health.message;
    healthStatusEl.className = viewModel.health.className;
  }

  setTextContent(document.getElementById('realtime-taxes'), viewModel.taxes);
  setTextContent(document.getElementById('realtime-other-income'), viewModel.otherIncome);
  setTextContent(document.getElementById('realtime-building-maintenance'), viewModel.buildingMaintenance);
  setTextContent(document.getElementById('realtime-loan-interest'), viewModel.loanInterest);
  setTextContent(document.getElementById('realtime-investments'), viewModel.investments);

  return true;
}

/**
 * Build view model + render realtime budget panel in one step.
 *
 * @param {Parameters<typeof buildRealtimeBudgetViewModel>[0]} data
 */
export function renderTresorerieFromData(data) {
  return renderTresoreriePanel(buildRealtimeBudgetViewModel(data));
}

/** @param {Array<object>} activeLoans */
export function renderLoanInterestDetail(activeLoans) {
  const detailContainer = document.getElementById('realtime-loan-interest-detail');
  if (!detailContainer) {
    return;
  }
  detailContainer.innerHTML = buildLoanInterestDetailHtml(activeLoans);
}

export function renderTresorerieError() {
  const realtimeFundsEl = document.getElementById('realtime-funds');
  const healthStatusEl = document.getElementById('realtime-health-status');
  const healthMessageEl = document.getElementById('realtime-health-message');
  const populationEl = document.getElementById('realtime-population');

  if (realtimeFundsEl) {
    realtimeFundsEl.textContent = 'Erreur';
    realtimeFundsEl.style.color = '#ff6b6b';
  }
  if (healthStatusEl) {
    healthStatusEl.textContent = 'Erreur';
  }
  if (healthMessageEl) {
    healthMessageEl.textContent = 'Impossible de charger les données';
  }

  const populationSpan = populationEl?.querySelector('span');
  if (populationSpan) {
    populationSpan.textContent = 'Erreur';
    populationSpan.style.color = '#ff6b6b';
    if (populationEl) {
      populationEl.title = 'Erreur lors du chargement de la population';
    }
  }
}

export { financialHealthStatusLabel };
