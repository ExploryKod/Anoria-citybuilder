/**
 * Building info overlay layout — modal frame (index.html), tabs, open/close.
 */

import {
  BUILDING_INFO_TAB_IDS,
  BUILDING_INFO_TAB_ORDER,
  resolveBuildingInfoTabLabel,
} from '../buildingInfoTabCatalog.js';
import { createModalFocusSession } from '../../shell/modalFocus.js';
import { getBuildingDefinition } from '../../../../shared/building-catalog/index.js';

/** @deprecated Prefer BUILDING_INFO_TAB_IDS — kept for existing imports */
export const BUILDING_INFO_TABS = BUILDING_INFO_TAB_IDS;

let tabsInitialized = false;
/** @type {ReadonlyArray<string>} */
let visibleTabIds = [...BUILDING_INFO_TAB_ORDER];

/** @type {ReturnType<typeof createModalFocusSession> | null} */
let buildingInfoFocusSession = null;

function getOverlay() {
  return document.querySelector('.info-building-overlay');
}

/** @returns {HTMLElement | null} */
export function getBuildingInfoTabPanel(tabId) {
  return document.querySelector(`#panel-${tabId}`);
}

/** Active tab panel (foyer by default). */
export function getBuildingInfoBody() {
  return (
    getBuildingInfoTabPanel(BUILDING_INFO_TAB_IDS.foyer)
    ?? document.querySelector('.info-building__body')
  );
}

export function setBuildingInfoTitle(title) {
  const heading = document.querySelector('#info-building-title');
  if (heading) heading.textContent = title;
}

/** @param {string} html Plain text or minimal HTML for meta line */
export function setBuildingInfoMeta(html) {
  const meta = document.querySelector('#info-building-meta');
  if (!meta) return;
  if (!html) {
    meta.textContent = '';
    meta.hidden = true;
    return;
  }
  meta.innerHTML = html;
  meta.hidden = false;
}

/**
 * @param {string} tabId
 * @param {string} [groupClass] e.g. `merchants` for header accent
 */
export function setBuildingInfoGroupAccent(groupClass) {
  const panel = getOverlay()?.querySelector('.info-building-panel');
  if (!panel) return;
  panel.classList.remove(
    'info-building-panel--merchants',
    'info-building-panel--artisans',
    'info-building-panel--scholars',
    'info-building-panel--administrators'
  );
  if (groupClass) {
    panel.classList.add(`info-building-panel--${groupClass}`);
  }
}

/** @param {string} tabId */
export function activateBuildingInfoTab(tabId) {
  const overlay = getOverlay();
  if (!overlay) return;

  const targetId = visibleTabIds.includes(tabId) ? tabId : visibleTabIds[0];
  if (!targetId) return;

  for (const id of BUILDING_INFO_TAB_ORDER) {
    const tab = overlay.querySelector(`[role="tab"][data-tab="${id}"]`);
    const panel = getBuildingInfoTabPanel(id);
    const isVisible = visibleTabIds.includes(id);
    const isActive = id === targetId;
    if (tab) {
      tab.hidden = !isVisible;
      tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
      tab.tabIndex = isActive ? 0 : -1;
      // The tabs scroll sideways on a phone: the one chosen comes into view (without moving the panel itself).
      if (isActive && isVisible) tab.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    }
    if (panel) {
      panel.classList.toggle('is-active', isActive);
      panel.hidden = !isActive;
      if (!isVisible) {
        panel.hidden = true;
        panel.classList.remove('is-active');
      }
    }
  }
}

/**
 * Show only the tabs declared by the current building group.
 *
 * @param {ReadonlyArray<{ id: string, label?: string }>} tabSpecs
 */
