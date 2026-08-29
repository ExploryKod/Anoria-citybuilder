/**
 * Cycle pop-rail metric scope: both → country → hamlet → both.
 * Controls visibility of .pop-detail-value--country / --hamlet via data-pop-scope.
 */

export const HUD_POP_RAIL_SCOPE_KEY = 'anoria.hudPopRailScope';

export const HUD_POP_RAIL_SCOPES = Object.freeze({
  both: 'both',
  country: 'country',
  hamlet: 'hamlet',
});

const SCOPE_ORDER = Object.freeze([
  HUD_POP_RAIL_SCOPES.both,
  HUD_POP_RAIL_SCOPES.country,
  HUD_POP_RAIL_SCOPES.hamlet,
]);

const SCOPE_LABELS = Object.freeze({
  [HUD_POP_RAIL_SCOPES.both]: 'Pays et hameau',
  [HUD_POP_RAIL_SCOPES.country]: 'Chiffres globaux',
  [HUD_POP_RAIL_SCOPES.hamlet]: 'Chiffres du hameau',
});

/**
 * @param {string | null | undefined} value
 * @returns {'both' | 'country' | 'hamlet'}
 */
export function normalizeHudPopRailScope(value) {
  return SCOPE_ORDER.includes(value) ? value : HUD_POP_RAIL_SCOPES.hamlet;
}

/**
 * @param {'both' | 'country' | 'hamlet'} scope
 * @returns {'both' | 'country' | 'hamlet'}
 */
export function nextHudPopRailScope(scope) {
  const current = normalizeHudPopRailScope(scope);
  const index = SCOPE_ORDER.indexOf(current);
  return SCOPE_ORDER[(index + 1) % SCOPE_ORDER.length];
}

/**
 * @param {HTMLElement | null} [root]
 * @returns {'both' | 'country' | 'hamlet'}
 */
export function getHudPopRailScope(root = document.getElementById('hud-pop-rail')) {
  return normalizeHudPopRailScope(root?.dataset?.popScope);
}

/**
 * @param {'both' | 'country' | 'hamlet'} scope
 * @param {HTMLElement | null} [root]
 * @param {{ persist?: boolean }} [options]
 */
export function setHudPopRailScope(
  scope,
  root = document.getElementById('hud-pop-rail'),
  options = {},
) {
  if (!root) return;
  const next = normalizeHudPopRailScope(scope);
  const persist = options.persist !== false;

  root.dataset.popScope = next;

  const btn = root.querySelector('#hud-pop-rail-scope');
  if (btn instanceof HTMLButtonElement) {
    const label = SCOPE_LABELS[next];
    btn.title = label;
    btn.setAttribute('aria-label', `${label} — cliquer pour changer`);
    btn.dataset.scope = next;

    for (const icon of btn.querySelectorAll('[data-scope-icon]')) {
      const match = icon.getAttribute('data-scope-icon') === next;
      icon.toggleAttribute('hidden', !match);
    }
  }

  if (persist) {
    try {
      localStorage.setItem(HUD_POP_RAIL_SCOPE_KEY, next);
    } catch {
      // Ignore quota / private-mode failures.
    }
  }
}

/**
 * @param {HTMLElement | null} [root]
 */
export function cycleHudPopRailScope(root = document.getElementById('hud-pop-rail')) {
  setHudPopRailScope(nextHudPopRailScope(getHudPopRailScope(root)), root);
}

/**
 * @param {HTMLElement | null} [root]
 */
export function initHudPopRailScope(root = document.getElementById('hud-pop-rail')) {
  if (!root || root.dataset.popRailScopeReady === 'true') return;
  const btn = root.querySelector('#hud-pop-rail-scope');
  if (!(btn instanceof HTMLButtonElement)) return;

  root.dataset.popRailScopeReady = 'true';

  btn.addEventListener('click', () => {
    cycleHudPopRailScope(root);
  });

  let stored = HUD_POP_RAIL_SCOPES.hamlet;
  try {
    stored = normalizeHudPopRailScope(localStorage.getItem(HUD_POP_RAIL_SCOPE_KEY));
  } catch {
    stored = HUD_POP_RAIL_SCOPES.hamlet;
  }
  setHudPopRailScope(stored, root, { persist: false });
}
