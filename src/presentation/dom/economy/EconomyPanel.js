/**
 * EconomyPanel — the panel the button under the supply one opens: how big is the economy of the hamlet, how much does it owe and to whom, how well do its inhabitants live? Only a
 * reading: nothing here asks the player for a decision. Three tabs, each a few tables: Production (the domestic product), Dettes (public and of the companies), Développement (the
 * human development index and what it is made of). The figures come from `supply.describeEconomy()`, all derived from the journal, the markets and the houses, never stored; the
 * words a service goes by are the catalog's.
 */

import { createModalFocusSession } from '../shell/modalFocus.js';
import { goodLabel } from '../shell/CatalogVocabulary.js';
import { showActiveHamletLabel } from '../admin/supply-traceability/SupplyTraceabilityPanel.js';

/** @type {{ supply: { describeEconomy: () => Promise<object> }, popupManager?: object | null } | null} */
let deps = null;

/** @type {ReturnType<typeof createModalFocusSession> | null} */
let focusSession = null;

const PANEL_ID = 'economy-panel';

const escapeHtml = (value) => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const WAIT = '…';
const euros = (amount) => (amount === null ? WAIT : `${Math.round(amount).toLocaleString('fr-FR')} €`.replace('-', '−'));
const percent = (value) => (value === null ? WAIT : `${value.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`);
const shareOf = (share) => (share === null ? WAIT : percent(Math.round(share * 1000) / 10));
const index = (value) => (value === null ? WAIT : value.toLocaleString('fr-FR', { minimumFractionDigits: 3, maximumFractionDigits: 3 }));
const names = (services) => services.map((service) => goodLabel(service)).join(' ou ');

/**
 * A table: a caption, its column heads, its rows. The first cell of a row is its label (with an optional hint under it); the others are figures, right-aligned. On a phone the heads
 * go and each figure carries its own head above it (`data-label`), the label spanning the row.
 * @param {{ caption: string, heads: string[], rows: Array<{ cells: string[], hint?: string, strong?: boolean, bar?: number | null }>, note?: string }} table
 * @returns {string} html
 */
function tableHtml({ caption, heads, rows, note = '', warning = '' }) {
  const columns = `minmax(0, 2fr) ${heads.slice(1).map(() => 'minmax(88px, 1fr)').join(' ')}`;
  const head = `<div class="eco-row eco-head" role="row">${heads.map((label, at) => `<div role="columnheader" class="${at === 0 ? 'eco-label' : 'eco-figure'}">${escapeHtml(label)}</div>`).join('')}</div>`;
  const body = rows
    .map(
      (row) => `<div class="eco-row${row.strong ? ' eco-row--strong' : ''}${row.muted ? ' eco-row--muted' : ''}" role="row">
      <div role="cell" class="eco-label">${escapeHtml(row.cells[0])}${row.hint ? `<small>${escapeHtml(row.hint)}</small>` : ''}</div>
      ${row.cells
        .slice(1)
        .map((cell, at) => `<div role="cell" class="eco-figure" data-label="${escapeHtml(heads[at + 1])}">${escapeHtml(cell)}</div>`)
        .join('')}
      ${row.bar === undefined ? '' : `<span class="eco-bar" aria-hidden="true"><span style="width:${Math.round((row.bar ?? 0) * 100)}%"></span></span>`}
    </div>`,
    )
    .join('');
  return `<section class="eco-card">
    <h5>${escapeHtml(caption)}</h5>
    <div class="eco-table" role="table" style="--eco-columns:${columns}">${head}${body}</div>
    ${warning ? `<p class="eco-warning">${escapeHtml(warning)}</p>` : ''}
    ${note ? `<p class="eco-note">${escapeHtml(note)}</p>` : ''}
  </section>`;
}