export function syncBuildingInfoTabs(tabSpecs) {
  ensureBuildingInfoTabs();
  const overlay = getOverlay();
  if (!overlay) return;

  const specs = Array.isArray(tabSpecs) ? tabSpecs : [];
  visibleTabIds = specs
    .map((spec) => spec?.id)
    .filter((id) => BUILDING_INFO_TAB_ORDER.includes(id));

  if (visibleTabIds.length === 0) {
    visibleTabIds = [BUILDING_INFO_TAB_IDS.foyer];
  }

  const labelById = new Map(
    specs
      .filter((spec) => spec?.id)
      .map((spec) => [spec.id, resolveBuildingInfoTabLabel(spec.id, spec.label)])
  );

  for (const id of BUILDING_INFO_TAB_ORDER) {
    const tab = overlay.querySelector(`[role="tab"][data-tab="${id}"]`);
    if (!tab) continue;
    const isVisible = visibleTabIds.includes(id);
    tab.hidden = !isVisible;
    if (isVisible) {
      tab.textContent = labelById.get(id) ?? resolveBuildingInfoTabLabel(id);
    }
  }

  activateBuildingInfoTab(visibleTabIds[0]);
}

function handleTabKeydown(event) {
  const tabs = [...document.querySelectorAll('.info-building__tabs [role="tab"]:not([hidden])')];
  const currentIndex = tabs.findIndex((t) => t.getAttribute('aria-selected') === 'true');
  if (currentIndex < 0) return;

  let nextIndex = currentIndex;
  if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length;
  else if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
  else return;

  event.preventDefault();
  const nextTab = tabs[nextIndex];
  const tabId = nextTab?.dataset?.tab;
  if (tabId) {
    activateBuildingInfoTab(tabId);
    nextTab.focus();
  }
}

export function ensureBuildingInfoTabs() {
  if (tabsInitialized) return;
  const tablist = document.querySelector('.info-building__tabs');
  if (!tablist) return;

  tablist.addEventListener('click', (event) => {
    const tab = event.target.closest('[role="tab"]');
    const tabId = tab?.dataset?.tab;
    if (tabId) activateBuildingInfoTab(tabId);
  });

  tablist.addEventListener('keydown', handleTabKeydown);
  tabsInitialized = true;
}

export function resetBuildingInfoLayout() {
  ensureBuildingInfoTabs();
  setBuildingInfoTitle('Informations');
  setBuildingInfoMeta('');
  setBuildingInfoGroupAccent(null);
  applyInfoPanelLayoutOptions({ layout: 'centered', hubOverlayMode: null });
  syncBuildingInfoTabs([{ id: BUILDING_INFO_TAB_IDS.foyer }]);

  for (const id of BUILDING_INFO_TAB_ORDER) {
    const panel = getBuildingInfoTabPanel(id);
    if (panel) panel.innerHTML = '';
  }
}

/**
 * Layout chrome options (centered vs sidebar, hub overlay classes).
 *
 * @param {import('../buildingInfoTypes.js').BuildingInfoLayoutOptions} options
 */
export function applyInfoPanelLayoutOptions(options = {}) {
  const { layout = 'centered', hubOverlayMode = null } = options;
  const overlay = getOverlay();
  const panel = overlay?.querySelector('.info-building-panel');
  if (panel) {
    panel.classList.toggle('info-building-panel--sidebar', layout === 'sidebar');
  }

  if (!overlay) return;

  overlay.classList.remove('info-building-overlay--hub-barn', 'info-building-overlay--hub');
  if (hubOverlayMode === 'barn') {
    overlay.classList.add('info-building-overlay--hub-barn');
  } else if (hubOverlayMode === 'hub') {
    overlay.classList.add('info-building-overlay--hub');
  }
}

/**
 * @param {HTMLElement} container
 * @param {string} text
 * @param {'neutral'|'success'|'warning'|'error'} [variant]
 */
export function appendStatusMessage(container, text, variant = 'neutral') {
  const p = document.createElement('p');
  p.className = `building-info-status building-info-status--${variant}`;
  p.setAttribute('role', 'status');
  p.textContent = text;
  container.appendChild(p);
  return p;
}

/**
 * @param {HTMLElement} container
 * @param {ReadonlyArray<{ emoji: string, value?: string | number, label: string, ariaLabel: string }>} items
 */
