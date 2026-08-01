/**
 * Cross-context bridge — injectable getTimeInfo without composition import cycles.
 * Registered at game bootstrap; composition roots resolve at call time.
 */

import { TimeManager } from '../shared/time/TimeManager.js';

/** @type {((turn: number) => object) | null} */
let getTimeInfoFn = null;

/** @param {(turn: number) => object} fn */
export function registerGetTimeInfo(fn) {
  getTimeInfoFn = fn;
}

/** @returns {(turn: number) => object} */
export function resolveGetTimeInfo() {
  return getTimeInfoFn ?? ((turn) => TimeManager.getTimeInfo(turn));
}

/** @internal Tests only */
export function resetGameTimeBridgeForTests() {
  getTimeInfoFn = null;
}
