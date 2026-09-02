import Splide from '@splidejs/splide';
import {
  createToolButton,
  getToolButtonInfosForCategory,
  getButtonsUnactive,
  resolveIcon,
} from '../tools/ToolPanel.js';
import { hideBuildToolHoverPreview } from '../tools/BuildToolHoverPreview.js';
import { serializeEditorLayout } from '../../three/editor/editorNatureLayout.js';
import { getSessionCity } from '../../../composition/sessionRuntime.js';
import { v4 as uuidv4 } from 'uuid';
import {
  getDefaultCategoryForFabGroup,
  getKenneyEditorCategoriesForFabGroup,
} from '../../../shared/editor-catalog/classifyKenneyNatureAsset.js';

/** @type {{ invokeSetActiveTool?: (e: Event) => void } | null} */
let deps = null;

/** @type {Splide | null} */
let splideInstance = null;

let buildBarEl = null;
let listEl = null;
let pillsEl = null;
let pillsPrevBtn = null;
let pillsNextBtn = null;
let closeBtn = null;
/** @type {'terrain' | 'nature'} */
let activeFabGroup = 'terrain';
let activeCategoryId = 'editorGround';
let isOpen = false;

/**
 * @param {{ invokeSetActiveTool?: (e: Event) => void }} toolbarDeps
 */
export function initEditorNatureToolbar(toolbarDeps) {
  deps = toolbarDeps;

  buildBarEl = document.getElementById('editor-build-bar');
  listEl = buildBarEl?.querySelector('.splide__list');
  pillsEl = buildBarEl?.querySelector('.editor-build-bar__pills');
  pillsPrevBtn = document.getElementById('editor-build-bar-pills-prev');
  pillsNextBtn = document.getElementById('editor-build-bar-pills-next');
  closeBtn = document.getElementById('editor-build-bar-close');

  if (!buildBarEl || !listEl || !pillsEl) {
    return;
  }

  initSplide();
  initPillsArrows();

  closeBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    close();
  });

  document.getElementById('editor-terrain-fab')?.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleFabGroup('terrain');
  });

  document.getElementById('editor-nature-fab')?.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleFabGroup('nature');
  });

  document.getElementById('editor-export-fab')?.addEventListener('click', (e) => {
    e.stopPropagation();
    exportEditorLayout();
  });
}

/**
 * @param {'terrain' | 'nature'} fabGroup
 */
function toggleFabGroup(fabGroup) {
  if (isOpen && activeFabGroup === fabGroup) {
    close();
    return;
  }
  openFabGroup(fabGroup);
}

/**
 * @param {'terrain' | 'nature'} fabGroup
 */
function openFabGroup(fabGroup) {
  if (!buildBarEl) return;

  activeFabGroup = fabGroup;
  activeCategoryId = getDefaultCategoryForFabGroup(fabGroup);
  buildCategoryPills(fabGroup);
  selectCategory(activeCategoryId);

  isOpen = true;
  buildBarEl.hidden = false;
  buildBarEl.classList.add('mobile-build-bar--open');
  buildBarEl.setAttribute('aria-hidden', 'false');
  document.documentElement.classList.add('editor-build-bar-open');
  syncFabState();
  pillsEl?.scrollTo({ left: 0, behavior: 'auto' });

  requestAnimationFrame(() => {
    syncPillsArrowState();
    splideInstance?.refresh();
  });
}

/**
 * @param {'terrain' | 'nature'} fabGroup
 */