/** @param {object} economy a ready `describeEconomy` @returns {string} the Production tab */
function productionHtml(economy) {
  const { perInhabitant } = economy;
  const parts = economy.valueAdded + economy.publicOutput;
  const part = (amount) => (parts > 0 ? percent(Math.round((amount / parts) * 1000) / 10) : WAIT);
  return `${tableHtml({
    caption: 'Produit intérieur, sur une année',
    heads: ['Indicateur', 'Montant', 'Par habitant'],
    rows: [
      { cells: ['PIB', euros(economy.gdp), euros(perInhabitant.gdp)], hint: 'ce que les entreprises ajoutent, plus l\'administration à son coût' },
      { cells: ['PIB en parité de pouvoir d\'achat', euros(economy.gdpPpp), euros(perInhabitant.gdpPpp)], hint: economy.parity === null ? 'pas encore de marché pour comparer les prix' : `prix du panier de référence ÷ prix ici = ${economy.parity.toLocaleString('fr-FR')}` },
      { cells: ['PNB', euros(economy.gni), euros(perInhabitant.gni)], hint: `PIB moins ${euros(economy.externalInterest)} d'intérêts versés hors du jeu` },
    ],
  })}
  ${tableHtml({
    caption: 'D\'où vient le PIB',
    heads: ['Composante', 'Montant', 'Part'],
    rows: [
      { cells: ['Valeur ajoutée des entreprises', euros(economy.valueAdded), part(economy.valueAdded)], hint: `production moins consommations, ${economy.privateDebt.companies} entreprises` },
      { cells: ['Administration, à son coût', euros(economy.publicOutput), part(economy.publicOutput)], hint: 'salaires de la ville' },
      { cells: ['PIB', euros(economy.gdp), parts > 0 ? '100 %' : WAIT], strong: true },
    ],
  })}`;
}

/** @param {object} economy a ready `describeEconomy` @returns {string} the Dettes tab */
function debtsHtml(economy) {
  const { publicDebt: debt, privateDebt, ratios } = economy;
  const ofGdp = (amount) => (economy.gdp > 0 ? percent(Math.round((amount / economy.gdp) * 1000) / 10) : WAIT);
  const ofLoans = (amount) => (debt.loans > 0 ? percent(Math.round((amount / debt.loans) * 1000) / 10) : WAIT);
  return `${tableHtml({
    caption: 'Dette publique',
    heads: ['Poste', 'Montant', 'Du PIB'],
    rows: [
      { cells: ['Prêts', euros(debt.loans), ofGdp(debt.loans)] },
      { cells: ['Découvert de la ville', euros(debt.overdraft), ofGdp(debt.overdraft)] },
      { cells: ['Dettes fournisseurs', euros(debt.suppliers), ofGdp(debt.suppliers)] },
      { cells: ['Dette brute', euros(debt.gross), percent(ratios.grossDebtOfGdp)], strong: true },
      { cells: ['Trésorerie', euros(-debt.cash), ofGdp(-debt.cash)] },
      { cells: ['Créances', euros(-debt.receivables), ofGdp(-debt.receivables)] },
      { cells: ['Participations dans les entreprises', euros(-debt.holdings), ofGdp(-debt.holdings)], hint: 'le capital que la ville a investi' },
      { cells: ['Dette nette', euros(debt.net), percent(ratios.netDebtOfGdp)], strong: true },
    ],
  })}
  ${tableHtml({
    caption: 'Qui détient la dette',
    heads: ['Détenteur', 'Montant', 'Des prêts'],
    rows: [
      { cells: ['Banques du jeu', euros(debt.domesticLoans), ofLoans(debt.domesticLoans)], hint: 'créanciers domestiques : les intérêts restent dans l\'économie' },
      { cells: ['Hors du jeu', euros(debt.loans - debt.domesticLoans), ofLoans(debt.loans - debt.domesticLoans)], hint: 'les intérêts quittent l\'économie' },
      { cells: ['Épargne des ménages', euros(economy.householdSavings), WAIT], hint: ratios.savingsCoverOfPublicDebt === null ? '' : `couvre ${percent(ratios.savingsCoverOfPublicDebt)} de la dette brute` },
    ],
  })}
  ${tableHtml({
    caption: 'Dette des entreprises',
    heads: ['Poste', 'Montant', 'Du PIB'],
    rows: [
      { cells: ['Prêts', euros(privateDebt.loans), ofGdp(privateDebt.loans)] },
      { cells: ['Découverts', euros(privateDebt.overdrafts), ofGdp(privateDebt.overdrafts)], hint: `${privateDebt.indebted} entreprise${privateDebt.indebted > 1 ? 's' : ''} sur ${privateDebt.companies}` },
      { cells: ['Impayés', euros(privateDebt.unpaid), ofGdp(privateDebt.unpaid)], hint: 'salaires, cotisations, impôts, fournisseurs' },
      { cells: ['Total', euros(privateDebt.total), percent(ratios.privateDebtOfGdp)], strong: true },
    ],
  })}`;
}

/**
 * Why the index is not valid yet, and what makes it so: a dimension at 0 is brought above it by a service that serves the inhabitants, the income by a product per inhabitant above the lower goalpost.
 * @param {Array<{ kind: string, label: string, serviceGroups?: ReadonlyArray<ReadonlyArray<string>>, goalpost?: number }>} blockers
 * @returns {string} '' when the index is valid
 */
function blockersText(blockers) {
  if (blockers.length === 0) return '';
  const needs = blockers.map((blocker) =>
    blocker.kind === 'income'
      ? `${blocker.label} : un PIB en PPA par habitant de plus de ${euros(blocker.goalpost)} par an`
      : `${blocker.label} : un service qui dessert des habitants (${names(blocker.serviceGroups.flat())})`,
  );
  return `L'IDH n'est valide que lorsque chaque dimension dépasse 0. Il manque : ${needs.join(' ; ')}.`;
}

/** @param {object} economy a ready `describeEconomy` @returns {string} the Développement tab */
function developmentHtml(economy) {
  const development = economy.development;
  const partText = (part) => (part.kind === 'fed' ? `nourris ${shareOf(part.share)}` : `${names(part.services)} ${shareOf(part.share)}`);
  const dimensionRows = development.dimensions.map((dimension) => ({ cells: [dimension.label, index(dimension.index)], hint: dimension.parts.map(partText).join(' · '), bar: dimension.index }));
  const income = { cells: ['Revenu', index(development.income)], hint: development.incomePerInhabitant === null ? 'le PIB en PPA attend un marché' : `${euros(development.incomePerInhabitant)} par habitant et par an, en PPA`, bar: development.income };
  const coverageRows = development.dimensions.flatMap((dimension) => dimension.parts.filter((part) => part.kind === 'services')).map((part) => ({ cells: [names(part.services), shareOf(part.share)] }));
  return `${tableHtml({
    caption: 'Indice de développement humain',
    heads: ['Dimension', 'Indice'],
    rows: [...dimensionRows, income, { cells: ['IDH', development.hdi === null ? '—' : index(development.hdi)], strong: true, muted: development.hdi === null, bar: development.hdi }],
    note: `Moyenne géométrique des trois dimensions, de 0 à 1. Le jeu n'a ni espérance de vie ni années d'école : la santé est dite par la faim et les soins, l'éducation par l'école primaire, l'école et la bibliothèque.`,
    warning: blockersText(development.blockers),
  })}
  ${tableHtml({
    caption: 'Vie quotidienne',
    heads: ['Indicateur', 'Habitants'],
    rows: [
      { cells: ['Nourris', shareOf(development.fedShare)], hint: 'ni en disette ni en pénurie' },
      ...coverageRows,
      { cells: ['Au chômage', percent(development.unemploymentPercentage)] },
    ],
    note: 'Un service dessert une maison tant que son passage est récent.',
  })}`;
}

const TABS = Object.freeze([
  Object.freeze({ id: 'production', label: 'Production', render: productionHtml }),
  Object.freeze({ id: 'debts', label: 'Dettes', render: debtsHtml }),
  Object.freeze({ id: 'development', label: 'Développement', render: developmentHtml }),
]);

/** Renders the economy of the hamlet into its tabs. */
export async function renderEconomy() {
  const container = document.getElementById('economy-container');
  if (!container) throw new Error('[economy] the economy container is not in the page');
  container.querySelectorAll('.eco-tab-content').forEach((content) => {
    content.innerHTML = `<p class="supply-balance-loading">${WAIT}</p>`;
  });
  const economy = await deps.supply.describeEconomy();
  const basis = economy.ready ? (economy.months === 12 ? `l'année ${economy.year}` : `les ${economy.months} premiers mois, ramenés à une année`) : '';
  for (const tab of TABS) {
    const content = document.getElementById(`economy-${tab.id}-tab`);
    content.innerHTML = economy.ready
      ? `<p class="supply-balance-caveat">Chiffres annuels sur ${escapeHtml(basis)}, les dettes à l'instant. ${economy.population.toLocaleString('fr-FR')} habitants.</p>${tab.render(economy)}`
      : `<p class="supply-balance-loading">${WAIT}</p>`;
  }
}

