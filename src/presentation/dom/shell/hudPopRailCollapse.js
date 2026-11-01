/**
 * Collapse the population rail to a single users icon (same as pop total).
 */

import { isScrolledToBottom, isScrolledToEnd, pageDownwards, pageSideways } from './hudFoldGroup.js';

export const HUD_POP_RAIL_COLLAPSED_KEY = 'anoria.hudPopRailCollapsed';

/** A phone held in landscape: the rail opens as a bottom strip there (hud.css, "Pop rail as a bottom sheet") */
const SHEET_QUERY = '(max-width: 1024px) and (orientation: landscape) and (max-height: 500px)';
/** A phone or tablet held in portrait: the rail is a tall column beside its tabs, and the details panel pages its blocks downwards there */
const PORTRAIT_QUERY = '(max-width: 1024px) and (orientation: portrait)';

/**
 * @param {HTMLElement | null} [root]
 * @returns {boolean}
 */
export function isHudPopRailCollapsed(root = document.getElementById('hud-pop-rail')) {
  return Boolean(root?.classList.contains('hud-pop-rail--collapsed'));
}

/**
 * @param {boolean} collapsed
 * @param {HTMLElement | null} [root]
 * @param {{ persist?: boolean, focus?: boolean }} [options]
 */
export function setHudPopRailCollapsed(
  collapsed,
  root = document.getElementById('hud-pop-rail'),
  options = {},
) {
  if (!root) return;
  const persist = options.persist !== false;
  const focus = options.focus === true;

  root.classList.toggle('hud-pop-rail--collapsed', collapsed);

  const panels = root.querySelector('.hud-pop-rail__panels');
  const tabs = root.querySelector('.hud-pop-rail__tabs');
  const collapseBtn = root.querySelector('#hud-pop-rail-collapse');
  const expandBtn = root.querySelector('#hud-pop-rail-expand');

  if (panels instanceof HTMLElement) {
    panels.hidden = collapsed;
    panels.toggleAttribute('inert', collapsed);
  }
  if (tabs instanceof HTMLElement) {
    tabs.hidden = collapsed;
    tabs.toggleAttribute('inert', collapsed);
  }
  if (collapseBtn instanceof HTMLButtonElement) {
    collapseBtn.hidden = collapsed;
    collapseBtn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
  }
  if (expandBtn instanceof HTMLButtonElement) {
    expandBtn.hidden = !collapsed;
    expandBtn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
  }

  if (persist) {
    try {
      localStorage.setItem(HUD_POP_RAIL_COLLAPSED_KEY, collapsed ? 'true' : 'false');
    } catch {
      // Ignore quota / private-mode failures.
    }
  }

  if (focus) {
    const next = collapsed ? expandBtn : collapseBtn;
    next?.focus();
  }
}

/**
 * The rail's default anchor on touch screens: right under the exit door, aligned with it. Measured, since the HUD puts the door where the
 * safe area, the progress bar and the screen size say (`--hud-pop-rail-top-touch`, used by hud.css).
 */
function placeRailUnderDoor() {
  const door = document.getElementById('game-exit-home-btn');
  if (!door) throw new Error('hudPopRailCollapse: #game-exit-home-btn is missing from game.html');
  const place = () => {
    const bottom = door.getBoundingClientRect().bottom;
    document.documentElement.style.setProperty('--hud-pop-rail-top-touch', `${Math.ceil(bottom) + 8}px`);
  };
  place();
  new ResizeObserver(place).observe(door);
  window.addEventListener('resize', place);
}

/** Gives the blocks and the scroller back to the stylesheet: nothing a layout of pages set on them is left. */
function clearPages(scroller, slides) {
  scroller.style.height = '';
  for (const slide of slides) {
    slide.style.width = '';
    slide.style.marginRight = '';
    slide.style.marginBottom = '';
    slide.removeAttribute('data-page-start');
  }
}