function buildCategoryPills(fabGroup) {
  if (!pillsEl) return;
  pillsEl.innerHTML = '';

  const categories = getKenneyEditorCategoriesForFabGroup(fabGroup);
  for (const category of categories) {
    const pill = document.createElement('button');
    pill.type = 'button';
    pill.className = 'mobile-build-bar__pill editor-build-bar__pill';
    pill.dataset.category = category.id;
    pill.setAttribute('role', 'tab');
    pill.setAttribute('aria-selected', category.id === activeCategoryId ? 'true' : 'false');
    pill.setAttribute('aria-label', category.tooltip);
    pill.title = category.tooltip;
    pill.setAttribute('tabindex', category.id === activeCategoryId ? '0' : '-1');
    pill.setAttribute('aria-controls', 'editor-build-bar-tools');
    if (category.id === activeCategoryId) {
      pill.classList.add('mobile-build-bar__pill--active');
    }

    const iconWrap = document.createElement('span');
    iconWrap.className = 'mobile-build-bar__pill-icon';
    iconWrap.setAttribute('aria-hidden', 'true');
    const emoji = document.createElement('span');
    emoji.className = 'tool-emoji';
    emoji.textContent = category.icon;
    iconWrap.appendChild(emoji);
    pill.appendChild(iconWrap);

    pill.addEventListener('click', (e) => {
      e.stopPropagation();
      selectCategory(category.id);
      pill.focus();
    });

    pill.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selectCategory(category.id);
      }
    });

    pillsEl.appendChild(pill);
  }
}

function syncPillState() {
  if (!pillsEl) return;
  for (const pill of pillsEl.querySelectorAll('.editor-build-bar__pill')) {
    const selected = pill.dataset.category === activeCategoryId;
    pill.classList.toggle('mobile-build-bar__pill--active', selected);
    pill.setAttribute('aria-selected', selected ? 'true' : 'false');
    pill.setAttribute('tabindex', selected ? '0' : '-1');
  }
}

function initPillsArrows() {
  pillsPrevBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    scrollPills(-PILLS_SCROLL_STEP_PX);
  });
  pillsNextBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    scrollPills(PILLS_SCROLL_STEP_PX);
  });
  pillsEl?.addEventListener('scroll', () => {
    syncPillsArrowState();
  });
}

const PILLS_SCROLL_STEP_PX = 160;

/**
 * @param {number} delta
 */
function scrollPills(delta) {
  if (!pillsEl) return;
  pillsEl.scrollBy({ left: delta, behavior: 'smooth' });
}

function syncPillsArrowState() {
  if (!pillsEl) return;

  const maxScroll = Math.max(0, pillsEl.scrollWidth - pillsEl.clientWidth);
  const canScroll = maxScroll > 2;
  const atStart = pillsEl.scrollLeft <= 2;
  const atEnd = pillsEl.scrollLeft >= maxScroll - 2;

  if (pillsPrevBtn) {
    pillsPrevBtn.disabled = !canScroll || atStart;
    pillsPrevBtn.setAttribute('aria-disabled', pillsPrevBtn.disabled ? 'true' : 'false');
  }
  if (pillsNextBtn) {
    pillsNextBtn.disabled = !canScroll || atEnd;
    pillsNextBtn.setAttribute('aria-disabled', pillsNextBtn.disabled ? 'true' : 'false');
  }
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

export function close() {
  if (!buildBarEl) return;
  hideBuildToolHoverPreview();
  isOpen = false;
  buildBarEl.hidden = true;
  buildBarEl.classList.remove('mobile-build-bar--open');
  buildBarEl.setAttribute('aria-hidden', 'true');
  document.documentElement.classList.remove('editor-build-bar-open');
  syncFabState();
}

function syncFabState() {
  const terrainFab = document.getElementById('editor-terrain-fab');
  const natureFab = document.getElementById('editor-nature-fab');
  const terrainActive = isOpen && activeFabGroup === 'terrain';
  const natureActive = isOpen && activeFabGroup === 'nature';

  if (terrainFab) {
    terrainFab.classList.toggle('active', terrainActive);
    terrainFab.setAttribute('aria-expanded', terrainActive ? 'true' : 'false');
  }
  if (natureFab) {
    natureFab.classList.toggle('active', natureActive);
    natureFab.setAttribute('aria-expanded', natureActive ? 'true' : 'false');
  }
}

function selectCategory(categoryId) {
  activeCategoryId = categoryId;
  syncPillState();
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

  const defaultName = 'Ma carte';
  const nameInput = window.prompt('Nom de la carte (affiché dans les missions)', defaultName);
  if (nameInput === null) {
    return;
  }
  const name = nameInput.trim() || defaultName;
  const mapId = uuidv4();

  const payload = serializeEditorLayout(city, { id: mapId, name });
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `${mapId}.json`;
  anchor.click();
  URL.revokeObjectURL(url);
}