export function appendIconStatRow(container, items) {
  const row = document.createElement('div');
  row.className = 'building-info-icon-row building-info-icon-row--centered';

  for (const item of items) {
    const chip = document.createElement('span');
    chip.className = 'building-info-icon-chip';
    chip.title = item.ariaLabel;
    chip.setAttribute('aria-label', item.ariaLabel);
    // A chip with a `pill` is not held yet: dimmed, with the house level that brings it in a colored pill under it.
    // A chip with no `value` (a skill: the house has it or not, there is nothing to count) shows only its icon and its word.
    const value = item.pill || item.value === undefined ? '' : `<span class="building-info-icon-chip__value">${item.value}</span>`;
    chip.innerHTML = `<span class="building-info-icon-chip__emoji" aria-hidden="true">${item.emoji}</span>${value}<span class="building-info-icon-chip__label">${item.label}</span>`;
    if (item.pill) {
      chip.classList.add('building-info-icon-chip--upcoming');
      const pill = document.createElement('span');
      pill.className = 'building-info-icon-chip__level-pill';
      pill.style.setProperty('--level-color', item.pill.color);
      pill.textContent = `niv. ${item.pill.tier}`;
      chip.appendChild(pill);
    }
    // A chip that is held (not dimmed) can still say its level, under it.
    if (item.levelPill) {
      const pill = document.createElement('span');
      pill.className = 'building-info-icon-chip__level-pill';
      pill.style.setProperty('--level-color', item.levelPill.color);
      pill.textContent = `niv. ${item.levelPill.level}`;
      chip.appendChild(pill);
    }
    row.appendChild(chip);
  }

  container.appendChild(row);
  return row;
}

/**
 * @param {HTMLElement} container
 * @param {ReadonlyArray<{ emoji: string, label: string, ariaLabel: string, level: number, color: string }>} skills the skills the house holds: its people have them all or not at all, so no count
 */
export function appendHouseholdSkills(container, skills, upcomingSkills = []) {
  if (!skills?.length && !upcomingSkills.length) return null;

  const wrap = document.createElement('div');
  wrap.className = 'building-info-skills';

  const title = document.createElement('h3');
  title.className = 'building-info-section-label';
  title.textContent = 'Compétences';
  wrap.appendChild(title);

  appendIconStatRow(
    wrap,
    [
      ...skills.map((skill) => ({
        emoji: skill.emoji,
        label: skill.label,
        ariaLabel: skill.ariaLabel,
        levelPill: { level: skill.level, color: skill.color },
      })),
      ...upcomingSkills.map((skill) => ({
        emoji: skill.emoji,
        label: skill.label,
        ariaLabel: skill.ariaLabel,
        pill: { tier: skill.tier, color: skill.color },
      })),
    ],
  );

  container.appendChild(wrap);
  return wrap;
}

/**
 * Where a household works: each employer category with its icon and how many of the household's people work there.
 * `employers` is null when the city could not say (a note, never an empty row that would read as "nobody works").
 * @param {HTMLElement} container
 * @param {ReadonlyArray<{ emoji: string, count: number, label: string, ariaLabel: string }> | null} employers
 */
export function appendHouseholdEmployers(container, employers) {
  const wrap = document.createElement('div');
  wrap.className = 'building-info-skills building-info-employers';

  const title = document.createElement('h3');
  title.className = 'building-info-section-label';
  title.textContent = 'Employeurs';
  wrap.appendChild(title);

  if (employers === null) {
    const note = document.createElement('p');
    note.className = 'building-info-footnote';
    note.textContent = "Les employeurs de cette maison ne sont pas disponibles.";
    wrap.appendChild(note);
  } else if (employers.length > 0) {
    appendIconStatRow(
      wrap,
      employers.map((employer) => ({ emoji: employer.emoji, value: employer.count, label: employer.label, ariaLabel: employer.ariaLabel })),
    );
  } else {
    // Nobody of the house works anywhere: the section says so rather than disappearing.
    const note = document.createElement('p');
    note.className = 'building-info-footnote';
    note.textContent = "Aucun habitant n'a d'employeurs.";
    wrap.appendChild(note);
  }

  container.appendChild(wrap);
  return wrap;
}

