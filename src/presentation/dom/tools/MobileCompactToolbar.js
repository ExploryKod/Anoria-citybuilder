import Splide from '@splidejs/splide';
import '@splidejs/splide/css/core';
import {
  createToolButton,
  getToolButtonInfosForCategory,
  getButtonsUnactive,
  resolveIcon,
} from './ToolPanel.js';
import { MOBILE_TOOLBAR_CATEGORIES } from './mobileToolbarCategories.js';
import { createModalFocusSession } from '../shell/modalFocus.js';

/** Gap between build bar bottom edge and top of the round FAB container. */
const BUILD_BAR_GAP_PX = 8;
/** Horizontal scroll step for category pills (approx. 2–3 pills). */
const PILLS_SCROLL_STEP_PX = 160;

/** @type {{
 *   invokeSetActiveTool?: (e: Event) => void,
 *   buttonStateManager?: { isEnabled?: (id: string) => boolean },
 * } | null} */
let deps = null;

/** @type {Splide | null} */
let splideInstance = null;

/** @type {ResizeObserver | null} */
let fabResizeObserver = null;

/** @type {ResizeObserver | null} */
let pillsResizeObserver = null;

let buildBarEl = null;
let fabsEl = null;
let pillsEl = null;
let pillsPrevBtn = null;
let pillsNextBtn = null;
let carouselEl = null;
let listEl = null;
let closeBtn = null;
let activeCategoryId = 'houses';
let isOpen = false;
let keyboardHandlerBound = false;

/** @type {ReturnType<typeof createModalFocusSession> | null} */
let buildBarFocusSession = null;

/**
 * @param {boolean} open
 */
function setBuildBarDocumentState(open) {
  document.documentElement.classList.toggle('mobile-build-bar-open', open);
  window.dispatchEvent(new CustomEvent('anoria:mobile-build-bar-change', { detail: { open } }));
}

/**
 * @param {{
 *   invokeSetActiveTool?: (e: Event) => void,
 *   buttonStateManager?: object,
 * }} toolbarDeps
 */
export function initMobileCompactToolbar(toolbarDeps) {
  deps = toolbarDeps;

  buildBarEl = document.getElementById('mobile-build-bar');
  fabsEl = document.querySelector('.legend-btns-container--mobile');
  pillsEl = buildBarEl?.querySelector('.mobile-build-bar__pills');
  pillsPrevBtn = document.getElementById('mobile-build-bar-pills-prev');
  pillsNextBtn = document.getElementById('mobile-build-bar-pills-next');
  carouselEl = buildBarEl?.querySelector('.mobile-build-bar__carousel');
  listEl = buildBarEl?.querySelector('.splide__list');
  closeBtn = document.getElementById('mobile-build-bar-close');

  if (!buildBarEl || !pillsEl || !carouselEl || !listEl) {
    return { open, close, toggle, isOpen: () => isOpen };
  }

  buildPills();
  selectCategory(activeCategoryId);
  initSplide();
  initPillsArrows();
  initBuildBarKeyboard();
  syncBuildBarAnchor();

  closeBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    close();
  });

  window.addEventListener('resize', () => {
    syncBuildBarAnchor();
    syncPillsArrowState();
  });
  window.addEventListener('orientationchange', () => {
    requestAnimationFrame(() => {
      syncBuildBarAnchor();
      syncPillsArrowState();
    });
  });

  if (typeof ResizeObserver !== 'undefined' && fabsEl) {
    fabResizeObserver = new ResizeObserver(() => {
      syncBuildBarAnchor();
    });
    fabResizeObserver.observe(fabsEl);
  }
}

/** @deprecated Kept for callers; build bar is available at all breakpoints. */
export function isPortraitMode() {
  return true;
}

export function isOpenState() {
  return isOpen;
}

/**
 * Place the build bar centered above `.legend-btns-container--mobile`.
 * FABs stay visible and do not move.
 */
