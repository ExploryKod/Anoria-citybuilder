/**
 * SupplyBalancePanel — the panel the right-hand button opens: does the city make what its citizens use up, does it reach them, and how many producers are missing?
 * A card per need. The figures of the theory (what the producers standing could make in a year against what the citizens use) and the figures of what happened (what the
 * producers sold on, what was lost to spoilage, what is in stock, what was sold to the houses) come from `supply.describeSupplyBalance()`; the hunger of the inhabitants (disette,
 * pénurie) from `housing.getHunger()`. Every word the catalog decides is read from it. The satisfaction history tab belongs to SupplyTraceabilityPanel.js.
 */

import { buildingName, goodAmount, goodLabel, namesOfBuildings, scheduleLabel } from '../shell/CatalogVocabulary.js';
import { createModalFocusSession } from '../shell/modalFocus.js';
import { showActiveHamletLabel } from '../admin/supply-traceability/SupplyTraceabilityPanel.js';
import { getResourceStockShape } from '../../../shared/building-catalog/resourceRoleQueries.js';
import { HUNGER_CAUSES, HUNGER_RISK } from '../../../shared/population/HungerCauseCatalog.js';
import { TimeManager } from '../../../shared/time/TimeManager.js';
import { toSupplyMonth, toSupplySeason } from '../../../composition/supplyTimeLabels.js';
import { monthsWithoutStock } from '../../../shared/resource-catalog/CropCalendarPolicy.js';
import { getSessionGameTime } from '../../../composition/sessionRuntime.js';

/** @type {{ supply: { describeSupplyBalance: () => Promise<Array<object>>, describePurchasingPower: () => Promise<object> }, housing: { getHunger: () => Promise<{ famished: number, disette: number, penurie: number, atRisk: { disette: number, penurie: number } }> }, popupManager?: object | null } | null} */
let deps = null;

/** @type {ReturnType<typeof createModalFocusSession> | null} */
let focusSession = null;

const PANEL_ID = 'supply-balance-panel';