/**
 * The "Problèmes" block of a house: blocks of icon, number and word side by side. The first is the residents without a job: icon and word, then under it,
 * side by side and smaller, why (no skill, no post, no road) — those are its figures, with no total; the total shows only while the causes are not read.
 * Then the hungry, the angry, the sick. Nothing is said when the residents could not be read for the first block.
 * @param {HTMLElement} container
 * @param {{
 *   unemployed: { emoji: string, count: number, label: string, ariaLabel: string, causes: ReadonlyArray<{ emoji: string, count: number, label: string, ariaLabel: string }> } | null,
 *   others: ReadonlyArray<{ emoji: string, count: number, label: string, ariaLabel: string }>,
 * }} problems
 */
export function appendHouseholdProblems(container, problems) {
  const wrap = document.createElement('div');
  wrap.className = 'building-info-skills building-info-problems';

  const title = document.createElement('h3');
  title.className = 'building-info-section-label';
  title.textContent = 'Problèmes';
  wrap.appendChild(title);

  const row = document.createElement('div');
  row.className = 'building-info-problems__row';

  const chipOf = (item, { withCount = true } = {}) => {
    const chip = document.createElement('span');
    chip.className = 'building-info-icon-chip';
    chip.title = item.ariaLabel;
    chip.setAttribute('aria-label', item.ariaLabel);
    const count = withCount ? `<span class="building-info-icon-chip__value">${item.count}</span>` : '';
    chip.innerHTML = `<span class="building-info-icon-chip__emoji" aria-hidden="true">${item.emoji}</span>${count}<span class="building-info-icon-chip__label">${item.label}</span>`;
    return chip;
  };

  if (problems.unemployed) {
    const block = document.createElement('div');
    block.className = 'building-info-problems__block';
    // The total says nothing by itself: once the causes are known, they are the figures and the big number goes.
    block.appendChild(chipOf(problems.unemployed, { withCount: problems.unemployed.causes.length === 0 }));
    if (problems.unemployed.causes.length > 0) {
      const causes = document.createElement('div');
      causes.className = 'building-info-problems__causes';
      for (const cause of problems.unemployed.causes) {
        const mini = document.createElement('span');
        mini.className = 'building-info-problems__cause';
        mini.title = cause.ariaLabel;
        mini.setAttribute('aria-label', cause.ariaLabel);
        mini.innerHTML = `<span aria-hidden="true">${cause.emoji}</span><strong>${cause.count}</strong>`;
        causes.appendChild(mini);
      }
      block.appendChild(causes);
    }
    row.appendChild(block);
  }
  for (const item of problems.others) {
    const block = document.createElement('div');
    block.className = 'building-info-problems__block';
    block.appendChild(chipOf(item));
    row.appendChild(block);
  }

  wrap.appendChild(row);
  container.appendChild(wrap);
  return wrap;
}

/**
 * One metric card's DOM element — the card shape any icon+value fact uses (a resource's have/need, a tier
 * requirement's current/target, an activity's material/step/product...): {icon, label, met, valueText,
 * ariaLabel, detailText?, keywords?}. Shared by `appendMetricCards` (one even grid) and
 * `appendMetricCardGroups` (several tight clusters in one row) so both read the exact same markup.
 * @param {{ icon: string, label: string, met: boolean, valueText: string, ariaLabel: string, detailText?: string, keywords?: Array<{ kind: string, label: string, units: number }> }} card
 * @param {{ onSelect?: (card: object, element: HTMLElement, scope: HTMLElement) => void, scope?: HTMLElement }} [options]
 */