/**
 * Groups the blocks of a column into pages that scroll downwards, for a phone or a tablet held in portrait, where the rail is a tall column: as many
 * consecutive blocks go in a page as fit its height, so a column with few icons is one page and one with many is a few of them, instead of a rail that
 * grows taller than its tabs. A page is as tall as the column of tabs beside it (less what the panel keeps for itself above and below). The first block of
 * a page is marked (`data-page-start`, the scroll snaps there; the stylesheet drops its rule and top room) and the last one gets the room that is left,
 * so that every page is exactly one height and the next page never shows.
 * @param {HTMLElement} scroller
 * @param {ReadonlyArray<HTMLElement>} slides
 * @param {HTMLElement} panel the panel that holds the scroller
 * @param {HTMLElement} side the column of tabs beside the panel
 * @param {boolean} active
 * @param {number} perPage the most blocks a page holds (1: one block to a page, whatever the room)
 */
function packVerticalPages(scroller, slides, panel, side, active, perPage) {
  clearPages(scroller, slides);
  const panelStyle = getComputedStyle(panel);
  const kept = Number.parseFloat(panelStyle.paddingTop) + Number.parseFloat(panelStyle.paddingBottom)
    + Number.parseFloat(panelStyle.borderTopWidth) + Number.parseFloat(panelStyle.borderBottomWidth);
  const pageHeight = side.getBoundingClientRect().height - kept;
  if (!active || !(pageHeight > 0) || slides.length === 0) return;

  /** The height a block takes in the column, its own margins included */
  const outerHeight = (slide) => {
    const { marginTop, marginBottom } = getComputedStyle(slide);
    return slide.getBoundingClientRect().height + Number.parseFloat(marginTop) + Number.parseFloat(marginBottom);
  };

  /** @type {HTMLElement[][]} */
  const pages = [];
  let used = 0;
  for (const slide of slides) {
    const height = outerHeight(slide);
    if (pages.length === 0 || pages[pages.length - 1].length >= perPage || used + height > pageHeight) {
      pages.push([slide]);
      used = height;
    } else {
      pages[pages.length - 1].push(slide);
      used += height;
    }
  }

  // The blocks that start a page lose their rule and top room (the stylesheet), so each page is measured again before it gets the room that is left
  for (const page of pages) page[0].setAttribute('data-page-start', '');
  scroller.style.height = `${pageHeight}px`;
  for (const page of pages) {
    const total = page.reduce((sum, slide) => sum + outerHeight(slide), 0);
    page[page.length - 1].style.marginBottom = `${Math.max(0, pageHeight - total)}px`;
  }
}

/**
 * Groups the blocks of a sideways scroller into pages: consecutive blocks go in one page as long as they fit the width of the scroller (and, when
 * `perPage` is given, up to that many), so a block that is small (deaths) is shown with the next one rather than alone with the start of the next
 * page showing beside it. The blocks of a page sit side by side, each aligned on its left: two blocks that both fit half a page take one half each (so
 * the second always starts at the same place, whatever the first one's width), else they follow each other with the usual gap. The first block of
 * a page is marked (`data-page-start`, the scroll snaps there) and the last one gets the room that is left, so that every page is exactly one width
 * wide and the next page never shows. Without room (hidden, or not the strip) the blocks are left as they are.
 * @param {HTMLElement} scroller
 * @param {ReadonlyArray<HTMLElement>} slides
 * @param {boolean} active
 * @param {number} perPage the most blocks a page holds
 */
