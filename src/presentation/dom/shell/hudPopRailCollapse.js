/**
 * Collapse the population rail to a single users icon (same as pop total).
 */

export const HUD_POP_RAIL_COLLAPSED_KEY = 'anoria.hudPopRailCollapsed';

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
 * @param {HTMLElement | null} [root]
 */
export function initHudPopRailCollapse(root = document.getElementById('hud-pop-rail')) {
  if (!root || root.dataset.popRailCollapseReady === 'true') return;
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

  let stored = false;
  try {
    stored = localStorage.getItem(HUD_POP_RAIL_COLLAPSED_KEY) === 'true';
  } catch {
    stored = false;
  }
  setHudPopRailCollapsed(stored, root, { persist: false, focus: false });
}
