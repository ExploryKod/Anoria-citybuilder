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
 * Optional `?mode=editor` on `/game` (dev / bookmark).
 *
 * @returns {GameMode | null}
 */
export function resolveGameModeFromUrl() {
  if (typeof window === 'undefined') return null;
  const mode = new URLSearchParams(window.location.search).get('mode');
  if (mode === GAME_MODES.EDITOR) return GAME_MODES.EDITOR;
  return null;
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