function syncBuildBarAnchor() {
  if (!buildBarEl) return;

  const fabs = fabsEl || document.querySelector('.legend-btns-container--mobile');
  fabsEl = fabs;

  if (fabs) {
    const rect = fabs.getBoundingClientRect();
    const bottomPx = Math.max(0, window.innerHeight - rect.top + BUILD_BAR_GAP_PX);
    const centerX = rect.left + rect.width / 2;
    const maxWidth = Math.min(720, window.innerWidth - 24);
    const width = Math.max(rect.width, Math.min(maxWidth, Math.max(280, rect.width * 2.2)));

    document.documentElement.style.setProperty('--mobile-build-bar-bottom', `${bottomPx}px`);
    document.documentElement.style.setProperty('--mobile-build-bar-center-x', `${centerX}px`);
    document.documentElement.style.setProperty('--mobile-build-bar-width', `${Math.min(maxWidth, width)}px`);
  }

  if (isOpen) {
    document.documentElement.style.setProperty('--mobile-build-bar-offset', `${buildBarEl.offsetHeight}px`);
  }
}

export function open() {
  if (!buildBarEl) return;
  isOpen = true;
  buildBarEl.hidden = false;
  buildBarEl.classList.add('mobile-build-bar--open');
  buildBarEl.setAttribute('aria-hidden', 'false');
  setBuildBarDocumentState(true);
  syncConstructionOpenButton();
  // Always land on Habitations when opening the bar.
  selectCategory('houses');
  pillsEl?.scrollTo({ left: 0, behavior: 'auto' });
  buildBarFocusSession?.release({ restoreFocus: false });
  buildBarFocusSession = createModalFocusSession({
    panel: buildBarEl,
    onEscape: () => {
      close();
      document.getElementById('toolbar-mobile-toggle')?.focus();
    },
    initialFocus: () => {
      const activePill = pillsEl?.querySelector('.mobile-build-bar__pill[aria-selected="true"]');
      if (activePill instanceof HTMLElement) return activePill;
      return closeBtn;
    },
    ensureDialogAttributes: false,
  });
  requestAnimationFrame(() => {
    syncBuildBarAnchor();
    syncPillsArrowState();
    splideInstance?.refresh();
  });
}

export function close() {
  if (!buildBarEl) return;
  isOpen = false;
  buildBarFocusSession?.release({ restoreFocus: false });
  buildBarFocusSession = null;
  buildBarEl.hidden = true;
  buildBarEl.classList.remove('mobile-build-bar--open');
  buildBarEl.setAttribute('aria-hidden', 'true');
  document.documentElement.style.setProperty('--mobile-build-bar-offset', '0px');
  setBuildBarDocumentState(false);
  syncConstructionOpenButton();
}

function syncConstructionOpenButton() {
  const toggle = document.getElementById('toolbar-mobile-toggle');
  if (!toggle) return;
  toggle.classList.toggle('active', isOpen);
  toggle.setAttribute('aria-pressed', isOpen ? 'true' : 'false');
  toggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
}

export function toggle() {
  if (isOpen) {
    close();
  } else {
    open();
  }
  return isOpen;
}

