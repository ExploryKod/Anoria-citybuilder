import {
  loaderButton,
  panelLayout,
  panelLayoutInner,
  toolBarButtons,
} from '../shell/nodes.js';
import {
  buildFinanceLegendPanelHtml,
  buildToolbarLegendPanelHtml,
} from '../help/legendHelpContent.js';
import { getBuildingDisplayName } from '../shell/BuildingNotifications.js';
import { syncMobileClickStateFab } from './MobileClickStateFab.js';
import {
  attachBuildToolHoverPreview,
  hideBuildToolHoverPreview,
} from './BuildToolHoverPreview.js';
import { BUILDING_ASSETS } from '../../three/assets/buildingAssets.js';
import { NATURE_ASSETS } from '../../three/assets/natureAssets.js';
import { TERRAIN_ASSETS } from '../../three/assets/terrainAssets.js';

/**
 * Single source of truth for every placeable id's carousel button (icon,
 * label, tooltip) — see the three asset catalogs. No legacy fallback: a
 * toolId missing here, or with `button: null`, is a bug to fix in the
 * catalog, not a case to silently paper over with a default icon.
 */
const ASSET_CATALOG = { ...BUILDING_ASSETS, ...NATURE_ASSETS, ...TERRAIN_ASSETS };

/**
 * @param {string} toolId
 * @returns {{ group: string, label: string, tooltip: string, icon: { kind: string, value: string } }}
 */
function catalogButton(toolId) {
  const entry = ASSET_CATALOG[toolId];
  if (!entry) {
    throw new Error(
      `[ToolPanel] No asset-catalog entry for "${toolId}" — add it to buildingAssets.js / natureAssets.js / terrainAssets.js`
    );
  }
  if (!entry.button) {
    throw new Error(
      `[ToolPanel] Asset "${toolId}" has button: null in its catalog entry — it is not a placeable carousel button`
    );
  }
  return entry.button;
}

/**
 * Every id whose catalog `button.group` matches — the catalog is the ONLY
 * source of category membership for the real gameplay carousel: add/remove/
 * regroup an entry in the three asset catalogs and the panel updates on the
 * next dev-server reload, no other file to touch.
 * @param {string} group
 * @returns {string[]}
 */
function catalogIdsByGroup(group) {
  return Object.entries(ASSET_CATALOG)
    .filter(([, entry]) => entry.button?.group === group)
    .map(([id]) => id);
}

/** @type {{
 *   popupManager?: object | null,
 *   buttonStateManager?: object | null,
 *   playGame?: () => void,
 *   invokeSetActiveTool?: (e: Event) => void,
 * } | null} */
let deps = null;

/**
 * @param {{
 *   popupManager?: object | null,
 *   buttonStateManager?: object | null,
 *   playGame?: () => void,
 *   invokeSetActiveTool?: (e: Event) => void,
 * }} panelDeps
 */
export function bindToolPanelDeps(panelDeps) {
  deps = panelDeps;
}

const GROUP_CREATORS = {
  houses: () => fillPanelFromToolIds('houses'),
  residential: () => fillPanelFromToolIds('houses'),
  palaces: () => fillPanelFromToolIds('palaces'),
  farms: () => fillPanelFromToolIds('farms'),
  industry: () => fillPanelFromToolIds('industry'),
  markets: () => fillPanelFromToolIds('markets', { exclude: ['Market-Stall'] }),
  infrastructure: () =>
    fillPanelFromToolIds('infrastructure', {
      exclude: [
        'StonePath-001',
        'StonePath-Right-001',
        'StonePath-Left-001',
        'StonePath-Cross-001',
      ],
    }),
  public: () => fillPanelFromToolIds('public'),
  nature: () => fillPanelFromToolIds('nature'),
  decoration: () => fillPanelFromToolIds('decoration'),
  tombs: () => fillPanelFromToolIds('tombs'),
  roads: () => createRoadsButtons(),
  legendToolbar: () => fillLegendPanel(buildToolbarLegendPanelHtml()),
  legendFinance: () => fillLegendPanel(buildFinanceLegendPanelHtml()),
};

export function getButtonsUnactive() {
  hideBuildToolHoverPreview();
  toolBarButtons.forEach((button) => {
    button.classList.remove('selected');
  });
  document.querySelectorAll('.mobile-click-state-btn').forEach((button) => {
    button.classList.remove('active');
    button.setAttribute('aria-pressed', 'false');
  });
}

/**
 * Activate the select-object tool in the left toolbar (visual only).
 * Pair with game.setActiveToolId('select-object').
 */