/** @param {unknown} value @returns {string} safe inside a text node */
function escapeHtml(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

const plural = (count, one, many) => (count > 1 ? many : one);

/** One line of figures: its label on the left, its value on the right. `tone` colours a value that asks for attention. */
function figureHtml(label, value, tone = '') {
  return `<div><dt>${escapeHtml(label)}</dt><dd${tone ? ` class="bal-tone-${tone}"` : ''}>${escapeHtml(value)}</dd></div>`;
}

/** One section of a card: a small title, its lines, and at most one muted note. `wide` spans the card (the calendar reads as sentences, not figures). */
function blockHtml(kind, title, figures, note = '') {
  return `<section class="bal-section bal-section--${kind}">
    <h5>${escapeHtml(title)}</h5>
    <dl>${figures.join('')}</dl>
    ${note ? `<p class="bal-note">${escapeHtml(note)}</p>` : ''}
  </section>`;
}

/**
 * What the chain of the need says: a short status for the chip, and the sentence that explains it when there is something to act on.
 * @param {object} balance
 * @param {string} producerNames
 * @returns {{ chip: string, sentence: string }} `sentence` is html, '' when the status says it all
 */
function verdictOf(balance, producerNames) {
  switch (balance.verdict) {
    case 'idle':
      return { chip: 'Personne à approvisionner', sentence: '' };
    case 'missing':
      return {
        chip: `Il manque ${balance.buildingsMissing} bâtiment${plural(balance.buildingsMissing, '', 's')}`,
        sentence: `Pour approvisionner tout le monde : ${escapeHtml(producerNames)}.`,
      };
    case 'leaking':
      return { chip: 'Des pertes en route', sentence: "La production théorique suffit, mais une partie n'arrive pas aux habitants." };
    case 'ok':
      return { chip: 'Suffisant', sentence: '' };
    default:
      throw new Error(`[supply-balance] unknown verdict "${balance.verdict}" for ${balance.totalKey}`);
  }
}

/** What goes wrong for each good: nobody buys it, or it is lost to spoilage. */
function goodAlertsHtml(balance) {
  const alerts = [];
  for (const good of balance.goods) {
    if (good.neverCollected) {
      alerts.push(`${goodLabel(good.category)} : aucun achat en ${balance.months} mois, ${goodAmount(good.category, Math.round(good.stocks.producers))} en attente chez les producteurs.`);
    }
    if (good.spoiled > 0) alerts.push(`${goodLabel(good.category)} : ${goodAmount(good.category, Math.round(good.spoiled))} perdus par avarie.`);
  }
  if (alerts.length === 0) return '';
  return `<ul class="bal-alerts">${alerts.map((alert) => `<li>${escapeHtml(alert)}</li>`).join('')}</ul>`;
}

const MONTHS_IN_YEAR = 12;

/** The month of the year (0 = January) a month of the supply calendar falls in, read from the game's own calendar. */
function monthIndexOfSupplyMonth(supplyMonth) {
  const index = Array.from({ length: MONTHS_IN_YEAR }, (_, month) => toSupplyMonth(TimeManager.getTimeInfo(month * TimeManager.DAYS_PER_MONTH).month)).indexOf(supplyMonth);
  if (index < 0) throw new Error(`[supply-balance] "${supplyMonth}" is not a month of the calendar`);
  return index;
}

/** The first month of a harvest season (the month before is in another season). */
function firstMonthOfSeasons(seasons) {
  const seasonOf = (month) => toSupplySeason(TimeManager.getTimeInfo(((month + MONTHS_IN_YEAR) % MONTHS_IN_YEAR) * TimeManager.DAYS_PER_MONTH).season);
  for (let month = 0; month < MONTHS_IN_YEAR; month += 1) {
    if (seasons.includes(seasonOf(month)) && !seasons.includes(seasonOf(month - 1))) return month;
  }
  throw new Error(`[supply-balance] no month of the calendar starts the season ${seasons.join('/')}`);
}

/** How many months after its harvest a crop is sold the next time: a year, plus the gap between its harvest and its sale month. */
function monthsToNextSaleOf({ harvest, sale }) {
  const harvestMonth = firstMonthOfSeasons(harvest.values);
  const saleMonth = monthIndexOfSupplyMonth(sale.values[0]);
  return MONTHS_IN_YEAR + ((saleMonth - harvestMonth + MONTHS_IN_YEAR) % MONTHS_IN_YEAR);
}

/**
 * The calendar of each seasonal good of a need, as the catalog declares it (harvest, sale, how long it keeps), and what it means: a crop that goes bad before the next purchase is gone from
 * its store for some months, and the crops that keep the worst are the ones to watch. Not a defect: perishable crops are part of the game, and the player is told.
 * @param {object} balance
 * @returns {string} the block, or '' when no good of the need is seasonal
 */
function calendarHtml(balance) {
  const seasonal = balance.goods.filter((good) => good.calendar);
  if (seasonal.length === 0) return '';
  const store = namesOfBuildings('hub', balance.categories).join(' / ');
  const lines = seasonal.map((good) => {
    const { harvest, sale, keepsMonths, keepsInStoreMonths } = good.calendar;
    const parts = [`Récolte : ${scheduleLabel(harvest)}`];
    if (sale) parts.push(`Vente : ${scheduleLabel(sale)}`);
    if (keepsMonths) parts.push(`Se garde ${keepsMonths} mois (${keepsInStoreMonths} mois : ${store})`);
    return figureHtml(goodLabel(good.category), parts.join(' · '));
  });
  const gaps = seasonal
    .filter((good) => good.calendar.sale)
    .map((good) => ({ good, gap: monthsWithoutStock({ keepsInStoreMonths: good.calendar.keepsInStoreMonths, monthsToNextSale: monthsToNextSaleOf(good.calendar) }) }))
    .filter(({ gap }) => gap > 0);
  const keepers = seasonal.filter((good) => good.calendar.keepsInStoreMonths !== null).sort((a, b) => a.calendar.keepsInStoreMonths - b.calendar.keepsInStoreMonths);
  const notes = gaps.map(({ good, gap }) => `${goodLabel(good.category)} : plus de stock au ${store} pendant ${gap} mois par an, avant l'achat suivant.`);
  if (keepers.length > 1 && keepers[0].calendar.keepsInStoreMonths < keepers[keepers.length - 1].calendar.keepsInStoreMonths) {
    notes.push(`Se gardent le moins bien : ${goodLabel(keepers[0].category)}. Se garde le mieux : ${goodLabel(keepers[keepers.length - 1].category)}. Beaucoup du premier pour peu du second : risque d'avarie.`);
  }
  return blockHtml('calendar', 'Calendrier et conservation', lines, notes.join(' '));
}

/** The hunger of the inhabitants, told by its two causes (the words are the catalog's: HungerCauseCatalog.js). */
function hungerHtml(hunger) {
  const line = (cause, count) => figureHtml(`${HUNGER_CAUSES[cause].icon} ${HUNGER_CAUSES[cause].label}`, `${count} ${plural(count, 'habitant', 'habitants')}`);
  const atRisk = hunger.atRisk.disette + hunger.atRisk.penurie;
  return blockHtml(
    'hunger',
    'Faim en ce moment',
    [line('disette', hunger.disette), line('penurie', hunger.penurie), figureHtml(`${HUNGER_RISK.icon} ${HUNGER_RISK.label}`, `${atRisk} ${plural(atRisk, 'habitant', 'habitants')}`)],
    `${HUNGER_CAUSES.disette.label} : ${HUNGER_CAUSES.disette.detail}. ${HUNGER_CAUSES.penurie.label} : ${HUNGER_CAUSES.penurie.detail}. Les deux mènent à la famine.`,
  );
}

/**
 * One need as a card: its name and status, then the figures in sections side by side: the theory, what happened over the year, what is in stock, the hunger.
 * @param {object} balance a need of `describeSupplyBalance`
 * @param {{ famished: number, disette: number, penurie: number, atRisk: { disette: number, penurie: number } }} hunger
 * @returns {string}
 */
function balanceCardHtml(balance, hunger) {
  const label = escapeHtml(goodLabel(balance.totalKey));
  const producerNames = namesOfBuildings('producer', balance.categories).join(' / ');
  const { chip, sentence } = verdictOf(balance, producerNames);
  const head = `<header class="bal-head"><h4>${label}</h4><span class="bal-chip bal-chip--${balance.verdict}">${escapeHtml(chip)}</span></header>`;
  if (balance.verdict === 'idle') return `<article class="bal-card">${head}</article>`;
  const units = (count) => goodAmount(balance.totalKey, Math.round(count));
  const idle = balance.producers - balance.working;
  const sections = [
    blockHtml(
      'theory',
      'Plafond théorique, sur l\'année',
      [
        figureHtml('Besoin', units(balance.demand)),
        figureHtml('Production à pleine activité', units(balance.capacity)),
        figureHtml('Bâtiments en activité', `${balance.working} sur ${balance.producers}`, idle > 0 ? 'warn' : ''),
        figureHtml('Un bâtiment de plus apporte', `${units(balance.yieldPerBuilding)} par an`),
      ],
      idle > 0 ? `${idle} bâtiment${plural(idle, '', 's')} à l'arrêt (sans route ou sans personnel).` : '',
    ),
    blockHtml(`observed`, `Ce qui s'est passé, ${balance.months} derniers mois`, [
      figureHtml('Vendu par les producteurs aux stocks', units(balance.observed.collected)),
      figureHtml('Perdu par avarie', units(balance.observed.spoiled), balance.observed.spoiled > 0 ? 'warn' : ''),
      figureHtml('Livré aux maisons', units(balance.observed.sold)),
    ]),
    blockHtml('stock', 'En stock maintenant', [
      figureHtml('Chez les producteurs', units(balance.stocks.producers)),
      figureHtml(namesOfBuildings('hub', balance.categories).join(' / '), units(balance.stocks.hubs)),
      figureHtml(namesOfBuildings('distributor', balance.categories).join(' / '), units(balance.stocks.distributors)),
    ]),
  ];
  if (balance.totalKey === getResourceStockShape().totalKey) sections.push(hungerHtml(hunger));
  return `<article class="bal-card">
    ${head}
    ${sentence ? `<p class="bal-verdict">${sentence}</p>` : ''}
    ${goodAlertsHtml(balance)}
    <div class="bal-sections">${sections.join('')}</div>
    ${calendarHtml(balance)}
  </article>`;
}

/** Renders the balance of every need into its tab: the ones with something missing first. */
export async function renderSupplyBalance() {
  const container = document.getElementById('supply-balance-container');
  if (!container) throw new Error('[supply-balance] the balance container is not in the page');
  container.innerHTML = '<p class="supply-balance-loading">…</p>';
  const [balances, hunger] = await Promise.all([deps.supply.describeSupplyBalance(), deps.housing.getHunger()]);
  const severity = { missing: 0, leaking: 1, ok: 2, idle: 3 };
  const ordered = [...balances].sort((a, b) => severity[a.verdict] - severity[b.verdict]);
  container.innerHTML = `<p class="supply-balance-caveat">Le plafond est une théorie : ce que les bâtiments debout pourraient produire à pleine activité. Le reste dit ce qui s'est réellement passé.</p>${ordered
    .map((balance) => balanceCardHtml(balance, hunger))
    .join('')}`;
}

const euros = (amount) => `${amount.toFixed(2).replace('.', ',').replace('-', '−')} €`;

/**
 * One kind of house, one row: what it earns in a month, what it must pay, what is left, what its basic needs cost, and how much of the basket the rest covers.
 * The savings and the goods really bought stay in the row's tooltip: they are not what the row is about.
 * @param {object} kind a kind of `describePurchasingPower`
 * @returns {string} html
 */
function purchasingPowerRowHtml(kind) {
  const { perHouse } = kind;
  const covered = kind.coverage === null ? null : Math.round(kind.coverage * 100);
  const status = covered === null ? 'idle' : covered >= 100 ? 'ok' : 'short';
  const detail = `Épargne ${euros(perHouse.savings)} · achats de biens constatés ${euros(perHouse.goodsBought)} par maison et par mois`;
  const short = kind.housesShort > 0 ? `<span class="power-short">${kind.housesShort} sur ${kind.houses} sous le panier</span>` : '';
  return `<div class="power-row" role="row" title="${escapeHtml(detail)}">
    <div class="power-kind" role="cell"><strong>${escapeHtml(buildingName(kind.type))}</strong><span>${kind.houses} maison${plural(kind.houses, '', 's')} · ${kind.residents} habitant${plural(kind.residents, '', 's')}</span>${short}</div>
    <div class="power-figure power-secondary" role="cell">${euros(perHouse.income)}</div>
    <div class="power-figure power-secondary" role="cell">${euros(-perHouse.mandatory)}</div>
    <div class="power-figure power-strong" role="cell">${euros(perHouse.livingMargin)}</div>
    <div class="power-figure" role="cell">${euros(perHouse.basket)}</div>
    <div class="power-cover power-cover--${status}" role="cell">
      <span class="power-chip">${covered === null ? '…' : `${covered} %`}</span>
      <span class="power-bar" aria-hidden="true"><span style="width:${Math.min(100, covered ?? 0)}%"></span></span>
    </div>
  </div>`;
}

/** Renders the purchasing power of the houses into its tab: one table, one row per kind of house. */
export async function renderPurchasingPower() {
  const container = document.getElementById('supply-power-container');
  if (!container) throw new Error('[supply-balance] the purchasing-power container is not in the page');
  container.innerHTML = '<p class="supply-balance-loading">…</p>';
  const power = await deps.supply.describePurchasingPower();
  if (!power.ready) {
    container.innerHTML = '<p class="supply-balance-loading">…</p>';
    return;
  }
  const basis = power.months === 12 ? `l'année ${power.year}` : `les ${power.months} premiers mois`;
  const unpriced = [...new Set(power.kinds.flatMap((kind) => kind.unpriced))];
  const unpricedNote = unpriced.length > 0 ? `<p class="power-note">Pas de marché pour : ${escapeHtml(unpriced.map((totalKey) => goodLabel(totalKey)).join(', '))}. Ces besoins ne sont pas comptés dans le panier.</p>` : '';
  container.innerHTML = `<section class="power-card">
    <p class="power-caption">Par maison et par mois, en moyenne sur ${escapeHtml(basis)}. Le reste à vivre est ce qui reste des revenus après les impôts, cotisations, services et loyer ; le panier est ce que coûtent les besoins de base aux prix du marché.</p>
    <div class="power-table" role="table">
      <div class="power-row power-head" role="row">
        <div role="columnheader">Catégorie</div>
        <div class="power-figure power-secondary" role="columnheader">Revenus</div>
        <div class="power-figure power-secondary" role="columnheader">Charges</div>
        <div class="power-figure" role="columnheader">Reste à vivre</div>
        <div class="power-figure" role="columnheader">Panier</div>
        <div class="power-cover" role="columnheader">Couverture</div>
      </div>
      ${power.kinds.map(purchasingPowerRowHtml).join('')}
    </div>
    ${unpricedNote}
  </section>`;
}

/**
 * Downloads what the panel shows, as one JSON file: the balance of every need, the hunger of the inhabitants and the purchasing power of the houses, as the queries return them,
 * with the turn they were read at. The real date only stamps the file name (the game's own dates are turns).
 */
export async function exportSupplyBalanceToJSON() {
  if (!deps) throw new Error('[supply-balance] the panel is not initialised: its figures cannot be exported');
  const [balances, hunger, purchasingPower] = await Promise.all([deps.supply.describeSupplyBalance(), deps.housing.getHunger(), deps.supply.describePurchasingPower()]);
  const payload = { exportDate: new Date().toISOString(), turn: getSessionGameTime(), balances, hunger, purchasingPower };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `approvisionnement-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * @param {{ supply: object, housing: object, popupManager?: object | null }} panelDeps
 */
export function initSupplyBalancePopup(panelDeps) {
  deps = panelDeps;
  const button = document.getElementById('supply-balance-btn');
  const panel = document.getElementById(PANEL_ID);
  const closeButton = panel?.querySelector('.supply-traceability-close-btn');
  const balanceTab = panel?.querySelector('.supply-traceability-tab[data-tab="balance"]');
  if (!button || !panel || !closeButton || !balanceTab) throw new Error('[supply-balance] the panel elements are missing from the page');

  const report = (error) => console.error('[supply-balance] the balance could not be shown:', error);

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
    renderSupplyBalance().catch(report);
  });

  closeButton.addEventListener('click', close);
  panel.querySelector('.supply-balance-export-btn')?.addEventListener('click', () => exportSupplyBalanceToJSON().catch(report));
  balanceTab.addEventListener('click', () => renderSupplyBalance().catch(report));
  panel.querySelector('.supply-traceability-tab[data-tab="power"]')?.addEventListener('click', () => renderPurchasingPower().catch(report));
}
