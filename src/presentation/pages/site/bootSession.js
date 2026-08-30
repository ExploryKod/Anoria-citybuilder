import { hasStoredGameMode } from '../../../shared/gameplay/gameMode.js';

const BOOT_MODE_KEY = 'anoria.bootMode';
const MISSION_ID_KEY = 'anoria.missionId';
const PROFILE_NAME_KEY = 'anoria.profileName';
const LANDING_PATH = '/';

/** @typedef {'new' | 'tutorial' | 'load' | 'mission' | 'editor'} BootMode */

/** @param {BootMode} mode */
export function setBootMode(mode) {
  sessionStorage.setItem(BOOT_MODE_KEY, mode);
}

/**
 * Pending menu choice before the first game bootstrap read. `null` = no intent (e.g. F5 refresh).
 * @returns {BootMode | null}
 */
export function getBootMode() {
  const raw = sessionStorage.getItem(BOOT_MODE_KEY);
  if (raw === 'tutorial' || raw === 'load' || raw === 'mission' || raw === 'editor' || raw === 'new') {
    return raw;
  }
  if (raw !== null) {
    return 'new';
  }
  return null;
}

/**
 * Read and clear the one-shot boot intent. After this, only `anoria.gameMode` drives map mode.
 * @returns {BootMode | null}
 */
export function consumeBootMode() {
  const mode = getBootMode();
  sessionStorage.removeItem(BOOT_MODE_KEY);
  return mode;
}

export function hasPendingBootMode() {
  return sessionStorage.getItem(BOOT_MODE_KEY) !== null;
}

export function clearBootMode() {
  sessionStorage.removeItem(BOOT_MODE_KEY);
}

/**
 * Block naked `/game` visits: require menu boot intent or an existing session (refresh).
 *
 * @returns {boolean} true when entry is allowed (stay on game page)
 */
export function isGameEntryAllowed() {
  if (typeof window === 'undefined') return true;
  return hasPendingBootMode() || hasStoredGameMode();
}

/**
 * @returns {boolean} true when redirecting (abort bootstrap)
 */
export function redirectToLandingUnlessEntryAllowed() {
  if (isGameEntryAllowed()) {
    return false;
  }
  window.location.replace(LANDING_PATH);
  return true;
}

/** @param {string} missionId */
export function setMissionId(missionId) {
  sessionStorage.setItem(MISSION_ID_KEY, missionId);
}

export function getMissionId() {
  return sessionStorage.getItem(MISSION_ID_KEY);
}

export function clearMissionId() {
  sessionStorage.removeItem(MISSION_ID_KEY);
}

/** @param {string} profileName */
export function setProfileName(profileName) {
  sessionStorage.setItem(PROFILE_NAME_KEY, profileName.trim());
}

export function getProfileName() {
  return sessionStorage.getItem(PROFILE_NAME_KEY) ?? '';
}

export function clearProfileName() {
  sessionStorage.removeItem(PROFILE_NAME_KEY);
}
