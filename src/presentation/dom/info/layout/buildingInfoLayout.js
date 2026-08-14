/**
 * Building info overlay layout — modal frame (index.html), tabs, open/close.
 */

import {
  BUILDING_INFO_TAB_IDS,
  BUILDING_INFO_TAB_ORDER,
  resolveBuildingInfoTabLabel,
} from '../buildingInfoTabCatalog.js';
import { createModalFocusSession } from '../../shell/modalFocus.js';

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
    'info-building-panel--scholars'
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

  overlay.classList.remove('info-building-overlay--hub-barn', 'info-building-overlay--hub-windmill');
  if (hubOverlayMode === 'barn') {
    overlay.classList.add('info-building-overlay--hub-barn');
  } else if (hubOverlayMode === 'windmill') {
    overlay.classList.add('info-building-overlay--hub-windmill');
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
 * @param {ReadonlyArray<{ emoji: string, value: string | number, label: string, ariaLabel: string }>} items
 */
export function appendIconStatRow(container, items) {
  const row = document.createElement('div');
  row.className = 'building-info-icon-row building-info-icon-row--centered';

  for (const item of items) {
    const chip = document.createElement('span');
    chip.className = 'building-info-icon-chip';
    chip.title = item.ariaLabel;
    chip.setAttribute('aria-label', item.ariaLabel);
    chip.innerHTML = `<span class="building-info-icon-chip__emoji" aria-hidden="true">${item.emoji}</span><span class="building-info-icon-chip__value">${item.value}</span><span class="building-info-icon-chip__label">${item.label}</span>`;
    row.appendChild(chip);
  }

  container.appendChild(row);
  return row;
}

/**
 * @param {HTMLElement} container
 * @param {ReadonlyArray<{ emoji: string, value: number, label: string, ariaLabel: string }>} profiles
 */
export function appendHouseholdProfiles(container, profiles) {
  if (!profiles?.length) return null;

  const wrap = document.createElement('div');
  wrap.className = 'building-info-household';

  const title = document.createElement('h3');
  title.className = 'building-info-section-label';
  title.textContent = 'Profils du foyer';
  wrap.appendChild(title);

  appendIconStatRow(
    wrap,
    profiles.map((profile) => ({
      emoji: profile.emoji,
      value: profile.count,
      label: profile.label,
      ariaLabel: profile.ariaLabel,
    })),
  );

  container.appendChild(wrap);
  return wrap;
}

/**
 * @param {HTMLElement} container
 * @param {ReadonlyArray<{ emoji: string, count: number, label: string, ariaLabel: string }>} skills
 */
export function appendHouseholdSkills(container, skills) {
  if (!skills?.length) return null;

  const wrap = document.createElement('div');
  wrap.className = 'building-info-skills';

  const title = document.createElement('h3');
  title.className = 'building-info-section-label';
  title.textContent = 'Compétences';
  wrap.appendChild(title);

  appendIconStatRow(
    wrap,
    skills.map((skill) => ({
      emoji: skill.emoji,
      value: skill.count,
      label: skill.label,
      ariaLabel: skill.ariaLabel,
    })),
  );

  container.appendChild(wrap);
  return wrap;
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
 *   subsistence?: ReadonlyArray<{ emoji: string, value: string | number, ariaLabel: string }>,
 *   farms?: ReadonlyArray<{ emoji: string, value: string | number, ariaLabel: string }>,
 *   showSubsistence?: boolean,
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

  const showSubsistence = groups.showSubsistence !== false && groups.subsistence?.length;
  if (showSubsistence) {
    groupsRow.appendChild(buildStockGroup('Chasse-cueillette', groups.subsistence));
  }

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
 * @param {ReadonlyArray<{ type?: string, instanceId?: string, x: number, y: number }>} neighbors
 */
export function renderNeighborsTab(container, neighbors) {
  container.innerHTML = '';

  if (!neighbors?.length) {
    appendStatusMessage(container, 'Aucun voisin adjacent.', 'neutral');
    return;
  }

  const table = document.createElement('table');
  table.className = 'building-info-neighbors-table';
  table.innerHTML = `
    <thead>
      <tr><th scope="col">Type</th><th scope="col">Position</th></tr>
    </thead>
    <tbody></tbody>
  `;
  const tbody = table.querySelector('tbody');

  for (const neighbor of neighbors) {
    if (neighbor.x == null || neighbor.y == null) continue;
    const tr = document.createElement('tr');
    const label = neighbor.type || neighbor.instanceId || '—';
    tr.innerHTML = `<td>${label}</td><td>(${neighbor.x}, ${neighbor.y})</td>`;
    tbody.appendChild(tr);
  }

  container.appendChild(table);
}

/** @param {HTMLElement} container */
export function renderMessagesTab(container) {
  container.innerHTML = `
    <div class="building-info-messages">
      <p class="building-info-messages-empty" role="status">Aucun message pour ce bâtiment.</p>
      <ul class="building-info-messages-list" aria-label="Messages du bâtiment"></ul>
    </div>
  `;
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
