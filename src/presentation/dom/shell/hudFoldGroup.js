/**
 * Fold a group of HUD buttons to a single toggle, as the population rail folds to one icon: the right-hand column and the two bottom
 * groups use the same mechanism and the same toggle (`.hud-fold-toggle`). Unfolding gives back every button, so every menu.
 * The toggle is the group's first child (the right column) or sits outside it (the bottom dock): then folding hides the whole group.
 */

/** On a phone or tablet the map comes first: a group that asks for it starts folded until the player has chosen. */
const TOUCH_QUERY = '(max-width: 1024px)';

/**
 * @param {{
 *   root: HTMLElement,
 *   toggle: HTMLElement,
 *   collapsed: boolean,
 *   storageKey: string,
 *   foldedLabel: string,
 *   unfoldedLabel: string,
 *   openerIds: string[],
 * }} group
 * @param {{ persist?: boolean, focus?: boolean }} [options]
 */
function setCollapsed(group, options = {}) {
  const { root, toggle, collapsed, storageKey, foldedLabel, unfoldedLabel, openerIds } = group;
  const persist = options.persist !== false;

  root.classList.toggle('hud-fold--collapsed', collapsed);
  toggle.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
  toggle.setAttribute('aria-label', collapsed ? foldedLabel : unfoldedLabel);
  toggle.title = collapsed ? foldedLabel : unfoldedLabel;

  if (collapsed) {
    // A flyout opened from a folded button would be left floating with no opener in sight.
    for (const openerId of openerIds) {
      const opener = document.getElementById(openerId);
      if (opener?.getAttribute('aria-expanded') === 'true') opener.click();
    }
  }

  if (persist) {
    try {
      localStorage.setItem(storageKey, collapsed ? 'true' : 'false');
    } catch {
      // Ignore quota / private-mode failures.
    }
  }

  if (options.focus === true) toggle.focus();
}

/**
 * @param {{
 *   rootSelector: string,
 *   toggleId: string,
 *   storageKey: string,
 *   foldedLabel: string,
 *   unfoldedLabel: string,
 *   foldedOnTouch: boolean,
 *   openerIds?: string[],
 * }} config
 */
export function initHudFoldGroup(config) {
  const { rootSelector, toggleId, storageKey, foldedLabel, unfoldedLabel, foldedOnTouch, openerIds = [] } = config;
  const root = document.querySelector(rootSelector);
  const toggle = document.getElementById(toggleId);
  if (!root || !toggle) {
    throw new Error(`hudFoldGroup: ${rootSelector} or #${toggleId} is missing from game.html`);
  }
  if (root.dataset.hudFoldReady === 'true') return;
  root.dataset.hudFoldReady = 'true';
  // A toggle that lives outside its group (the bottom dock) cannot be left standing in it: folding hides the whole group.
  root.classList.toggle('hud-fold--external', !root.contains(toggle));

  const group = { root, toggle, collapsed: false, storageKey, foldedLabel, unfoldedLabel, openerIds };

  toggle.addEventListener('click', () => {
    group.collapsed = !root.classList.contains('hud-fold--collapsed');
    setCollapsed(group, { focus: true });
  });

  let stored = null;
  try {
    stored = localStorage.getItem(storageKey);
  } catch {
    stored = null;
  }
  group.collapsed = stored === null ? foldedOnTouch && window.matchMedia(TOUCH_QUERY).matches : stored === 'true';
  setCollapsed(group, { persist: false });
}
