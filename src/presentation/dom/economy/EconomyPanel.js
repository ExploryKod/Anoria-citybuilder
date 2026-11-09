/**
 * EconomyPanel — the panel the button under the supply one opens: how big is the economy of the hamlet, how much does it owe and to whom, how well do its inhabitants live? Only a
 * reading: nothing here asks the player for a decision. Three tabs, each a few tables: Production (the domestic product), Dettes (public and of the companies), Développement (the
 * human development index and what it is made of). The figures come from `supply.describeEconomy()`, all derived from the journal, the markets and the houses, never stored; the
 * words a service goes by are the catalog's.
 */

import { createModalFocusSession } from '../shell/modalFocus.js';
import { goodLabel } from '../shell/CatalogVocabulary.js';
import { showActiveHamletLabel } from '../admin/supply-traceability/SupplyTraceabilityPanel.js';
import { bindStaticHelps } from '../shell/HelpButton.js';
import { html } from '../shell/safeHtml.js';
import { tableHtml } from './ecoTable.js';
import { renderTradeBalanceTab } from './TradeBalanceTab.js';

/** @type {{ supply: { describeEconomy: () => Promise<object> }, accounting: { getCityBorrowing: () => Promise<object> }, popupManager?: object | null } | null} */
let deps = null;

/** @type {ReturnType<typeof createModalFocusSession> | null} */
let focusSession = null;

const PANEL_ID = 'economy-panel';

const WAIT = '…';
// `|| 0` turns a rounded -0 into 0: "−0 €" is not a figure.
const euros = (amount) => (amount === null ? WAIT : `${(Math.round(amount) || 0).toLocaleString('fr-FR')} €`.replace('-', '−'));
const percent = (value) => (value === null ? WAIT : `${(Math.round(value * 10) / 10 || 0).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`.replace('-', '−'));
const shareOf = (share) => (share === null ? WAIT : percent(Math.round(share * 1000) / 10));
const index = (value) => (value === null ? WAIT : value.toLocaleString('fr-FR', { minimumFractionDigits: 3, maximumFractionDigits: 3 }));
const names = (services) => services.map((service) => goodLabel(service)).join(' ou ');

