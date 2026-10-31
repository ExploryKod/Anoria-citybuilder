const CUSTOM_MAP_LAYOUT_KEY = 'anoria.customMapLayout';
const MISSION_MAP_LAYOUT_ID_KEY = 'anoria.missionMapLayoutId';
const PENDING_EDITOR_MAP_KEY = 'anoria.pendingEditorMap';

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

/**
 * The map the player chose in the editor menu (a file, or one of the folder): the map document as stored, kept for the boot that builds the editor on it.
 * No pending map = a blank editor.
 * @param {object} document a map document (see `parseEditorMapLayout`)
 */
export function setPendingEditorMap(document) {
  sessionStorage.setItem(PENDING_EDITOR_MAP_KEY, JSON.stringify(document));
}

/** @returns {object | null} the map document waiting to be opened in the editor, left in place */
export function peekPendingEditorMap() {
  const raw = sessionStorage.getItem(PENDING_EDITOR_MAP_KEY);
  return raw === null ? null : JSON.parse(raw);
}

/** @returns {object | null} the map document waiting to be opened in the editor, now consumed: a later reload opens a blank editor */
export function takePendingEditorMap() {
  const document = peekPendingEditorMap();
  sessionStorage.removeItem(PENDING_EDITOR_MAP_KEY);
  return document;
}

export function clearMissionMapLayout() {
  sessionStorage.removeItem(MISSION_MAP_LAYOUT_ID_KEY);
  setCustomMapLayoutActive(false);
}
