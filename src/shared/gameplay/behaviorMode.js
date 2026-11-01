/**
 * Interaction behavior modes — orthogonal to map mode (`gameMode.js`: solo / editor / …).
 *
 * - **select** — inspect buildings, pan/rotate the world
 * - **build** — placement ghost, R rotates the asset (houses, roads, editor terrain/props)
 * - **erase** — remove buildings or editor nature props (not bare terrain)
 * - **range** — a click on a building shows what it reaches (roads, buildings that receive or supply it)
 */

import { parsePlotTool } from '../land-catalog/plotTools.js';

/** @typedef {'select' | 'build' | 'erase' | 'range' | 'plot'} BehaviorMode */

export const BEHAVIOR_MODE = Object.freeze({
  SELECT: 'select',
  BUILD: 'build',
  ERASE: 'erase',
  RANGE: 'range',
  /** The town hall puts a square of land up for sale, or takes it off sale (see land-catalog/plotTools.js). */
  PLOT: 'plot',
});

/**
 * The longest side, in tiles, of the square the eraser can draw while playing. The player is asked about what the square covers before it is demolished
 * (see BuildingNotifications.js `confirmDemolition`): a bounded square keeps that question short and a stray drag from covering the city. First value, to tune by playing.
 */
export const ERASE_SQUARE_MAX_SIDE = 5;

export const SELECT_TOOL_ID = 'select-object';
export const ERASE_TOOL_ID = 'bulldoze';
export const RANGE_TOOL_ID = 'show-range';

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
  if (toolId === RANGE_TOOL_ID) {
    return BEHAVIOR_MODE.RANGE;
  }
  if (parsePlotTool(toolId)) {
    return BEHAVIOR_MODE.PLOT;
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
 * @param {string | null | undefined} toolId
 * @param {{ isPlacementTool?: (id: string) => boolean }} [options]
 * @returns {boolean}
 */
export function isRangeBehaviorMode(toolId, options) {
  return resolveBehaviorMode(toolId, options) === BEHAVIOR_MODE.RANGE;
}

/**
 * Escape should return to select behavior from build, erase or range (not from select).
 *
 * @param {string | null | undefined} toolId
 * @param {{ isPlacementTool?: (id: string) => boolean }} [options]
 * @returns {boolean}
 */
export function shouldReturnToSelectOnEscape(toolId, options) {
  const mode = resolveBehaviorMode(toolId, options);
  return mode === BEHAVIOR_MODE.BUILD || mode === BEHAVIOR_MODE.ERASE || mode === BEHAVIOR_MODE.RANGE || mode === BEHAVIOR_MODE.PLOT;
}
