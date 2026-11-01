/**
 * Cheat codes — the player's permission, from Paramètres (section Développement). Default: off.
 *
 * Nothing about a cheat code opens unless this is on: the prompt does not open, a code is refused, and a cheat already recorded in a
 * game (see core/persistence/cheat/gameCheatFlags.js) has no effect on the rules. Turning it off hands the game back its own rules.
 * The one reader of this setting is `isCheatCodesAllowed`; every entry point and every engine override asks it, none keeps a copy.
 */

const STORAGE_KEY = 'anoria.cheatCodesAllowed';

/** @returns {boolean} */
export function isCheatCodesAllowed() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

/** @param {boolean} allowed */
export function setCheatCodesAllowed(allowed) {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    localStorage.setItem(STORAGE_KEY, allowed ? '1' : '0');
  } catch {
    /* ignore */
  }
}
