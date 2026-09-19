/**
 * Map mode (solo / editor / mission / tutorial) — orthogonal to behavior mode (select / build / erase).
 *
 * ## Source of truth
 * `sessionStorage` key `anoria.gameMode` is the **only** runtime value. All gameplay code reads
 * `getGameMode()` / `isEditorMode()`.
 *
 * ## When gameMode is written
 * **Only** when the player explicitly enters from the landing menu:
 * - landing menu → `setBootMode(...)` → bootstrap `consumeBootMode()` → `setGameMode(...)`
 *
 * Refreshing `game.html` without a new menu click does **not** call `setGameMode` — editor (etc.)
 * survives until the tab/session ends or the user starts a new entry from the menu.
 *
 * There is no URL-vs-session fallback chain at bootstrap.
 *
 * ## Direct access
 * `/game` without menu intent and without a stored `gameMode` redirects to `/` (landing).
 * `/world` requires a stored `gameMode` (player must have entered the game this session).
 * Refresh mid-session is allowed because `hasStoredGameMode()` is true.
 */

const GAME_MODE_KEY = 'anoria.gameMode';

/** @typedef {'solo' | 'tutorial' | 'mission' | 'editor'} GameMode */

export const GAME_MODES = Object.freeze({
  SOLO: 'solo',
  TUTORIAL: 'tutorial',
  MISSION: 'mission',
  EDITOR: 'editor',
});

/** @param {GameMode} mode */
export function setGameMode(mode) {
  sessionStorage.setItem(GAME_MODE_KEY, mode);
}

/** @returns {GameMode} */
export function getGameMode() {
  const raw = sessionStorage.getItem(GAME_MODE_KEY);
  if (raw === GAME_MODES.TUTORIAL) return GAME_MODES.TUTORIAL;
  if (raw === GAME_MODES.MISSION) return GAME_MODES.MISSION;
  if (raw === GAME_MODES.EDITOR) return GAME_MODES.EDITOR;
  return GAME_MODES.SOLO;
}

export function clearGameMode() {
  sessionStorage.removeItem(GAME_MODE_KEY);
}

/** True once the player has entered the game at least once this session (any map mode). */
export function hasStoredGameMode() {
  return sessionStorage.getItem(GAME_MODE_KEY) !== null;
}

export function isEditorMode() {
  return getGameMode() === GAME_MODES.EDITOR;
}

export function isMissionMode() {
  return getGameMode() === GAME_MODES.MISSION;
}

export function isTutorialMode() {
  return getGameMode() === GAME_MODES.TUTORIAL;
}

/**
 * One-shot boot intent from the landing menu (or URL promoted to boot).
 *
 * @param {'new' | 'tutorial' | 'load' | 'mission' | 'editor'} bootMode
 * @returns {GameMode}
 */
export function gameModeFromBootMode(bootMode) {
  if (bootMode === 'tutorial') return GAME_MODES.TUTORIAL;
  if (bootMode === 'mission') return GAME_MODES.MISSION;
  if (bootMode === 'editor') return GAME_MODES.EDITOR;
  return GAME_MODES.SOLO;
}

/**
 * @param {'solo' | 'tutorial' | 'mission' | 'editor'} action
 * @returns {GameMode}
 */
export function gameModeFromBootAction(action) {
  if (action === 'tutorial') return GAME_MODES.TUTORIAL;
  if (action === 'mission') return GAME_MODES.MISSION;
  if (action === 'editor') return GAME_MODES.EDITOR;
  return GAME_MODES.SOLO;
}