function createMetricCardElement(card, { onSelect, scope } = {}) {
  // A card that can be picked (to open its detail) is a button; a plain one is only a figure.
  const el = document.createElement(onSelect ? 'button' : 'div');
  el.className = `building-info-metric-card${card.met ? ' building-info-metric-card--met' : ''}`;
  if (onSelect) {
    el.type = 'button';
    el.setAttribute('aria-pressed', 'false');
    el.addEventListener('click', () => onSelect(card, el, scope));
  }
  el.title = card.ariaLabel;
  el.setAttribute('aria-label', card.ariaLabel);
  el.innerHTML = `<span class="building-info-metric-card__icon" aria-hidden="true">${card.icon}</span><span class="building-info-metric-card__label">${card.label}</span><span class="building-info-metric-card__value">${card.valueText}</span>${card.detailText ? `<span class="building-info-metric-card__detail">${card.detailText}</span>` : ''}`;
  if (card.keywords?.length) {
    const keywords = document.createElement('span');
    keywords.className = 'building-info-metric-card__keywords';
    for (const keyword of card.keywords) {
      const chip = document.createElement('span');
      chip.className = `building-info-metric-card__keyword building-info-metric-card__keyword--${keyword.kind}`;
      chip.textContent = `${keyword.label} : ${keyword.units}`;
      keywords.appendChild(chip);
    }
    el.appendChild(keywords);
  }
  return el;
}

/**
 * Generic metric-card grid — one card shape for any icon+value fact (a
 * resource's have/need, a tier requirement's current/target, ...). Adding a
 * new one never touches this function: it only reads
 * {icon, label, met, valueText, ariaLabel}.
 * @param {HTMLElement} container
 * @param {ReadonlyArray<{ kind: string, icon: string, label: string, met: boolean, valueText: string, ariaLabel: string }>} cards
 * @param {{ onSelect?: (card: object, element: HTMLElement, grid: HTMLElement) => void }} [options] Makes each card pickable.
 */
export function appendMetricCards(container, cards, { onSelect } = {}) {
  if (!cards?.length) return null;

  const grid = document.createElement('div');
  grid.className = 'building-info-metrics';

  for (const card of cards) {
    grid.appendChild(createMetricCardElement(card, { onSelect, scope: grid }));
  }

  container.appendChild(grid);
  return grid;
}

/**
 * One row, several tight clusters — an activity's raw material, its steps, its finished product, what was
 * collected: each a small group of cards close together, with normal spacing BETWEEN groups so the player
 * reads the phases apart at a glance, unlike `appendMetricCards`' one even grid. Each entry in `groups` is
 * itself a plain card array (1 card is still its own, single-card group); an empty or missing group is
 * skipped, never an empty cluster.
 * @param {HTMLElement} container
 * @param {ReadonlyArray<ReadonlyArray<{ icon: string, label: string, met: boolean, valueText: string, ariaLabel: string }>>} groups
 */
export function appendMetricCardGroups(container, groups) {
  const nonEmpty = (groups ?? []).filter((group) => group?.length);
  if (nonEmpty.length === 0) return null;

  const row = document.createElement('div');
  row.className = 'building-info-activity-row';

  for (const group of nonEmpty) {
    const cluster = document.createElement('div');
    cluster.className = 'building-info-activity-group';
    for (const card of group) {
      cluster.appendChild(createMetricCardElement(card));
    }
    row.appendChild(cluster);
  }

  container.appendChild(row);
  return row;
}

/**
 * @param {HTMLElement} container
 * @param {ReadonlyArray<{ emoji: string, value: string | number, ariaLabel: string }>} stocks
 * @param {string} [footnote]
 */
export function appendStockIconRow(container, stocks, footnote = null) {
  appendGroupedStockSections(container, { farms: stocks }, { footnote });
}

/**
 * @param {HTMLElement} container
 * @param {{
 *   farms?: ReadonlyArray<{ emoji: string, value: string | number, ariaLabel: string }>,
 * }} groups
 * @param {{ footnote?: string | null }} [options]
 */
