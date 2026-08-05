/**
 * Building info overlay layout — modal frame (index.html), tabs, open/close.
 */

export const BUILDING_INFO_TABS = Object.freeze({
  foyer: 'foyer',
  diet: 'diet',
  services: 'services',
  neighbors: 'neighbors',
  messages: 'messages',
});

const TAB_LABELS = Object.freeze({
  foyer: '🏠 Foyer',
  diet: '🍽️ Régime',
  services: '🔧 Services',
  neighbors: '🏘️ Voisins',
  messages: '💬 Messages',
});

let tabsInitialized = false;

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
    getBuildingInfoTabPanel(BUILDING_INFO_TABS.foyer)
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
 * @param {string} [groupClass] e.g. `commercants` for header accent
 */
export function setBuildingInfoGroupAccent(groupClass) {
  const panel = getOverlay()?.querySelector('.info-building-panel');
  if (!panel) return;
  panel.classList.remove(
    'info-building-panel--commercants',
    'info-building-panel--artisans-ouvriers',
    'info-building-panel--savants'
  );
  if (groupClass) {
    panel.classList.add(`info-building-panel--${groupClass}`);
  }
}

/** @param {string} tabId */
export function activateBuildingInfoTab(tabId) {
  const overlay = getOverlay();
  if (!overlay) return;

  for (const id of Object.values(BUILDING_INFO_TABS)) {
    const tab = overlay.querySelector(`[role="tab"][data-tab="${id}"]`);
    const panel = getBuildingInfoTabPanel(id);
    const isActive = id === tabId;
    if (tab) {
      tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
      tab.tabIndex = isActive ? 0 : -1;
    }
    if (panel) {
      panel.classList.toggle('is-active', isActive);
      panel.hidden = !isActive;
    }
  }
}

function handleTabKeydown(event) {
  const tabs = [...document.querySelectorAll('.info-building__tabs [role="tab"]')];
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
  activateBuildingInfoTab(BUILDING_INFO_TABS.foyer);

  for (const id of Object.values(BUILDING_INFO_TABS)) {
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

export function setFoyerTabLabel(isHouse) {
  const tab = document.querySelector('.info-building__tabs [data-tab="foyer"]');
  if (tab) {
    tab.textContent = isHouse ? '🏠 Foyer' : '🏠 Bâtiment';
  }
}

export function setBuildingInfoAriaHidden(hidden) {
  const overlay = getOverlay();
  if (overlay) overlay.setAttribute('aria-hidden', hidden ? 'true' : 'false');
}

export function openBuildingInfoOverlay(overlay = getOverlay()) {
  if (!overlay) return;
  overlay.classList.add('active');
  setBuildingInfoAriaHidden(false);
}

export function closeBuildingInfoOverlay(overlay = getOverlay()) {
  if (!overlay) return;
  overlay.classList.remove('active');
  setBuildingInfoAriaHidden(true);
}