function initSplide() {
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

/**
 * @returns {number}
 */
function getCarouselFocusIndex() {
  const tools = getCarouselToolButtons();
  if (!tools.length) return -1;

  const activeIndex = tools.indexOf(document.activeElement);
  if (activeIndex >= 0) return activeIndex;

  if (splideInstance) {
    return splideInstance.index;
  }
  return 0;
}

/**
 * Move keyboard focus across tool buttons and scroll the carousel to match.
 * @param {number} direction -1 = previous tool, 1 = next tool
 */
function navigateCarouselTools(direction) {
  const tools = getCarouselToolButtons();
  if (!tools.length) return;

  const currentIndex = getCarouselFocusIndex();
  const startIndex = currentIndex >= 0 ? currentIndex : (direction > 0 ? -1 : tools.length);
  const nextIndex = Math.max(0, Math.min(tools.length - 1, startIndex + direction));

  splideInstance?.go(nextIndex);
  syncCarouselToolRovingTabIndex(nextIndex);
  tools[nextIndex]?.focus();
}

/**
 * Roving tabindex for carousel tools (APG toolbar pattern).
 * @param {number} [activeIndex]
 * @returns {HTMLButtonElement | undefined}
 */
function syncCarouselToolRovingTabIndex(activeIndex = -1) {
  const tools = getCarouselToolButtons();
  if (!tools.length) return undefined;

  let index = activeIndex;
  if (index < 0 || index >= tools.length) {
    const selectedIndex = tools.findIndex((tool) => tool.classList.contains('selected'));
    index = selectedIndex >= 0 ? selectedIndex : 0;
  }

  tools.forEach((tool, i) => {
    tool.tabIndex = i === index ? 0 : -1;
  });
  return tools[index];
}

function initBuildBarKeyboard() {
  if (keyboardHandlerBound || !buildBarEl) return;
  keyboardHandlerBound = true;
  buildBarEl.addEventListener('keydown', handleBuildBarKeyDown);
  document.addEventListener('keydown', handleBuildBarDocumentKeyDown, true);
}

/**
 * Capture arrow keys only when focus left the UI for the canvas / document
 * (e.g. after map click) — do not steal arrows from other HUD controls.
 * @param {KeyboardEvent} event
 */
function handleBuildBarDocumentKeyDown(event) {
  if (!isOpen || !buildBarEl) return;
  if (buildBarEl.contains(event.target)) return;
  if (!isFocusOnGameSurface(document.activeElement)) return;

  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    event.preventDefault();
    event.stopPropagation();
    navigateCarouselTools(event.key === 'ArrowLeft' ? -1 : 1);
  }
}

/**
 * @param {EventTarget | null} el
 * @returns {boolean}
 */
function isFocusOnGameSurface(el) {
  if (!(el instanceof Element)) {
    return true;
  }
  if (el === document.body || el === document.documentElement) {
    return true;
  }
  if (el.tagName === 'CANVAS') {
    return true;
  }
  return Boolean(el.closest?.('canvas'));
}

function focusInitialBuildBarControl() {
  const activePill = pillsEl?.querySelector('.mobile-build-bar__pill--active');
  if (activePill instanceof HTMLElement) {
    activePill.focus();
    return;
  }
  closeBtn?.focus();
}

/**
 * @returns {HTMLButtonElement[]}
 */
function getCarouselToolButtons() {
  if (!listEl) return [];
  return [...listEl.querySelectorAll('.mobile-tool-btn')].filter(
    (el) => el instanceof HTMLButtonElement && !el.disabled,
  );
}

function focusActivePill() {
  const activePill = pillsEl?.querySelector('.mobile-build-bar__pill--active');
  if (activePill instanceof HTMLElement) {
    activePill.focus();
    return;
  }
  getVisibleCategoryPills()[0]?.focus();
}

/**
 * @param {boolean} [preferSelected]
 */
function focusCarouselTool(preferSelected = true) {
  const tools = getCarouselToolButtons();
  if (!tools.length) {
    return;
  }

  let index = 0;
  if (preferSelected) {
    const selectedIndex = tools.findIndex((tool) => tool.classList.contains('selected'));
    if (selectedIndex >= 0) {
      index = selectedIndex;
    }
  }

  splideInstance?.go(index);
  syncCarouselToolRovingTabIndex(index);
  tools[index]?.focus();
}

/**
 * @param {EventTarget | null} target
 */
function isInPillsRegion(target) {
  return target instanceof Element && Boolean(target.closest('.mobile-build-bar__pills-row'));
}

/**
 * @param {EventTarget | null} target
 */
function isInCarouselRegion(target) {
  return target instanceof Element && Boolean(target.closest('.mobile-build-bar__carousel'));
}

/**
 * @param {EventTarget | null} target
 */
function isInBuildBarHeader(target) {
  return target instanceof Element && Boolean(target.closest('.mobile-build-bar__header'));
}

/**
 * @returns {HTMLElement[]}
 */
function getVisibleCategoryPills() {
  if (!pillsEl) return [];
  return [...pillsEl.querySelectorAll('.mobile-build-bar__pill')].filter(
    (el) => el instanceof HTMLElement,
  );
}