export function activateSelectToolButton() {
  getButtonsUnactive();
  const selectBtn = document.getElementById('select-btn');
  selectBtn?.classList.add('selected');
  syncMobileClickStateFab('select-object');
}

export function getButtonsDisabled() {
  toolBarButtons.forEach((button) => {
    if (button.classList.contains('disabled')) {
      button.classList.remove('disabled');
    } else {
      button.classList.add('disabled');
    }
  });
}

export function closeModal() {
  toolBarButtons.forEach((button) => {
    if (button.classList.contains('disabled')) {
      button.classList.remove('disabled');
    }
  });
  toolBarButtons.forEach((button) => {
    if (button.classList.contains('selected')) {
      button.classList.remove('selected');
    }
  });
  if (panelLayout.classList.contains('active')) {
    panelLayout.classList.remove('active');
    panelLayout.setAttribute('inert', '');
    panelLayout.setAttribute('aria-hidden', 'true');

    const canvas = document.querySelector('canvas');
    if (canvas) {
      canvas.classList.remove('pointer-events-disabled');
    }

    deps?.playGame?.();
  }
}

export function toggleModal(e) {
  const button = e.target.closest('[data-group]')
    || e.target.closest('.toolbar-btn')
    || e.target;
  const group = button.dataset.group;
  const creator = GROUP_CREATORS[group];

  if (!creator) {
    button.classList.toggle('selected');
    panelLayout.classList.remove('active');
    panelLayout.setAttribute('inert', '');
    panelLayout.setAttribute('aria-hidden', 'true');
    return;
  }

  if (group === 'palaces' && deps?.buttonStateManager && !deps.buttonStateManager.isEnabled('palace-btn')) {
    return;
  }

  getButtonsUnactive();
  getButtonsDisabled();
  panelLayoutInner.classList.add('loading-objects');

  if (!panelLayout.classList.contains('active')) {
    loaderButton.classList.add('active');
    panelLayout.classList.add('active');
    panelLayout.removeAttribute('inert');
    panelLayout.setAttribute('aria-hidden', 'false');
    button.classList.toggle('selected');
    creator();
    deps?.popupManager?.forceOpenPopup('panel-layout');
  } else {
    deps?.popupManager?.forceClosePopup('panel-layout');
  }
}

function fillLegendPanel(html) {
  panelLayoutInner.className = 'panel-inner panel-inner--legend-list';
  panelLayoutInner.innerHTML = html;
  panelLayoutInner.classList.remove('loading-objects');
  loaderButton.classList.remove('active');
}

/**
 * @param {string} category
 * @param {{ exclude?: string[] }} [opts]
 */
function fillPanelFromToolIds(category, opts = {}) {
  panelLayoutInner.className = 'panel-inner';
  panelLayoutInner.innerHTML = '';
  const exclude = new Set(opts.exclude || []);
  const ids = catalogIdsByGroup(category).filter((id) => !exclude.has(id));

  for (const toolId of ids) {
    const catalog = catalogButton(toolId);
    const buttonInfo = { text: catalog.label, tool: toolId, group: category, title: catalog.tooltip };
    makeNewButton(buttonInfo, resolveIcon(toolId));
  }

  panelLayoutInner.classList.remove('loading-objects');
  loaderButton.classList.remove('active');
}

function createRoadsButtons() {
  panelLayoutInner.className = 'panel-inner';
  panelLayoutInner.innerHTML = '';

  const hint = document.createElement('p');
  hint.className = 'panel-tool-hint';
  hint.innerHTML = '<kbd>R</kbd> = rotation du chemin';
  panelLayoutInner.appendChild(hint);

  if (ASSET_CATALOG['StonePath-001']?.button) {
    const catalog = catalogButton('StonePath-001');
    const btn = makeNewButton(
      { text: catalog.label, tool: 'StonePath-001', group: catalog.group, title: catalog.tooltip },
      resolveIcon('StonePath-001')
    );
    if (btn) {
      btn.dataset.stonePathTool = '1';
    }
  }

  panelLayoutInner.classList.remove('loading-objects');
  loaderButton.classList.remove('active');
}

function resolveIcon(toolId) {
  const icon = catalogButton(toolId).icon;
  if (icon.kind === 'svg') return icon.value;
  if (icon.kind === 'png') return kenneyPreviewIconHtml(icon.value);
  if (icon.kind === 'icon') return monochromeIconHtml(icon.value);
  if (icon.kind === 'emoji') return icon.value;
  throw new Error(`[ToolPanel] Unknown icon kind "${icon?.kind}" for "${toolId}"`);
}

const CATEGORY_EXCLUDES = {
  markets: ['Market-Stall'],
  infrastructure: [
    'StonePath-001',
    'StonePath-Right-001',
    'StonePath-Left-001',
    'StonePath-Cross-001',
  ],
};