/** @param {object} economy a ready `describeEconomy` @returns {import('../shell/safeHtml.js').SafeHtml} the Production tab */
function productionHtml(economy) {
  const { perInhabitant } = economy;
  const parts = economy.valueAdded + economy.publicOutput;
  const part = (amount) => (parts > 0 ? percent(Math.round((amount / parts) * 1000) / 10) : WAIT);
  return html`${tableHtml({
    caption: 'Produit intérieur, sur une année',
    heads: ['Indicateur', 'Montant', 'Par habitant'],
    rows: [
      { cells: ['PIB', euros(economy.gdp), euros(perInhabitant.gdp)], hint: 'ce que les entreprises ajoutent, plus l\'administration à son coût', help: { id: 'economy.gdp', reading: { figures: { gdp: economy.gdp } } } },
      { cells: ['PIB en parité de pouvoir d\'achat', euros(economy.gdpPpp), euros(perInhabitant.gdpPpp)], help: { id: 'economy.gdpPpp' }, hint: economy.parity === null ? 'pas encore de marché pour comparer les prix' : `prix du panier de référence ÷ prix ici = ${economy.parity.toLocaleString('fr-FR')}` },
      { cells: ['PNB', euros(economy.gni), euros(perInhabitant.gni)], help: { id: 'economy.gni', reading: { figures: { interest: economy.externalInterest } } }, hint: `PIB moins ${euros(economy.externalInterest)} d'intérêts versés hors du jeu` },
    ],
  })}
  ${tableHtml({
    caption: 'D\'où vient le PIB',
    help: { id: 'economy.gdpOrigin' },
    // Said up front, not only behind the "?": a negative value added makes the whole product unrepresentative (the companies, still founding themselves, spend more than they sell).
    warning: economy.valueAdded < 0 ? 'Les entreprises ont acheté plus qu\'elles n\'ont vendu sur la période : ce PIB ne reflète pas une économie qui tourne. Souvent, des entreprises viennent d\'être fondées, ou ne produisent pas faute d\'ouvriers (voir l\'onglet Emploi).' : '',
    heads: ['Composante', 'Montant', 'Part'],
    rows: [
      {
        cells: ['Valeur ajoutée des entreprises', euros(economy.valueAdded), part(economy.valueAdded)],
        hint: economy.valueAdded < 0
          ? `négative : ce que les ${economy.privateDebt.companies} entreprises ont vendu ne couvre pas ce qu'elles ont acheté pour produire`
          : `ce que les ${economy.privateDebt.companies} entreprises ont vendu moins ce qu'elles ont acheté pour produire`,
        tone: economy.valueAdded < 0 ? 'bad' : 'good',
      },
      { cells: ['Salaires de la ville (administration)', euros(economy.publicOutput), part(economy.publicOutput)], hint: 'seulement les salariés de la ville ; ceux des entreprises sont déjà dans leur valeur ajoutée' },
      { cells: ['PIB', euros(economy.gdp), parts > 0 ? '100 %' : WAIT], strong: true },
    ],
  })}`;
}

/** @param {object} economy a ready `describeEconomy` @param {{ ceiling: number, headroom: number }} borrowing the ceiling the lenders put on the city's debt @returns {string} the Dettes tab */
function debtsHtml(economy, borrowing) {
  const { publicDebt: debt, privateDebt, ratios } = economy;
  const ofGdp = (amount) => (economy.gdp > 0 ? percent(Math.round((amount / economy.gdp) * 1000) / 10) : WAIT);
  const ofLoans = (amount) => (debt.loans > 0 ? percent(Math.round((amount / debt.loans) * 1000) / 10) : WAIT);
  const { ceiling, headroom } = borrowing;
  return html`${tableHtml({
    caption: 'Dette publique',
    help: { id: 'economy.debt', reading: { state: headroom > 0 ? 'room' : 'ceiling', figures: { gross: debt.gross, ceiling, headroom } } },
    heads: ['Poste', 'Montant', 'Du PIB'],
    rows: [
      { cells: ['Prêts', euros(debt.loans), ofGdp(debt.loans)] },
      { cells: ['Découvert de la ville', euros(debt.overdraft), ofGdp(debt.overdraft)] },
      { cells: ['Dettes fournisseurs', euros(debt.suppliers), ofGdp(debt.suppliers)] },
      { cells: ['Dette brute', euros(debt.gross), percent(ratios.grossDebtOfGdp)], strong: true },
      { cells: ['Trésorerie', euros(debt.cash), ofGdp(debt.cash)], hint: 'l\'argent en caisse, déduit de la dette' },
      { cells: ['Créances', euros(debt.receivables), ofGdp(debt.receivables)], hint: 'ce qu\'on doit à la ville, déduit de la dette' },
      { cells: ['Prêts accordés aux entreprises', euros(debt.loansGranted), ofGdp(debt.loansGranted)], hint: 'déduits de la dette ; ils reviennent à mesure des remboursements' },
      debt.net < 0
        ? { cells: ['Ville créancière nette', euros(-debt.net), percent(ratios.netDebtOfGdp === null ? null : -ratios.netDebtOfGdp)], strong: true, tone: 'good', hint: 'elle détient plus qu\'elle ne doit' }
        : { cells: ['Ville débitrice nette', euros(debt.net), percent(ratios.netDebtOfGdp)], strong: true, tone: 'bad' },
      { cells: ['Participations dans les entreprises', euros(debt.holdings), ofGdp(debt.holdings)], hint: 'le capital que la ville a investi : non déduit de la dette, il n\'est pas liquide' },
    ],
  })}
  ${tableHtml({
    caption: 'Qui détient la dette',
    heads: ['Détenteur', 'Montant', 'Des prêts'],
    rows: [
      { cells: ['Banques du jeu', euros(debt.domesticLoans), ofLoans(debt.domesticLoans)], hint: 'créanciers domestiques : les intérêts restent dans l\'économie' },
      { cells: ['Hors du jeu', euros(debt.loans - debt.domesticLoans), ofLoans(debt.loans - debt.domesticLoans)], hint: 'les intérêts quittent l\'économie' },
      { cells: ['Épargne des ménages', euros(economy.householdSavings), WAIT], hint: ratios.savingsCoverOfPublicDebt === null ? '' : `couvre ${percent(ratios.savingsCoverOfPublicDebt)} de la dette brute` },
      { cells: ['Trésorerie des entreprises', euros(economy.companyCash), WAIT], hint: ratios.companyCashCoverOfPublicDebt === null ? 'celle des entreprises qui ont de l\'argent' : `couvre ${percent(ratios.companyCashCoverOfPublicDebt)} de la dette brute` },
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
  return html`${tableHtml({
    caption: 'Indice de développement humain',
    help: { id: 'economy.hdi', reading: development.hdi === null ? { state: 'invalid' } : { state: 'valid', figures: { hdi: development.hdi } } },
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
    content.innerHTML = html`<p class="supply-balance-loading">${WAIT}</p>`;
  });
  const [economy, borrowing] = await Promise.all([deps.supply.describeEconomy(), deps.accounting.getCityBorrowing()]);
  // What the city paid abroad in interest: the commentary of the trade tab quotes it. Not known while the economy is not measured.
  lastInterest = economy.ready ? economy.externalInterest : null;
  const basis = economy.ready ? (economy.months === 12 ? 'les 12 derniers mois' : `les ${economy.months} premiers mois, ramenés à une année`) : '';
  for (const tab of TABS) {
    const content = document.getElementById(`economy-${tab.id}-tab`);
    const markup = economy.ready
      ? html`<p class="supply-balance-caveat">Chiffres annuels sur ${basis}, les dettes à l'instant. ${economy.population.toLocaleString('fr-FR')} habitants.</p>${tab.render(economy, borrowing)}`
      : html`<p class="supply-balance-loading">${WAIT}</p>`;
    content.innerHTML = html`${markup}`;
    bindStaticHelps(content);
  }
  // The trade tab is read when it is shown (see showTab), not with the others: if it is the one open, it is read now.
  if (document.getElementById('economy-trade-tab')?.classList.contains('active')) drawTradeTab();
}

/** What the economy says the city paid abroad in interest over twelve months, or null while it is not known. */
let lastInterest = null;

/** Reads the trade balance and draws it in its tab: when the tab is opened, never before. */
function drawTradeTab() {
  const container = document.getElementById('economy-trade-tab');
  if (!container) throw new Error('[economy] #economy-trade-tab is missing from the page');
  renderTradeBalanceTab(container, { accounting: deps.accounting, interest: lastInterest }).catch((error) => console.error('[economy] the trade balance could not be shown:', error));
}

/** @param {string} id the tab to show */
function showTab(id) {
  document.querySelectorAll('#economy-panel .eco-tab').forEach((tab) => {
    const active = tab.dataset.tab === id;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-selected', String(active));
  });
  document.querySelectorAll('#economy-panel .eco-tab-content').forEach((content) => content.classList.toggle('active', content.id === `economy-${id}-tab`));
  if (id === 'trade') drawTradeTab();
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