function packPages(scroller, slides, active, perPage) {
  clearPages(scroller, slides);
  // A page is the visible width of the scroller (its panel keeps the room of the buttons around it)
  const pageWidth = scroller.clientWidth;
  if (!active || !(pageWidth > 0) || slides.length === 0) return;

  const gap = Number.parseFloat(getComputedStyle(slides[0]).marginRight);
  const half = (pageWidth - gap) / 2;
  let used = 0;
  /** @type {Array<{ slide: HTMLElement, width: number }>} */
  let page = [];
  const closePage = () => {
    if (page.length === 0) return;
    page[0].slide.setAttribute('data-page-start', '');
    if (page.length === 2 && page.every(({ width }) => width <= half)) {
      // One half each, aligned on its left: the second block starts in the same place whatever the first one's width
      page[0].slide.style.width = `${half}px`;
      page[0].slide.style.marginRight = `${gap}px`;
      page[1].slide.style.width = `${half}px`;
      page[1].slide.style.marginRight = '0px';
    } else {
      page[page.length - 1].slide.style.marginRight = `${Math.max(0, pageWidth - used)}px`;
    }
  };
  for (const slide of slides) {
    const width = slide.getBoundingClientRect().width;
    if (page.length > 0 && (page.length >= perPage || used + gap + width > pageWidth)) {
      closePage();
      page = [];
    }
    used = page.length === 0 ? width : used + gap + width;
    page.push({ slide, width });
  }
  closePage();
}

/**
 * In the bottom strip (phone in landscape) a panel shows one block at a time as a sideways scroller (hud.css): the labour market panel, the city then each
 * social category; the details panel, population, hunger, deaths, work. Each has its arrow, which pages it, back to the first block after the last, and points
 * back while the last one is shown.
 * @param {HTMLElement} root
 * @param {{ arrowId: string, panelId: string, scrollerSelector: string | null, slideSelector?: string, slidesPerPage?: number, pagesDownInPortrait?: boolean }} paged
 *   `scrollerSelector` null: the panel itself is the scroller. `slideSelector`: its blocks are grouped into pages by width (see packPages), up to
 *   `slidesPerPage` of them, instead of one per page. `pagesDownInPortrait`: in a portrait column its blocks page downwards, as many to a page as
 *   fit its height (see packVerticalPages), with the same arrow.
 */
function initPanelPaging(root, { arrowId, panelId, scrollerSelector, slideSelector = null, slidesPerPage = Infinity, pagesDownInPortrait = false, counterId = null }) {
  const arrow = root.querySelector(`#${arrowId}`);
  const counter = counterId ? root.querySelector(`#${counterId}`) : null;
  if (counterId && !counter) throw new Error(`hudPopRailCollapse: #${counterId} is missing from game.html`);
  const panel = root.querySelector(`#${panelId}`);
  const scroller = scrollerSelector ? panel?.querySelector(scrollerSelector) : panel;
  const side = root.querySelector('.hud-pop-rail__side');
  if (!arrow || !panel || !scroller || !side) {
    throw new Error(`hudPopRailCollapse: #${arrowId}, #${panelId}${scrollerSelector ? ` or its ${scrollerSelector}` : ''} or .hud-pop-rail__side is missing from game.html`);
  }
  const nextLabel = arrow.getAttribute('aria-label') ?? '';
  const rewindLabel = 'Revenir à la première catégorie';
  const sheet = window.matchMedia(SHEET_QUERY);
  const portrait = window.matchMedia(PORTRAIT_QUERY);

  /** How the blocks are paged now: sideways in the bottom strip, downwards in a portrait column (when asked), else not at all */
  const direction = () => {
    if (panel.hidden) return null;
    if (sheet.matches) return 'sideways';
    return pagesDownInPortrait && portrait.matches ? 'downwards' : null;
  };

  const sync = () => {
    const way = direction();
    const overflows = way === 'downwards'
      ? scroller.scrollHeight > scroller.clientHeight + 1
      : scroller.scrollWidth > scroller.clientWidth + 1;
    const shown = way !== null && overflows;
    arrow.hidden = !shown;
    const atEnd = way === 'downwards' ? isScrolledToBottom(scroller) : isScrolledToEnd(scroller);
    const rewind = shown && atEnd;
    arrow.classList.toggle('hud-fold-toggle--rewind', rewind);
    arrow.setAttribute('aria-label', rewind ? rewindLabel : nextLabel);
    arrow.title = rewind ? rewindLabel : nextLabel;

    // Which page is shown, out of how many: the pages are exactly one width (or height) of the scroller apart, so the position says it
    if (counter) {
      counter.hidden = !shown;
      if (shown) {
        const pageSize = way === 'downwards' ? scroller.clientHeight : scroller.clientWidth;
        const extent = way === 'downwards' ? scroller.scrollHeight : scroller.scrollWidth;
        const position = way === 'downwards' ? scroller.scrollTop : scroller.scrollLeft;
        const total = Math.max(1, Math.round(extent / pageSize));
        const current = Math.min(total, Math.max(1, Math.round(position / pageSize) + 1));
        // Seen as "1/2"; read by a screen reader as "Page 1 sur 2" (the figure itself is hidden from it)
        counter.replaceChildren(
          Object.assign(document.createElement('span'), { textContent: `${current}/${total}`, ariaHidden: 'true' }),
          Object.assign(document.createElement('span'), { className: 'sr-only', textContent: `Page ${current} sur ${total}` }),
        );
      }
    }
  };

  const slides = slideSelector ? [...scroller.querySelectorAll(slideSelector)] : [];
  // The pages are laid out again when the room or the blocks change (not at each scroll), then the arrow follows
  const relayout = () => {
    if (slides.length > 0) {
      const way = direction();
      if (way === 'downwards') packVerticalPages(scroller, slides, panel, side, true, slidesPerPage);
      else packPages(scroller, slides, way === 'sideways', slidesPerPage);
    }
    sync();
  };

  arrow.addEventListener('click', () => (direction() === 'downwards' ? pageDownwards(scroller) : pageSideways(scroller, 1)));
  scroller.addEventListener('scroll', sync, { passive: true });
  const resizes = new ResizeObserver(relayout);
  resizes.observe(scroller);
  for (const slide of slides) resizes.observe(slide);
  // A page of a portrait column is as tall as the column of tabs beside it
  if (pagesDownInPortrait) resizes.observe(side);
  // The panel is shown or hidden by its tab (the `hidden` attribute)
  new MutationObserver(relayout).observe(panel, { attributes: true, attributeFilter: ['hidden'] });
  sheet.addEventListener('change', relayout);
  portrait.addEventListener('change', relayout);
  relayout();
}

