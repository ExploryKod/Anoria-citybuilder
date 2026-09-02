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
  KENNEY_CITY_KIT_TOOL_META,
} from '../../three/adapters/kenney-city-kit/kenneyCityKitConfig.js';
import {
  EDITOR_TOOL_META,
  EDITOR_TOOL_PREVIEW_URLS,
} from '../../../shared/editor-catalog/editorKenneyCatalog.js';
import {
  attachBuildToolHoverPreview,
  hideBuildToolHoverPreview,
} from './BuildToolHoverPreview.js';

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

let buttonData = [];
let toolIds = {};

export function setToolPanelAssets(data, ids) {
  buttonData = data || [];
  toolIds = ids || {};
}

/** Distinctive SVGs kept where they already existed */
const TOOL_SVG = {
  'House-Blue': homeSvg(),
  'House-Red': homeSvg(),
  'House-Purple': homeSvg(),
  'House-2Story': castleSvg(),
  'Farm-Wheat': wheatSvg(),
  'Farm-Carrot': carrotSvg(),
  'Farm-Cabbage': cabbageSvg(),
  'Windmill-001': windmillIconHtml(),
  'Barn-001': barnSvg(),
  'Crate-001': packageSvg(),
  'Well-001': dropletSvg(),
  'Fountain-001': sparklesSvg(),
  'Streetlight-001': lampSvg(),
  'Tree-Pine-001': treeSvg(),
  'Tree-Square-001': treeSvg(),
  'Tree-Tall-001': treeSvg(),
  'Tree-Sapin': treeSvg(),
  'Tree-Arbuste': treeSvg(),
  'Tree-Chene': treeSvg(),
  'Boulder-001': mountainSvg(),
  Chapel: castleSvg(),
  roads: modernRoadSvg(),
  'StonePath-001': stonePathSvg(),
  'Market-Stall': marketStallSvg('#3b82f6'),
  'Market-Stall-Blue': marketStallSvg('#3b82f6'),
  'Market-Stall-Red': marketStallSvg('#dc2626'),
};

/** Emoji fallback when no distinctive SVG */
const TOOL_EMOJI = {
  'Hay-Bale': '🌾',
  'Hay-Cart': '🛒',
  'Hay-Pile': '📦',
  'Winery-001': '🍷',
  Cylinder: '🛑',
  Chapel: '🛕',
  'BookShop-001': '📚',
  'Fence-001': '🧱',
  'Pond-001': '🌊',
  'Plane-001': '🟫',
  'Plane-004': '🟧',
  'Plane-007': '🟥',
  Cube: '⬛',
  'Sphere-001': '⚪',
  'Sphere-002': '⚫',
  Bench: '🪑',
  'Picnic-Table': '🧺',
  'Potted-Bush': '🪴',
  Daisy: '🌼',
  Shroom: '🍄',
  Arch: '🏛️',
  Obelisk: '🗿',
  Pillar: '🪵',
  Garland: '🎀',
  Barrell: '🛢️',
  'Tombstone-1': '🪦',
  'Tombstone-2': '🪦',
  'Tombstone-3': '🪦',
  'Grave-1': '⚰️',
  'Grave-2': '⚰️',
  Tomb: '⚱️',
  Coffin: '⚰️',
};

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
        'roads',
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
  const ids = (toolIds[category] || []).filter((id) => !exclude.has(id));
  const seen = new Set();

  for (const toolId of ids) {
    if (seen.has(toolId)) continue;
    seen.add(toolId);

    const fromData = buttonData.find((b) => b.tool === toolId);
    const meta = KENNEY_CITY_KIT_TOOL_META[toolId] ?? EDITOR_TOOL_META[toolId];
    const buttonInfo = fromData
      ? {
          ...fromData,
          ...(meta?.tooltip && !fromData.title ? { title: meta.tooltip } : {}),
          ...(meta?.shortLabel && fromData.text === toolId ? { text: meta.shortLabel } : {}),
        }
      : {
          text: meta?.shortLabel ?? toolId,
          tool: toolId,
          group: category,
          ...(meta?.tooltip ? { title: meta.tooltip } : {}),
        };
    makeNewButton(buttonInfo, resolveIcon(toolId));
  }

  // Also surface any buttonData extras for this category not listed (safety)
  buttonData
    .filter((b) => ids.includes(b.tool) && !seen.has(b.tool))
    .forEach((b) => {
      seen.add(b.tool);
      makeNewButton(b, resolveIcon(b.tool));
    });

  panelLayoutInner.classList.remove('loading-objects');
  loaderButton.classList.remove('active');
}

