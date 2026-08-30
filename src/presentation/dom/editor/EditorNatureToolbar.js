import Splide from '@splidejs/splide';
import {
  createToolButton,
  getToolButtonInfosForCategory,
  getButtonsUnactive,
  resolveIcon,
} from '../tools/ToolPanel.js';
import { serializeEditorLayout } from '../../three/editor/editorNatureLayout.js';
import { getSessionCity } from '../../../composition/sessionRuntime.js';

/** @type {{ invokeSetActiveTool?: (e: Event) => void } | null} */
let deps = null;

/** @type {Splide | null} */
let splideInstance = null;

let buildBarEl = null;
let listEl = null;
let closeBtn = null;
let activeCategoryId = 'editorTerrain';
let isOpen = false;

const EDITOR_CATEGORIES = [
  { id: 'editorTerrain', label: 'Terrain', fabId: 'editor-terrain-fab' },
  { id: 'editorNature', label: 'Nature', fabId: 'editor-nature-fab' },
];

/**
 * @param {{ invokeSetActiveTool?: (e: Event) => void }} toolbarDeps
 */
export function initEditorNatureToolbar(toolbarDeps) {
  deps = toolbarDeps;

  buildBarEl = document.getElementById('editor-build-bar');
  listEl = buildBarEl?.querySelector('.splide__list');
  closeBtn = document.getElementById('editor-build-bar-close');

  if (!buildBarEl || !listEl) {
    return;
  }

  initSplide();
  selectCategory(activeCategoryId);

  closeBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    close();
  });

  for (const category of EDITOR_CATEGORIES) {
    const fab = document.getElementById(category.fabId);
    fab?.addEventListener('click', (e) => {
      e.stopPropagation();
      if (isOpen && activeCategoryId === category.id) {
        close();
        return;
      }
      open(category.id);
    });
  }

  document.getElementById('editor-export-fab')?.addEventListener('click', (e) => {
    e.stopPropagation();
    exportEditorLayout();
  });
}

function initSplide() {
  const carouselEl = buildBarEl?.querySelector('.splide');
  if (!carouselEl || splideInstance) return;
  splideInstance = new Splide(carouselEl, {
    type: 'slide',
    autoWidth: true,
    pagination: false,
    arrows: true,
    drag: true,
    gap: '8px',
    focus: 0,
    wheel: false,
    speed: 320,
    keyboard: false,
  });
  splideInstance.mount();
}

function open(categoryId) {
  if (!buildBarEl) return;
  activeCategoryId = categoryId;
  selectCategory(categoryId);
  isOpen = true;
  buildBarEl.hidden = false;
  buildBarEl.classList.add('mobile-build-bar--open');
  buildBarEl.setAttribute('aria-hidden', 'false');
  document.documentElement.classList.add('editor-build-bar-open');
  syncFabState();
  requestAnimationFrame(() => splideInstance?.refresh());
}

export function close() {
  if (!buildBarEl) return;
  isOpen = false;
  buildBarEl.hidden = true;
  buildBarEl.classList.remove('mobile-build-bar--open');
  buildBarEl.setAttribute('aria-hidden', 'true');
  document.documentElement.classList.remove('editor-build-bar-open');
  syncFabState();
}

function syncFabState() {
  for (const category of EDITOR_CATEGORIES) {
    const fab = document.getElementById(category.fabId);
    if (!fab) continue;
    const active = isOpen && activeCategoryId === category.id;
    fab.classList.toggle('active', active);
    fab.setAttribute('aria-expanded', active ? 'true' : 'false');
  }
}

function selectCategory(categoryId) {
  activeCategoryId = categoryId;
  renderCarousel(categoryId);
}

function renderCarousel(categoryId) {
  if (!listEl) return;
  listEl.innerHTML = '';

  const toolInfos = getToolButtonInfosForCategory(categoryId);
  toolInfos.forEach((buttonInfo) => {
    const slide = document.createElement('li');
    slide.className = 'splide__slide mobile-build-bar__slide';
    const icon = resolveIcon(buttonInfo.tool);

    createToolButton(buttonInfo, icon, {
      container: slide,
      extraClass: 'mobile-tool-btn',
      onClick: (e) => {
        getButtonsUnactive();
        e.currentTarget?.classList?.add('selected');
        deps?.invokeSetActiveTool?.(e);
      },
    });

    listEl.appendChild(slide);
  });

  splideInstance?.refresh();
  splideInstance?.go(0);
}

function exportEditorLayout() {
  const city = getSessionCity();
  if (!city) {
    console.warn('[EditorNatureToolbar] No city to export');
    return;
  }

  const payload = serializeEditorLayout(city);
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `anoria-editor-layout-${Date.now()}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}
