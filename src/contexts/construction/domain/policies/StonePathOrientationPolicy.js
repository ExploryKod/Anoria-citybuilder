/**
 * StonePath orientations for placement (same mesh, Z rotation).
 * Only two useful orientations: axis A vs perpendicular axis B.
 * Left/Cross were redundant UI variants of the same mesh.
 */

export const STONE_PATH_ORIENTATIONS = Object.freeze([
  'StonePath-001', // Z=180
  'StonePath-Right-001', // Z=270 — perpendicular
]);

/**
 * @param {string | null | undefined} buildingType
 */
export function isStonePathTool(buildingType) {
  return typeof buildingType === 'string' && buildingType.startsWith('StonePath-');
}

/**
 * Normalize any legacy StonePath-* id to an orientation index (0|1).
 * @param {string | null | undefined} buildingType
 */
export function stonePathOrientationIndex(buildingType) {
  if (buildingType === 'StonePath-Right-001' || buildingType === 'StonePath-Left-001') {
    return 1;
  }
  return 0;
}

/**
 * @param {number} index
 */
export function stonePathTypeForIndex(index) {
  const i = ((Math.floor(Number(index)) % STONE_PATH_ORIENTATIONS.length) + STONE_PATH_ORIENTATIONS.length)
    % STONE_PATH_ORIENTATIONS.length;
  return STONE_PATH_ORIENTATIONS[i];
}

/**
 * @param {number} index
 */
export function cycleStonePathOrientationIndex(index) {
  return (Math.floor(Number(index)) + 1) % STONE_PATH_ORIENTATIONS.length;
}

/**
 * Label for UI (horizontal / vertical relative to default mesh).
 * @param {number} index
 */
export function stonePathOrientationLabel(index) {
  return index === 1 ? '↕ Vertical' : '↔ Horizontal';
}
