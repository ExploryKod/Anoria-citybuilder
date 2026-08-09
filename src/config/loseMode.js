/**
 * Lose-mode switch — famine deaths, growth freeze, game over.
 *
 * When `isLoseMode()` is true, limiting gameplay is active.
 * When false, HUD counters still update but consequences are skipped.
 *
 * Resolution order:
 * 1. `VITE_IS_LOSE_MODE` (env)
 * 2. `localStorage anoria.loseMode` (`1` / `0`)
 * 3. Default: `false` in Vite DEV, `true` in production builds
 */

const STORAGE_KEY = 'anoria.loseMode';

/**
 * @returns {boolean | null} explicit override, or null if unset
 */
function readEnvLoseMode() {
  try {
    if (
      typeof import.meta !== 'undefined'
      && import.meta.env
      && Object.prototype.hasOwnProperty.call(import.meta.env, 'VITE_IS_LOSE_MODE')
    ) {
      const raw = String(import.meta.env.VITE_IS_LOSE_MODE).toLowerCase();
      if (raw === 'true' || raw === '1') return true;
      if (raw === 'false' || raw === '0') return false;
    }
  } catch {
    /* ignore */
  }

  try {
    if (typeof window !== 'undefined' && window.__VITE_IS_LOSE_MODE__ !== undefined) {
      const raw = String(window.__VITE_IS_LOSE_MODE__).toLowerCase();
      if (raw === 'true' || raw === '1') return true;
      if (raw === 'false' || raw === '0') return false;
    }
  } catch {
    /* ignore */
  }

  return null;
}

/**
 * @returns {boolean | null}
 */
function readLocalStorageLoseMode() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === '1' || stored === 'true') return true;
    if (stored === '0' || stored === 'false') return false;
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * @returns {boolean}
 */
function readDefaultLoseMode() {
  try {
    // Safe while iterating in `pnpm dev`; enabled by default in prod builds.
    return !import.meta.env?.DEV;
  } catch {
    return true;
  }
}

/** @returns {boolean} */
export function isLoseMode() {
  const fromEnv = readEnvLoseMode();
  if (fromEnv !== null) return fromEnv;

  const fromStorage = readLocalStorageLoseMode();
  if (fromStorage !== null) return fromStorage;

  return readDefaultLoseMode();
}

/**
 * Runtime toggle (localStorage). Cleared when passing null.
 * @param {boolean | null} enabled
 */
export function setLoseMode(enabled) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  if (enabled === null) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }
  localStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
}