/** @param {string} id the tab to show */
function showTab(id) {
  document.querySelectorAll('#economy-panel .eco-tab').forEach((tab) => {
    const active = tab.dataset.tab === id;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', String(active));
  });
  document.querySelectorAll('#economy-panel .eco-tab-content').forEach((content) => content.classList.toggle('active', content.id === `economy-${id}-tab`));
}

/** @param {{ supply: object, popupManager?: object | null }} panelDeps */
export function initEconomyPopup(panelDeps) {
  deps = panelDeps;
  const button = document.getElementById('economy-btn');
  const panel = document.getElementById(PANEL_ID);
  const closeButton = panel?.querySelector('.supply-traceability-close-btn');
  if (!button || !panel || !closeButton) throw new Error('[economy] the panel elements are missing from the page');

  const report = (error) => console.error('[economy] the economy could not be shown:', error);

  function close() {
    focusSession?.release();
    focusSession = null;
    panel.classList.remove('active');
    panel.setAttribute('aria-hidden', 'true');
    deps.popupManager?.forceClosePopup(PANEL_ID);
  }

  button.addEventListener('click', (event) => {
    event.stopPropagation();
    event.preventDefault();
    if (panel.classList.contains('active')) {
      close();
      return;
    }
    panel.classList.add('active');
    panel.setAttribute('aria-hidden', 'false');
    deps.popupManager?.forceOpenPopup(PANEL_ID);
    focusSession?.release({ restoreFocus: false });
    focusSession = createModalFocusSession({ panel, onEscape: close, initialFocus: '.supply-traceability-close-btn' });
    showActiveHamletLabel().catch(report);
    renderEconomy().catch(report);
  });

  closeButton.addEventListener('click', close);
  panel.querySelectorAll('.eco-tab').forEach((tab) => tab.addEventListener('click', () => showTab(tab.dataset.tab)));
}