/**
 * @param {HTMLElement | null} [root]
 */
export function initHudPopRailCollapse(root = document.getElementById('hud-pop-rail')) {
  if (!root || root.dataset.popRailCollapseReady === 'true') return;
  placeRailUnderDoor();
  // The labour market: one category to a page (the city, then each social category); downwards in a portrait column
  initPanelPaging(root, {
    arrowId: 'hud-pop-labor-next',
    panelId: 'hud-pop-panel-emploi',
    scrollerSelector: '.pop-detail-labor',
    slideSelector: '.pop-labor-group',
    slidesPerPage: 1,
    pagesDownInPortrait: true,
    counterId: 'hud-pop-labor-page',
  });
  initPanelPaging(root, { arrowId: 'hud-pop-details-next', panelId: 'hud-pop-panel-details', scrollerSelector: '.pop-detail-pages', slideSelector: '.pop-detail-block', slidesPerPage: 2, pagesDownInPortrait: true, counterId: 'hud-pop-details-page' });
  const collapseBtn = root.querySelector('#hud-pop-rail-collapse');
  const expandBtn = root.querySelector('#hud-pop-rail-expand');
  if (!collapseBtn || !expandBtn) return;

  root.dataset.popRailCollapseReady = 'true';

  collapseBtn.addEventListener('click', () => {
    setHudPopRailCollapsed(true, root, { focus: true });
  });
  expandBtn.addEventListener('click', () => {
    setHudPopRailCollapsed(false, root, { focus: true });
  });

  // Opened, the rail is a wide strip over the bottom of a phone held in landscape: until the player has chosen, it starts folded there
  let stored = window.matchMedia(SHEET_QUERY).matches;
  try {
    const saved = localStorage.getItem(HUD_POP_RAIL_COLLAPSED_KEY);
    if (saved !== null) stored = saved === 'true';
  } catch {
    // Private mode: the default above stands.
  }
  setHudPopRailCollapsed(stored, root, { persist: false, focus: false });
}
