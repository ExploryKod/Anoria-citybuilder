/**
 * Fold a group of HUD buttons to a single toggle, as the population rail folds to one icon: the right-hand column and the two bottom
 * groups use the same mechanism and the same toggle (`.hud-fold-toggle`). Unfolding gives back every button, so every menu.
 * The toggle is the group's first child (the right column) or sits outside it (the bottom dock): then folding hides the whole group.
 */

/** On a phone or tablet the map comes first: a group that asks for it starts folded until the player has chosen. */
const TOUCH_QUERY = '(max-width: 1024px)';

/** @param {HTMLElement} scroller @returns {boolean} whether a sideways scroller is at its last page */
export function isScrolledToEnd(scroller) {
  return scroller.scrollLeft + scroller.clientWidth >= scroller.scrollWidth - 2;
}

/**
 * The paging arrow's action, shared by every sideways scroller that has one: a page forward, or back to the start from the last page.
 * @param {HTMLElement} scroller
 * @param {number} fraction the share of the visible width one page moves by (1 for a scroller that snaps on whole slides)
 */
export function pageSideways(scroller, fraction) {
  if (isScrolledToEnd(scroller)) scroller.scrollTo({ left: 0, behavior: 'smooth' });
  else scroller.scrollBy({ left: scroller.clientWidth * fraction, behavior: 'smooth' });
}

/** @type {{ group: object, exclusiveWith: string | null, syncArrow: () => void }[]} the groups initialised so far */
const registry = [];
let exclusiveMediaBound = false;

/**
 * Groups that name each other in `exclusiveWith` cannot be open together on a phone or tablet: the toggle of one switches to it, the one that was
 * not just opened folds. Wider than that there is room for both, so nothing is enforced.
 * @param {object | null} changed the group the player just toggled (null: nothing, e.g. at load or when the screen is resized)
 */
function syncExclusive(changed) {
  const narrow = window.matchMedia(TOUCH_QUERY).matches;
  const isOpen = (entry) => !entry.group.root.classList.contains('hud-fold--collapsed');
  const partnerOf = (entry) => registry.find((other) => other.group.toggle.id === entry.exclusiveWith);

  if (narrow) {
    for (const entry of registry) {
      const partner = entry.exclusiveWith ? partnerOf(entry) : null;
      if (!partner || !isOpen(entry) || !isOpen(partner)) continue;
      // Both open: the one the player did not just open folds; at load or on a resize from a wide screen, the one registered last
      const toFold = changed
        ? (entry.group === changed ? partner : entry)
        : (registry.indexOf(entry) > registry.indexOf(partner) ? entry : partner);
      toFold.group.collapsed = true;
      setCollapsed(toFold.group, { persist: false });
      toFold.syncArrow();
    }
  }
}

/**
 * Unfold the group that holds a button, when it is folded: for what needs the button on screen (the tutorial pulsing it, the build bar anchored on its
 * row). The player's saved choice is left as it was; a group the button is not in (or that is already open) is left alone.
 * @param {Element | null} element
 */
export function unfoldGroupOf(element) {
  if (!element) return;
  const entry = registry.find((candidate) => candidate.group.root.contains(element));
  if (!entry || !entry.group.root.classList.contains('hud-fold--collapsed')) return;
  entry.group.collapsed = false;
  setCollapsed(entry.group, { persist: false });
  entry.syncArrow();
  syncExclusive(entry.group);
}

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
 *   scrollArrowId?: string,
 *   exclusiveWith?: string,
 * }} config
 * `exclusiveWith`: the toggle id of a group that cannot be open at the same time on a phone or tablet (see `syncExclusive`); both name each other.
 * `scrollArrowId`: a button that pages the group sideways when it is dragged as a carousel (phone in portrait), and goes back to the start
 * after the last page. It shows only while the group is unfolded and wider than its room.
 */
export function initHudFoldGroup(config) {
  const { rootSelector, toggleId, storageKey, foldedLabel, unfoldedLabel, foldedOnTouch, openerIds = [], scrollArrowId, exclusiveWith = null } = config;
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

  const arrow = scrollArrowId ? document.getElementById(scrollArrowId) : null;
  if (scrollArrowId && !arrow) throw new Error(`hudFoldGroup: #${scrollArrowId} is missing from game.html`);
  const nextLabel = arrow?.getAttribute('aria-label') ?? '';
  const rewindLabel = 'Revenir au début des boutons';
  const isAtEnd = () => isScrolledToEnd(root);
  const syncArrow = () => {
    if (!arrow) return;
    const overflows = root.scrollWidth > root.clientWidth + 1;
    const collapsed = root.classList.contains('hud-fold--collapsed');
    arrow.hidden = collapsed || !overflows;
    // The group makes room for the arrow only while it is there (a group that fits stays centred)
    root.classList.toggle('hud-fold--paged', !arrow.hidden);
    // At the end the arrow points back: the next click goes to the start
    const rewind = !arrow.hidden && isAtEnd();
    arrow.classList.toggle('hud-fold-toggle--rewind', rewind);
    arrow.setAttribute('aria-label', rewind ? rewindLabel : nextLabel);
    arrow.title = rewind ? rewindLabel : nextLabel;
  };
  if (arrow) {
    arrow.addEventListener('click', () => pageSideways(root, 0.75));
    root.addEventListener('scroll', syncArrow, { passive: true });
    new ResizeObserver(syncArrow).observe(root);
    window.addEventListener('orientationchange', () => requestAnimationFrame(syncArrow));
  }

  toggle.addEventListener('click', () => {
    group.collapsed = !root.classList.contains('hud-fold--collapsed');
    setCollapsed(group, { focus: true });
    syncArrow();
    syncExclusive(group);
  });

  let stored = null;
  try {
    stored = localStorage.getItem(storageKey);
  } catch {
    stored = null;
  }
  group.collapsed = stored === null ? foldedOnTouch && window.matchMedia(TOUCH_QUERY).matches : stored === 'true';
  setCollapsed(group, { persist: false });
  syncArrow();

  registry.push({ group, exclusiveWith, syncArrow });
  if (!exclusiveMediaBound) {
    exclusiveMediaBound = true;
    window.matchMedia(TOUCH_QUERY).addEventListener('change', () => syncExclusive(null));
  }
  syncExclusive(null);
}
