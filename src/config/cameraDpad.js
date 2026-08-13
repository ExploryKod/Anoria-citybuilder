/**
 * Optional on-screen camera D-pad (crosshair FAB + #mobile-camera-controls).
 * Controlled via Paramètres (site + in-game). Default: off.
 */

const STORAGE_KEY = 'anoria.cameraDpad';

/**
 * @returns {boolean}
 */
export function isCameraDpadEnabled() {
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
export function setCameraDpadEnabled(enabled) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return;
    }
    localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
  } catch {
    /* ignore */
  }
  try {
    window.dispatchEvent(new CustomEvent('anoria:camera-dpad-change', { detail: { enabled: !!enabled } }));
  } catch {
    /* ignore */
  }
}