/**
 * @param {number} direction -1 = previous, 1 = next
 */
function navigateCategories(direction) {
  const pills = getVisibleCategoryPills();
  if (!pills.length) return;

  const currentIndex = pills.findIndex((pill) => pill.dataset.category === activeCategoryId);
  const startIndex = currentIndex >= 0 ? currentIndex : 0;
  const nextIndex = (startIndex + direction + pills.length) % pills.length;
  const nextCategoryId = pills[nextIndex]?.dataset.category;
  if (!nextCategoryId) return;

  selectCategory(nextCategoryId);
  requestAnimationFrame(() => {
    focusCarouselTool(true);
  });
}

/**
 * @param {KeyboardEvent} event
 */
function handleBuildBarKeyDown(event) {
  if (!isOpen) return;

  const target = event.target;
  const onPill = target instanceof Element && target.closest('.mobile-build-bar__pill');

  if (event.key === 'Escape') {
    event.preventDefault();
    close();
    document.getElementById('toolbar-mobile-toggle')?.focus();
    return;
  }

  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    if (onPill) {
      event.preventDefault();
      navigateCategories(event.key === 'ArrowLeft' ? -1 : 1);
      return;
    }

    if (isInCarouselRegion(target)) {
      event.preventDefault();
      navigateCarouselTools(event.key === 'ArrowLeft' ? -1 : 1);
    }
  }

  if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
    if (event.key === 'ArrowDown') {
      if (isInBuildBarHeader(target)) {
        event.preventDefault();
        focusActivePill();
        return;
      }
      if (isInPillsRegion(target)) {
        event.preventDefault();
        focusCarouselTool(true);
        return;
      }
    }

    if (event.key === 'ArrowUp') {
      if (isInCarouselRegion(target)) {
        event.preventDefault();
        focusActivePill();
        return;
      }
      if (isInPillsRegion(target)) {
        event.preventDefault();
        closeBtn?.focus();
        return;
      }
    }
  }

  if (event.key === 'Home' && onPill) {
    event.preventDefault();
    const pills = getVisibleCategoryPills();
    const firstCategory = pills[0]?.dataset.category;
    if (firstCategory) {
      selectCategory(firstCategory);
      pills[0]?.focus();
    }
    return;
  }

  if (event.key === 'End' && onPill) {
    event.preventDefault();
    const pills = getVisibleCategoryPills();
    const lastPill = pills[pills.length - 1];
    const lastCategory = lastPill?.dataset.category;
    if (lastCategory) {
      selectCategory(lastCategory);
      lastPill?.focus();
    }
  }
}

function initPillsArrows() {
  if (!pillsEl) return;

  pillsPrevBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    pillsEl.scrollBy({ left: -PILLS_SCROLL_STEP_PX, behavior: 'smooth' });
  });

  pillsNextBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    pillsEl.scrollBy({ left: PILLS_SCROLL_STEP_PX, behavior: 'smooth' });
  });

  pillsEl.addEventListener('scroll', syncPillsArrowState, { passive: true });

  if (typeof ResizeObserver !== 'undefined') {
    pillsResizeObserver = new ResizeObserver(() => {
      syncPillsArrowState();
    });
    pillsResizeObserver.observe(pillsEl);
  }

  syncPillsArrowState();
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

/**
 * @param {string} sourceBtnId
 * @returns {string}
 */
function getCategoryIconHtml(sourceBtnId) {
  const sourceBtn = document.getElementById(sourceBtnId);
  return sourceBtn?.innerHTML?.trim() || '';
}

