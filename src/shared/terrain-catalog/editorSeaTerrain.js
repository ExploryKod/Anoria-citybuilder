/** Editor-only: bulldozed cell — no base mesh; sea backdrop visible. Not the default map state. */
export const EDITOR_SEA_TERRAIN_ID = 'editor:sea';

/**
 * @param {string | null | undefined} terrainId
 * @returns {boolean}
 */
export function isEditorSeaTerrain(terrainId) {
  return terrainId === EDITOR_SEA_TERRAIN_ID;
}
