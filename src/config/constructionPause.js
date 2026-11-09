/**
 * Construction mode = a pause in which the player can build and demolish (Paramètres, in game). Default: on.
 * Off: the construction bar opens without pausing the game, and the road and the eraser stay available.
 */

const STORAGE_KEY = 'anoria.constructionPause';

/** @returns {boolean} */
export function isConstructionPauseEnabled() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return true;
    return localStorage.getItem(STORAGE_KEY) !== '0';
  } catch {
    return true;
  }
}

/** @param {boolean} enabled */
export function setConstructionPauseEnabled(enabled) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new CustomEvent('anoria:construction-pause-setting', { detail: { enabled: !!enabled } }));
}