/**
 * @param {string} categoryKey
 * @returns {string[]}
 */
export function getToolIdsForCategory(categoryKey) {
  const exclude = new Set(CATEGORY_EXCLUDES[categoryKey] || []);
  return catalogIdsByGroup(categoryKey).filter((id) => !exclude.has(id));
}

/**
 * @param {string} categoryKey
 * @returns {{ text: string, tool: string, group: string, title?: string, stonePathTool?: boolean }[]}
 */
export function getToolButtonInfosForCategory(categoryKey) {
  if (categoryKey === 'tools') {
    return [
      { text: 'Démolir', tool: 'bulldoze', group: 'tools' },
      { text: 'Sélectionner', tool: 'select-object', group: 'tools' },
    ];
  }

  if (categoryKey === 'roads') {
    const infos = [];
    if (ASSET_CATALOG['StonePath-001']?.button) {
      const catalog = catalogButton('StonePath-001');
      infos.push({
        text: catalog.label,
        tool: 'StonePath-001',
        group: catalog.group,
        title: catalog.tooltip,
        stonePathTool: true,
      });
    }
    return infos;
  }

  const ids = getToolIdsForCategory(categoryKey);
  const seen = new Set();
  /** @type {{ text: string, tool: string, group: string }[]} */
  const infos = [];

  for (const toolId of ids) {
    if (seen.has(toolId)) continue;
    seen.add(toolId);
    const catalog = catalogButton(toolId);
    infos.push({ text: catalog.label, tool: toolId, group: categoryKey, title: catalog.tooltip });
  }

  return infos;
}

export { resolveIcon };

/**
 * @param {{ text: string, tool: string, group: string, title?: string, stonePathTool?: boolean }} buttonInfo
 * @param {string} icon
 * @param {{ container?: HTMLElement, extraClass?: string, onClick?: (e: Event) => void }} [options]
 */
export function createToolButton(buttonInfo, icon = '', options = {}) {
  const { container, extraClass = 'panel-btn', onClick } = options;
  const button = document.createElement('button');
  button.type = 'button';
  button.id = extraClass === 'mobile-tool-btn' ? `mobile-tool-${buttonInfo.tool}` : buttonInfo.tool;
  button.dataset.toolid = buttonInfo.tool;
  const label = buttonInfo.title || getBuildingDisplayName(buttonInfo.tool);
  button.title = label;
  button.setAttribute('aria-label', label);
  button.classList.add('toolbar-btn');
  if (extraClass) {
    button.classList.add(extraClass);
  }

  if (ASSET_CATALOG[buttonInfo.tool]?.button?.icon?.kind === 'png') {
    button.classList.add('panel-btn--kenney-preview');
  }

  const isEmoji = typeof icon === 'string' && icon.length <= 4 && !icon.includes('<');
  if (isEmoji) {
    button.innerHTML = `<span class="tool-emoji" aria-hidden="true">${icon}</span>`;
  } else {
    button.innerHTML = icon;
  }

  if (buttonInfo.stonePathTool) {
    button.dataset.stonePathTool = '1';
  }

  button.addEventListener('click', (e) => {
    hideBuildToolHoverPreview();
    if (deps?.buttonStateManager && !deps.buttonStateManager.isEnabled(buttonInfo.tool)) {
      return;
    }
    if (onClick) {
      onClick(e);
    } else {
      deps.invokeSetActiveTool?.(e);
    }
  });

  if (extraClass === 'mobile-tool-btn' || extraClass === 'panel-btn') {
    attachBuildToolHoverPreview(button, buttonInfo.tool);
  }

  const target = container || panelLayoutInner;
  target.appendChild(button);

  if (deps?.buttonStateManager) {
    deps.buttonStateManager.registerButton(buttonInfo.tool, button);
  }

  return button;
}

function makeNewButton(buttonInfo, icon = '') {
  const button = createToolButton(buttonInfo, icon, { extraClass: 'panel-btn' });
  panelLayoutInner.classList.remove('loading-objects');
  loaderButton.classList.remove('active');
  return button;
}

/** Kenney pack preview PNG — cut-out render on charcoal tile (see main.css). */
function kenneyPreviewIconHtml(previewUrl) {
  return `<img src="${previewUrl}" alt="" class="tool-kenney-preview" decoding="async" loading="lazy" />`;
}

/** A 24px monochrome silhouette icon, styled like the inline SVGs around it (see main.css). */
function monochromeIconHtml(url) {
  return `<img src="${url}" alt="" class="tool-icon-img" width="24" height="24" decoding="async" />`;
}
