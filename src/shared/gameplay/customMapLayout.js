const CUSTOM_MAP_LAYOUT_KEY = 'anoria.customMapLayout';
const MISSION_MAP_LAYOUT_ID_KEY = 'anoria.missionMapLayoutId';

export function setCustomMapLayoutActive(active) {
  if (active) {
    sessionStorage.setItem(CUSTOM_MAP_LAYOUT_KEY, '1');
  } else {
    sessionStorage.removeItem(CUSTOM_MAP_LAYOUT_KEY);
  }
}

export function isCustomMapLayoutActive() {
  return sessionStorage.getItem(CUSTOM_MAP_LAYOUT_KEY) === '1';
}

/** @param {string} mapLayoutId */
export function setMissionMapLayoutId(mapLayoutId) {
  sessionStorage.setItem(MISSION_MAP_LAYOUT_ID_KEY, mapLayoutId);
  setCustomMapLayoutActive(true);
}

export function getMissionMapLayoutId() {
  return sessionStorage.getItem(MISSION_MAP_LAYOUT_ID_KEY);
}

export function clearMissionMapLayout() {
  sessionStorage.removeItem(MISSION_MAP_LAYOUT_ID_KEY);
  setCustomMapLayoutActive(false);
}
