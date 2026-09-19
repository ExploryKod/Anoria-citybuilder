/**
 * Interaction behavior modes — orthogonal to map mode (`gameMode.js`: solo / editor / …).
 *
 * - **select** — inspect buildings, pan/rotate the world
 * - **build** — placement ghost, R rotates the asset (houses, roads, editor terrain/props)
 * - **erase** — remove buildings or editor nature props (not bare terrain)
 */

/** @typedef {'select' | 'build' | 'erase'} BehaviorMode */

export const BEHAVIOR_MODE = Object.freeze({
  SELECT: 'select',
  BUILD: 'build',
  ERASE: 'erase',
});

export const SELECT_TOOL_ID = 'select-object';
export const ERASE_TOOL_ID = 'bulldoze';

/**
 * @param {string | null | undefined} toolId
 * @param {{ isPlacementTool?: (id: string) => boolean }} [options]
 * @returns {BehaviorMode}
 */
export function resolveBehaviorMode(toolId, { isPlacementTool } = {}) {
  if (!toolId || toolId === SELECT_TOOL_ID) {
    return BEHAVIOR_MODE.SELECT;
  }
  if (toolId === ERASE_TOOL_ID) {
    return BEHAVIOR_MODE.ERASE;
  }
  if (typeof isPlacementTool === 'function' && isPlacementTool(toolId)) {
    return BEHAVIOR_MODE.BUILD;
  }
  return BEHAVIOR_MODE.SELECT;
}

/**
 * @param {string | null | undefined} toolId
 * @param {{ isPlacementTool?: (id: string) => boolean }} [options]
 * @returns {boolean}
 */
export function isBuildBehaviorMode(toolId, options) {
  return resolveBehaviorMode(toolId, options) === BEHAVIOR_MODE.BUILD;
}

/**
 * @param {string | null | undefined} toolId
 * @param {{ isPlacementTool?: (id: string) => boolean }} [options]
 * @returns {boolean}
 */
export function isEraseBehaviorMode(toolId, options) {
  return resolveBehaviorMode(toolId, options) === BEHAVIOR_MODE.ERASE;
}

/**
 * @param {string | null | undefined} toolId
 * @param {{ isPlacementTool?: (id: string) => boolean }} [options]
 * @returns {boolean}
 */
export function isSelectBehaviorMode(toolId, options) {
  return resolveBehaviorMode(toolId, options) === BEHAVIOR_MODE.SELECT;
}

/**
 * Escape should return to select behavior from build or erase (not from select).
 *
 * @param {string | null | undefined} toolId
 * @param {{ isPlacementTool?: (id: string) => boolean }} [options]
 * @returns {boolean}
 */
export function shouldReturnToSelectOnEscape(toolId, options) {
  const mode = resolveBehaviorMode(toolId, options);
  return mode === BEHAVIOR_MODE.BUILD || mode === BEHAVIOR_MODE.ERASE;
}