function createRoadsButtons() {
  panelLayoutInner.className = 'panel-inner';
  panelLayoutInner.innerHTML = '';
  const infrastructureToolIDs = toolIds.infrastructure || [];

  const hint = document.createElement('p');
  hint.className = 'panel-tool-hint';
  hint.innerHTML = '<kbd>R</kbd> = rotation du chemin';
  panelLayoutInner.appendChild(hint);

  if (infrastructureToolIDs.includes('roads')) {
    makeNewButton({ text: 'Route moderne', tool: 'roads', group: 'Road' }, TOOL_SVG.roads);
  }

  if (infrastructureToolIDs.includes('StonePath-001')) {
    const fromData = buttonData.find((b) => b.tool === 'StonePath-001');
    const btn = makeNewButton(
      fromData || { text: 'Chemin de pierre', tool: 'StonePath-001', group: 'StonePath' },
      TOOL_SVG['StonePath-001']
    );
    if (btn) {
      btn.title = 'Chemin de pierre — touche R pour tourner';
      btn.dataset.stonePathTool = '1';
    }
  }

  panelLayoutInner.classList.remove('loading-objects');
  loaderButton.classList.remove('active');
}

function resolveIcon(toolId) {
  if (TOOL_SVG[toolId]) return TOOL_SVG[toolId];
  const editorPreview = EDITOR_TOOL_PREVIEW_URLS[toolId];
  if (editorPreview) {
    return kenneyPreviewIconHtml(editorPreview);
  }
  const kenneyMeta = KENNEY_CITY_KIT_TOOL_META[toolId];
  if (kenneyMeta?.previewUrl) {
    return kenneyPreviewIconHtml(kenneyMeta.previewUrl);
  }
  if (TOOL_EMOJI[toolId]) return TOOL_EMOJI[toolId];
  return '📦';
}

