/**
 * Shared map coordinate space — matches trade map percentages (0–100).
 */

export const MAP_COORDINATE_MAX = 100;

/**
 * @param {number} norm 0–1
 * @returns {number}
 */
export function toMapPixels(norm) {
  return norm * MAP_COORDINATE_MAX;
}

/**
 * @param {number} pixels
 * @returns {number}
 */
export function fromMapPixels(pixels) {
  return pixels / MAP_COORDINATE_MAX;
}

/**
 * @param {{ x: number, y: number }} point Normalized 0–1 coordinates.
 * @returns {{ x: number, y: number }}
 */
export function toPercentCoords(point) {
  return {
    x: toMapPixels(point.x),
    y: toMapPixels(point.y),
  };
}

/**
 * @param {{ x: number, y: number }} point Percentage coordinates (0–100).
 * @returns {{ x: number, y: number }}
 */
export function fromPercentCoords(point) {
  return {
    x: fromMapPixels(point.x),
    y: fromMapPixels(point.y),
  };
}
