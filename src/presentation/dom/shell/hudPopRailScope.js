/**
 * Switch the pop-rail metric scope: the hamlet ↔ the whole country (one at a time, never side by side).
 * The scope is data-pop-scope on the rail: GameUI writes the figures of that scope, and the CSS colours them by it.
 */

export const HUD_POP_RAIL_SCOPE_KEY = 'anoria.hudPopRailScope';

/** Fired on `window` each time the scope is set; GameUI redraws the rail's figures for the new scope. `detail.scope` is the scope. */
export const HUD_POP_RAIL_SCOPE_EVENT = 'anoria:pop-rail-scope-change';

export const HUD_POP_RAIL_SCOPES = Object.freeze({
  country: 'country',
  hamlet: 'hamlet',
});

const SCOPE_ORDER = Object.freeze([
  HUD_POP_RAIL_SCOPES.hamlet,
  HUD_POP_RAIL_SCOPES.country,
]);

const SCOPE_LABELS = Object.freeze({
  [HUD_POP_RAIL_SCOPES.country]: 'Chiffres globaux',
  [HUD_POP_RAIL_SCOPES.hamlet]: 'Chiffres du hameau',
});

/**
 * @param {string | null | undefined} value
 * @returns {'country' | 'hamlet'}
 * @throws {Error} when the value is not a scope (a stale stored choice, a typo): it is named, never replaced by another
 */
export function normalizeHudPopRailScope(value) {
  if (!SCOPE_ORDER.includes(value)) {
    throw new Error(
      `hudPopRailScope: unknown scope ${JSON.stringify(value)} (expected ${SCOPE_ORDER.join(' or ')}); `
      + `if it comes from the browser's storage, clear it: localStorage.removeItem('${HUD_POP_RAIL_SCOPE_KEY}')`,
    );
  }
  return value;
}

/**
 * @param {'country' | 'hamlet'} scope
 * @returns {'country' | 'hamlet'}
 */
export function nextHudPopRailScope(scope) {
  const current = normalizeHudPopRailScope(scope);
  const index = SCOPE_ORDER.indexOf(current);
  return SCOPE_ORDER[(index + 1) % SCOPE_ORDER.length];
}

/**
 * @param {HTMLElement | null} [root]
 * @returns {'country' | 'hamlet'}
 */
export function getHudPopRailScope(root = document.getElementById('hud-pop-rail')) {
  return normalizeHudPopRailScope(root?.dataset?.popScope);
}

/**
 * @param {'country' | 'hamlet'} scope
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
  window.dispatchEvent(new CustomEvent(HUD_POP_RAIL_SCOPE_EVENT, { detail: { scope: next } }));

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

  // No stored choice yet: the hamlet's figures. A stored value that is not a scope throws (see normalizeHudPopRailScope).
  let saved = null;
  try {
    saved = localStorage.getItem(HUD_POP_RAIL_SCOPE_KEY);
  } catch {
    // Private mode: nothing stored, the default stands.
  }
  setHudPopRailScope(saved ?? HUD_POP_RAIL_SCOPES.hamlet, root, { persist: false });
}