export function appendGroupedStockSections(container, groups, options = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'building-info-stocks';

  const title = document.createElement('h3');
  title.className = 'building-info-section-label';
  title.textContent = 'Stocks';
  wrap.appendChild(title);

  const groupsRow = document.createElement('div');
  groupsRow.className = 'building-info-stock-groups';

  if (groups.farms?.length) {
    groupsRow.appendChild(buildStockGroup('Produits des fermes', groups.farms));
  }

  wrap.appendChild(groupsRow);

  if (options.footnote) {
    const note = document.createElement('p');
    note.className = 'building-info-footnote';
    note.textContent = options.footnote;
    wrap.appendChild(note);
  }

  container.appendChild(wrap);
  return wrap;
}

function buildStockGroup(label, stocks) {
  const group = document.createElement('div');
  group.className = 'building-info-stock-group';

  const groupLabel = document.createElement('p');
  groupLabel.className = 'building-info-stock-group-label';
  groupLabel.textContent = label;
  group.appendChild(groupLabel);

  group.appendChild(buildCompactIconRow(stocks));
  return group;
}

function buildCompactIconRow(stocks) {
  const row = document.createElement('div');
  row.className = 'building-info-icon-row building-info-icon-row--compact building-info-icon-row--centered';

  for (const stock of stocks) {
    const chip = document.createElement('span');
    chip.className = 'building-info-icon-chip building-info-icon-chip--compact';
    chip.title = stock.ariaLabel;
    chip.setAttribute('aria-label', stock.ariaLabel);
    chip.innerHTML = `<span class="building-info-icon-chip__emoji" aria-hidden="true">${stock.emoji}</span><span class="building-info-icon-chip__value">${stock.value}</span>`;
    row.appendChild(chip);
  }

  return row;
}

/** @param {HTMLElement} container */
export function appendLocationFootnote(container, anchorX, anchorY) {
  const p = document.createElement('p');
  p.className = 'building-info-footnote building-info-footnote--location';
  p.textContent = `📍 (${anchorX}, ${anchorY})`;
  container.appendChild(p);
  return p;
}

/**
 * @param {HTMLElement} container
 * @param {{ complaints: ReadonlyArray<string | { text: string, detail: string }> }} [model]
 */
export function renderMessagesTab(container, model) {
  const complaints = model?.complaints ?? [];
  const hasComplaints = complaints.length > 0;

  container.innerHTML = `
    <div class="building-info-messages">
      <p class="building-info-messages-empty" role="status" ${hasComplaints ? 'hidden' : ''}>Aucun message pour ce bâtiment.</p>
      <ul class="building-info-messages-list" aria-label="Messages du bâtiment"></ul>
    </div>
  `;

  if (!hasComplaints) return;

  const list = container.querySelector('.building-info-messages-list');
  for (const complaint of complaints) {
    const li = document.createElement('li');
    li.className = 'building-info-messages-item';
    // A short text, its detail in a tooltip (see the departures of a house); a plain sentence has none.
    if (typeof complaint === 'string') {
      li.textContent = complaint;
    } else {
      li.textContent = complaint.text;
      li.title = complaint.detail;
    }
    list.appendChild(li);
  }
}

export function setBuildingInfoAriaHidden(hidden) {
  const overlay = getOverlay();
  if (overlay) overlay.setAttribute('aria-hidden', hidden ? 'true' : 'false');
}

export function openBuildingInfoOverlay(overlay = getOverlay()) {
  if (!overlay) return;
  overlay.classList.add('active');
  overlay.removeAttribute('inert');
  setBuildingInfoAriaHidden(false);
  buildingInfoFocusSession?.release({ restoreFocus: false });
  buildingInfoFocusSession = createModalFocusSession({
    panel: overlay,
    onEscape: () => closeBuildingInfoOverlay(overlay),
    initialFocus: '.panel-close-btn',
    ensureDialogAttributes: false,
  });
}

export function closeBuildingInfoOverlay(overlay = getOverlay()) {
  if (!overlay) return;
  buildingInfoFocusSession?.release();
  buildingInfoFocusSession = null;
  overlay.classList.remove('active');
  overlay.setAttribute('inert', '');
  setBuildingInfoAriaHidden(true);
}
