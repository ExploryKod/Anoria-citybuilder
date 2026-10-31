/**
 * Collapse the population rail to a single users icon (same as pop total).
 */

import { isScrolledToEnd, pageSideways } from './hudFoldGroup.js';

export const HUD_POP_RAIL_COLLAPSED_KEY = 'anoria.hudPopRailCollapsed';

/** A phone held in landscape: the rail opens as a bottom strip there (hud.css, "Pop rail as a bottom sheet") */
const SHEET_QUERY = '(max-width: 1024px) and (orientation: landscape) and (max-height: 500px)';

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

/**
 * In the bottom strip (phone in landscape) the labour market panel shows one block at a time, the city then each social category, as a sideways
 * scroller (hud.css). Its arrow pages it, back to the first block after the last, and points back while the last one is shown.
 * @param {HTMLElement} root
 */
function initLaborPaging(root) {
  const arrow = root.querySelector('#hud-pop-labor-next');
  const panel = root.querySelector('#hud-pop-panel-emploi');
  const scroller = panel?.querySelector('.pop-detail-labor');
  if (!arrow || !panel || !scroller) {
    throw new Error('hudPopRailCollapse: #hud-pop-labor-next, #hud-pop-panel-emploi or its .pop-detail-labor is missing from game.html');
  }
  const nextLabel = arrow.getAttribute('aria-label') ?? '';
  const rewindLabel = 'Revenir à la première catégorie';
  const sheet = window.matchMedia(SHEET_QUERY);

  const sync = () => {
    const shown = sheet.matches && !panel.hidden && scroller.scrollWidth > scroller.clientWidth + 1;
    arrow.hidden = !shown;
    const rewind = shown && isScrolledToEnd(scroller);
    arrow.classList.toggle('hud-fold-toggle--rewind', rewind);
    arrow.setAttribute('aria-label', rewind ? rewindLabel : nextLabel);
    arrow.title = rewind ? rewindLabel : nextLabel;
  };

  arrow.addEventListener('click', () => pageSideways(scroller, 1));
  scroller.addEventListener('scroll', sync, { passive: true });
  new ResizeObserver(sync).observe(scroller);
  // The panel is shown or hidden by its tab (the `hidden` attribute)
  new MutationObserver(sync).observe(panel, { attributes: true, attributeFilter: ['hidden'] });
  sheet.addEventListener('change', sync);
  sync();
}

/**
 * @param {HTMLElement | null} [root]
 */
export function initHudPopRailCollapse(root = document.getElementById('hud-pop-rail')) {
  if (!root || root.dataset.popRailCollapseReady === 'true') return;
  placeRailUnderDoor();
  initLaborPaging(root);
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