const CATEGORY_EXCLUDES = {
  markets: ['Market-Stall'],
  infrastructure: [
    'roads',
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
  return (toolIds[categoryKey] || []).filter((id) => !exclude.has(id));
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
    const infrastructureToolIDs = toolIds.infrastructure || [];
    if (infrastructureToolIDs.includes('roads')) {
      infos.push({ text: 'Route moderne', tool: 'roads', group: 'Road' });
    }
    if (infrastructureToolIDs.includes('StonePath-001')) {
      const fromData = buttonData.find((b) => b.tool === 'StonePath-001');
      infos.push(
        fromData || { text: 'Chemin de pierre', tool: 'StonePath-001', group: 'StonePath' },
      );
      const stonePathInfo = infos[infos.length - 1];
      stonePathInfo.title = 'Chemin de pierre — touche R pour tourner';
      stonePathInfo.stonePathTool = true;
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
    const fromData = buttonData.find((b) => b.tool === toolId);
    const meta = KENNEY_CITY_KIT_TOOL_META[toolId] ?? EDITOR_TOOL_META[toolId];
    infos.push(
      fromData || {
        text: meta?.shortLabel ?? toolId,
        tool: toolId,
        group: categoryKey,
        ...(meta?.tooltip ? { title: meta.tooltip } : {}),
      },
    );
  }

  buttonData
    .filter((b) => ids.includes(b.tool) && !seen.has(b.tool))
    .forEach((b) => {
      seen.add(b.tool);
      infos.push(b);
    });

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

  if (KENNEY_CITY_KIT_TOOL_META[buttonInfo.tool]?.previewUrl
    || EDITOR_TOOL_PREVIEW_URLS[buttonInfo.tool]) {
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

function homeSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`;
}
function castleSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 20v-9H2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2Z"/><path d="M18 11V4H6v7"/><path d="M15 22v-4a3 3 0 0 0-3-3v0a3 3 0 0 0-3 3v4"/><path d="M22 11V9"/><path d="M2 11V9"/><path d="M6 4V2"/><path d="M18 4V2"/><path d="M10 4V2"/><path d="M14 4V2"/></svg>`;
}
function wheatSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"><path d="M2 22 16 8"/><path d="M3.47 12.53 5 11l1.53 1.53a3.5 3.5 0 0 1 0 4.94L5 19l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z"/><path d="M7.47 8.53 9 7l1.53 1.53a3.5 3.5 0 0 1 0 4.94L9 15l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z"/><path d="M11.47 4.53 13 3l1.53 1.53a3.5 3.5 0 0 1 0 4.94L13 11l-1.53-1.53a3.5 3.5 0 0 1 0-4.94Z"/><path d="M20 2h2v2a4 4 0 0 1-4 4h-2V6a4 4 0 0 1 4-4Z"/></svg>`;
}
function carrotSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"><path d="M2.27 21.7s9.87-3.5 12.73-6.36a4.5 4.5 0 0 0-6.36-6.37C5.77 11.84 2.27 21.7 2.27 21.7zM8.64 14l-2.05-2.04M15.34 15l-2.46-2.46"/><path d="M22 9s-1.33-2-3.5-2C16.86 7 15 9 15 9s1.33 2 3.5 2S22 9 22 9z"/><path d="M15 2s-2 1.33-2 3.5S15 9 15 9s2-1.84 2-3.5C17 3.33 15 2 15 2z"/></svg>`;
}
function cabbageSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 22c1.25-.987 2.27-1.975 3.9-2.2a5.56 5.56 0 0 1 3.8 1.5 4 4 0 0 0 6.187-2.353 3.5 3.5 0 0 0 3.69-5.116A3.5 3.5 0 0 0 20.95 8 3.5 3.5 0 1 0 16 3.05a3.5 3.5 0 0 0-5.831 1.373 3.5 3.5 0 0 0-5.116 3.69 4 4 0 0 0-2.348 6.155C3.499 15.42 4.409 16.712 4.2 18.1 3.926 19.743 3.014 20.732 2 22"/><path d="M2 22 17 7"/></svg>`;
}
/** Magnific windmill PNG — see credits.html */
function windmillIconHtml() {
  return `<img src="/icons/windmill.png" alt="" class="tool-icon-img" width="24" height="24" decoding="async" />`;
}
function cogSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 5L7 7l2 5M12 5l5 2-2 5M7 17l2-5M17 17l-2-5M7 7L2 7l5 10M17 7l5 0-5 10"/></svg>`;
}
function barnSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 8.35V20a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8.35A2 2 0 0 1 3.26 6.5l8-3.2a2 2 0 0 1 1.48 0l8 3.2A2 2 0 0 1 22 8.35Z"/><path d="M6 18h12"/><path d="M6 14h12"/><rect width="12" height="12" x="6" y="10"/></svg>`;
}
function packageSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7.5 4.27 9 5.15"/><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>`;
}
function dropletSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4.5-4-6.5c-.5 2-1.5 3.9-3 5.5S5 13 5 15a7 7 0 0 0 7 7z"/></svg>`;
}
function sparklesSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/></svg>`;
}
function lampSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 2h8l4 10H4L8 2Z"/><path d="M12 12v6"/><path d="M8 22v-2c0-1.1.9-2 2-2h4a2 2 0 0 1 2 2v2H8Z"/></svg>`;
}
function treeSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 10v.2A3 3 0 0 1 8.9 16H5a3 3 0 0 1-2.1-5.2l.3-.3h.2a2.5 2.5 0 0 1 2-4l.4-.4a2 2 0 0 1 2.9-.2 1 1 0 0 0 1.4 0"/><path d="M14 10v.2A3 3 0 0 0 15.1 16H19a3 3 0 0 0 2.1-5.2l-.3-.3h-.2a2.5 2.5 0 0 0-2-4l-.4-.4a2 2 0 0 0-2.9-.2 1 1 0 0 1-1.4 0"/><path d="M12 22v-8"/><path d="M12 2v4"/></svg>`;
}
function mountainSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m8 3 4 8 5-5 5 15H2L8 3z"/></svg>`;
}
function modernRoadSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="8" width="18" height="8" rx="1"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="9" y1="10" x2="9" y2="14"/><line x1="15" y1="10" x2="15" y2="14"/></svg>`;
}
function stonePathSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="2" x2="12" y2="22"/><line x1="8" y1="8" x2="8" y2="10"/><line x1="16" y1="8" x2="16" y2="10"/><line x1="8" y1="14" x2="8" y2="16"/><line x1="16" y1="14" x2="16" y2="16"/></svg>`;
}
function marketStallSvg(stroke = 'currentColor') {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/><path d="M22 7v3a2 2 0 0 1-2 2v0a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 16 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 12 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 8 12a2.7 2.7 0 0 1-1.59-.63.7.7 0 0 0-.82 0A2.7 2.7 0 0 1 4 12v0a2 2 0 0 1-2-2V7"/></svg>`;
}

/** Kenney pack preview PNG — cut-out render on charcoal tile (see main.css). */
function kenneyPreviewIconHtml(previewUrl) {
  return `<img src="${previewUrl}" alt="" class="tool-kenney-preview" decoding="async" loading="lazy" />`;
}
