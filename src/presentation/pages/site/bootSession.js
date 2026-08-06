const BOOT_MODE_KEY = 'anoria.bootMode';
const MISSION_ID_KEY = 'anoria.missionId';
const PROFILE_NAME_KEY = 'anoria.profileName';

/** @typedef {'new' | 'tutorial' | 'load' | 'mission'} BootMode */

/** @param {BootMode} mode */
export function setBootMode(mode) {
  sessionStorage.setItem(BOOT_MODE_KEY, mode);
}

/** @returns {BootMode} */
export function getBootMode() {
  const raw = sessionStorage.getItem(BOOT_MODE_KEY);
  if (raw === 'tutorial' || raw === 'load' || raw === 'mission') {
    return raw;
  }
  return 'new';
}

export function clearBootMode() {
  sessionStorage.removeItem(BOOT_MODE_KEY);
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