function buildPills() {
  if (!pillsEl) return;
  pillsEl.innerHTML = '';

  MOBILE_TOOLBAR_CATEGORIES.forEach((category) => {
    if (category.gateKey && deps?.buttonStateManager?.isEnabled
      && !deps.buttonStateManager.isEnabled(category.gateKey)) {
      return;
    }

    const pill = document.createElement('button');
    pill.type = 'button';
    pill.className = 'mobile-build-bar__pill';
    pill.dataset.category = category.id;
    pill.setAttribute('role', 'tab');
    pill.setAttribute('aria-selected', category.id === activeCategoryId ? 'true' : 'false');
    pill.setAttribute('aria-label', category.label);
    pill.setAttribute('tabindex', category.id === activeCategoryId ? '0' : '-1');
    pill.setAttribute('aria-controls', 'mobile-build-bar-tools');
    pill.title = category.label;
    if (category.id === activeCategoryId) {
      pill.classList.add('mobile-build-bar__pill--active');
    }

    const iconHtml = getCategoryIconHtml(category.sourceBtnId);
    if (iconHtml) {
      const iconWrap = document.createElement('span');
      iconWrap.className = 'mobile-build-bar__pill-icon';
      iconWrap.setAttribute('aria-hidden', 'true');
      iconWrap.innerHTML = iconHtml;
      pill.appendChild(iconWrap);
    }

    const label = document.createElement('span');
    label.className = 'mobile-build-bar__pill-label';
    label.textContent = category.label;
    pill.appendChild(label);

    pill.addEventListener('click', (e) => {
      e.stopPropagation();
      selectCategory(category.id);
      pill.focus();
    });

    pill.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        selectCategory(category.id);
        requestAnimationFrame(() => focusCarouselTool(true));
      }
    });

    pillsEl.appendChild(pill);
  });

  requestAnimationFrame(syncPillsArrowState);
}

function selectCategory(categoryId) {
  activeCategoryId = categoryId;

  pillsEl?.querySelectorAll('.mobile-build-bar__pill').forEach((pill) => {
    const isActive = pill.dataset.category === categoryId;
    pill.classList.toggle('mobile-build-bar__pill--active', isActive);
    pill.setAttribute('aria-selected', isActive ? 'true' : 'false');
    pill.setAttribute('tabindex', isActive ? '0' : '-1');
  });

  renderCarousel(categoryId);

  if (isOpen) {
    requestAnimationFrame(() => {
      syncBuildBarAnchor();
    });
  }
}

function renderCarousel(categoryId) {
  if (!listEl) return;

  listEl.innerHTML = '';
  let toolInfos = getToolButtonInfosForCategory(categoryId);

  // Palace tools live under Habitations in the compact build bar.
  if (categoryId === 'houses') {
    const palaceUnlocked = !deps?.buttonStateManager?.isEnabled
      || deps.buttonStateManager.isEnabled('palace-btn');
    if (palaceUnlocked) {
      const palaceInfos = getToolButtonInfosForCategory('palaces');
      const seen = new Set(toolInfos.map((info) => info.tool));
      palaceInfos.forEach((info) => {
        if (!seen.has(info.tool)) {
          seen.add(info.tool);
          toolInfos.push(info);
        }
      });
    }
  }

  toolInfos.forEach((buttonInfo) => {
    const slide = document.createElement('li');
    slide.className = 'splide__slide mobile-build-bar__slide';

    let icon = resolveIcon(buttonInfo.tool);
    if (categoryId === 'tools') {
      icon = getDirectToolIcon(buttonInfo.tool) || icon;
    }

    createToolButton(buttonInfo, icon, {
      container: slide,
      extraClass: 'mobile-tool-btn',
      onClick: (e) => {
        getButtonsUnactive();
        e.currentTarget?.classList?.add('selected');
        deps?.invokeSetActiveTool?.(e);
        const tools = getCarouselToolButtons();
        const index = tools.indexOf(/** @type {HTMLButtonElement} */ (e.currentTarget));
        if (index >= 0) {
          syncCarouselToolRovingTabIndex(index);
        }
      },
    });

    listEl.appendChild(slide);
  });

  syncCarouselToolRovingTabIndex(0);

  if (splideInstance) {
    splideInstance.refresh();
    splideInstance.go(0);
  }
}

function getDirectToolIcon(toolId) {
  const sourceBtn = document.getElementById(
    toolId === 'bulldoze' ? 'bulldoze-btn' : toolId === 'select-object' ? 'select-btn' : '',
  );
  return sourceBtn?.innerHTML || '';
}
