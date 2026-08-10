/**
 * Touch placement mode — rotate-then-confirm before placing buildings.
 * Controlled explicitly via Paramètres (site + in-game). Default: off.
 */

const STORAGE_KEY = 'anoria.touchMode';

/**
 * @returns {boolean}
 */
export function isTouchModeEnabled() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return false;
    }
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

/**
 * @param {boolean} enabled
 */
export function setTouchModeEnabled(enabled) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }
    localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
  } catch {
    /* ignore */
  }
}
