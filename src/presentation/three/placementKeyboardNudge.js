/**
 * Keyboard nudging of the construction ghost on the city grid.
 * Arrow directions follow the camera azimuth (same basis as pan), snapped to one tile.
 */

/**
 * @param {KeyboardEvent} event
 * @returns {boolean}
 */
export function isPlacementNudgeArrowKey(event) {
  if (!event || event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) {
    return false;
  }
  return (
    event.key === 'ArrowUp'
    || event.key === 'ArrowDown'
    || event.key === 'ArrowLeft'
    || event.key === 'ArrowRight'
  );
}

/**
 * Map an arrow key to a 1-tile grid delta, screen-relative to camera azimuth.
 * Grid y maps to world Z (same convention as terrain meshes).
 *
 * @param {string} key
 * @param {number} [cameraAzimuthDeg=0]
 * @returns {{ dx: number, dy: number }}
 */
export function gridDeltaForArrowKey(key, cameraAzimuthDeg = 0) {
  const theta = (cameraAzimuthDeg * Math.PI) / 180;
  // Matches camera.js: forward = (0,0,1).applyAxisAngle(Y, θ), left = (1,0,0).applyAxisAngle(Y, θ)
  const forwardX = Math.sin(theta);
  const forwardZ = Math.cos(theta);
  const leftX = Math.cos(theta);
  const leftZ = -Math.sin(theta);

  let worldX = 0;
  let worldZ = 0;
  if (key === 'ArrowUp') {
    worldX = forwardX;
    worldZ = forwardZ;
  } else if (key === 'ArrowDown') {
    worldX = -forwardX;
    worldZ = -forwardZ;
  } else if (key === 'ArrowLeft') {
    worldX = leftX;
    worldZ = leftZ;
  } else if (key === 'ArrowRight') {
    worldX = -leftX;
    worldZ = -leftZ;
  }

  if (Math.abs(worldX) >= Math.abs(worldZ)) {
    return { dx: worldX >= 0 ? 1 : -1, dy: 0 };
  }
  return { dx: 0, dy: worldZ >= 0 ? 1 : -1 };
}

/**
 * @param {number} x
 * @param {number} y
 * @param {number} size
 * @returns {{ x: number, y: number }}
 */
export function clampGridTile(x, y, size) {
  const max = Math.max(0, (size | 0) - 1);
  return {
    x: Math.max(0, Math.min(max, Math.round(x))),
    y: Math.max(0, Math.min(max, Math.round(y))),
  };
}
