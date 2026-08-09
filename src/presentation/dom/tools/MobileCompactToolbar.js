import Splide from '@splidejs/splide';
import '@splidejs/splide/css/core';
import {
  createToolButton,
  getToolButtonInfosForCategory,
  getButtonsUnactive,
  resolveIcon,
} from './ToolPanel.js';
import { MOBILE_TOOLBAR_CATEGORIES } from './mobileToolbarCategories.js';

/** @type {{
 *   invokeSetActiveTool?: (e: Event) => void,
 *   buttonStateManager?: { isEnabled?: (id: string) => boolean },
 * } | null} */
let deps = null;

/** @type {Splide | null} */
let splideInstance = null;

let buildBarEl = null;
let pillsEl = null;
let carouselEl = null;
let listEl = null;
let closeBtn = null;
let activeCategoryId = 'houses';
let isOpen = false;

const portraitQuery = window.matchMedia('(max-width: 1024px) and (orientation: portrait)');

/**
 * @param {{
 *   invokeSetActiveTool?: (e: Event) => void,
 *   buttonStateManager?: object,
 * }} toolbarDeps
 */
export function initMobileCompactToolbar(toolbarDeps) {
  deps = toolbarDeps;

  buildBarEl = document.getElementById('mobile-build-bar');
  pillsEl = buildBarEl?.querySelector('.mobile-build-bar__pills');
  carouselEl = buildBarEl?.querySelector('.mobile-build-bar__carousel');
  listEl = buildBarEl?.querySelector('.splide__list');
  closeBtn = document.getElementById('mobile-build-bar-close');

  if (!buildBarEl || !pillsEl || !carouselEl || !listEl) {
    return { open, close, toggle, isOpen: () => isOpen, isPortraitMode };
  }

  buildPills();
  selectCategory(activeCategoryId);
  initSplide();

  closeBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    close();
  });

  portraitQuery.addEventListener?.('change', () => {
    if (!isPortraitMode()) {
      close();
    }
  });
}

export function isPortraitMode() {
  return portraitQuery.matches;
}

export function isOpenState() {
  return isOpen;
}

export function open() {
  if (!buildBarEl || !isPortraitMode()) return;
  isOpen = true;
  buildBarEl.hidden = false;
  buildBarEl.classList.add('mobile-build-bar--open');
  document.querySelector('.legend-btns-container--mobile')?.classList.add('mobile-build-bar-visible');
  syncConstructionOpenButton();
  requestAnimationFrame(() => {
    document.documentElement.style.setProperty('--mobile-build-bar-offset', `${buildBarEl.offsetHeight}px`);
  });
}

export function close() {
  if (!buildBarEl) return;
  isOpen = false;
  buildBarEl.hidden = true;
  buildBarEl.classList.remove('mobile-build-bar--open');
  document.documentElement.style.setProperty('--mobile-build-bar-offset', '0px');
  document.querySelector('.legend-btns-container--mobile')?.classList.remove('mobile-build-bar-visible');
  syncConstructionOpenButton();
}

function syncConstructionOpenButton() {
  const toggle = document.getElementById('toolbar-mobile-toggle');
  if (!toggle) return;
  toggle.classList.remove('active');
  toggle.setAttribute('aria-pressed', 'false');
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
    arrows: false,
    drag: 'free',
    gap: '8px',
    focus: 0,
    wheel: false,
  });
  splideInstance.mount();
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
    pill.textContent = category.label;
    pill.setAttribute('role', 'tab');
    pill.setAttribute('aria-selected', category.id === activeCategoryId ? 'true' : 'false');
    if (category.id === activeCategoryId) {
      pill.classList.add('mobile-build-bar__pill--active');
    }

    pill.addEventListener('click', (e) => {
      e.stopPropagation();
      selectCategory(category.id);
    });

    pillsEl.appendChild(pill);
  });
}

function selectCategory(categoryId) {
  activeCategoryId = categoryId;

  pillsEl?.querySelectorAll('.mobile-build-bar__pill').forEach((pill) => {
    const isActive = pill.dataset.category === categoryId;
    pill.classList.toggle('mobile-build-bar__pill--active', isActive);
    pill.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });

  renderCarousel(categoryId);

  if (isOpen && buildBarEl) {
    requestAnimationFrame(() => {
      document.documentElement.style.setProperty('--mobile-build-bar-offset', `${buildBarEl.offsetHeight}px`);
    });
  }
}

function renderCarousel(categoryId) {
  if (!listEl) return;

  listEl.innerHTML = '';
  const toolInfos = getToolButtonInfosForCategory(categoryId);

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
      },
    });

    listEl.appendChild(slide);
  });

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
