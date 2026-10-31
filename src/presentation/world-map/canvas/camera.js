/**
 * The map's camera, as pure functions: which world point is at the centre of the view, and how much it is magnified. No DOM, no canvas.
 *
 * @typedef {{ x: number, y: number, zoom: number }} Camera the world point at the centre of the view, and the zoom
 * @typedef {{ width: number, height: number }} Viewport the view's size, in screen pixels
 * @typedef {{ minX: number, minY: number, maxX: number, maxY: number }} Bounds
 */

/** @returns {{ x: number, y: number }} the screen point where a world point is drawn */
export function worldToScreen(camera, viewport, worldX, worldY) {
  return {
    x: (worldX - camera.x) * camera.zoom + viewport.width / 2,
    y: (worldY - camera.y) * camera.zoom + viewport.height / 2,
  };
}

/** @returns {{ x: number, y: number }} the world point drawn at a screen point */
export function screenToWorld(camera, viewport, screenX, screenY) {
  return {
    x: (screenX - viewport.width / 2) / camera.zoom + camera.x,
    y: (screenY - viewport.height / 2) / camera.zoom + camera.y,
  };
}

/** @returns {number} the zoom, held between the limits */
export function clampZoom(zoom, limits) {
  return Math.min(limits.max, Math.max(limits.min, zoom));
}

/**
 * The zoom that shows a whole map in a view, with a small margin.
 * @param {Viewport} viewport
 * @param {{ width: number, height: number }} extent the size of what must be visible, in world units
 * @param {number} [margin] the share of the view the map may fill
 */
export function fitZoom(viewport, extent, margin = 0.95) {
  return Math.min(viewport.width / extent.width, viewport.height / extent.height) * margin;
}

/**
 * A new zoom, with the world point under a screen point staying under it (the pointer, or the middle of two fingers).
 * @param {Camera} camera
 * @param {Viewport} viewport
 * @param {number} nextZoom already clamped
 * @param {number} screenX
 * @param {number} screenY
 * @returns {Camera}
 */
export function zoomAround(camera, viewport, nextZoom, screenX, screenY) {
  const anchor = screenToWorld(camera, viewport, screenX, screenY);
  return {
    zoom: nextZoom,
    x: anchor.x - (screenX - viewport.width / 2) / nextZoom,
    y: anchor.y - (screenY - viewport.height / 2) / nextZoom,
  };
}

/**
 * The camera moved by a drag of the pointer, in screen pixels.
 * @param {Camera} camera
 * @returns {Camera}
 */
export function panBy(camera, deltaScreenX, deltaScreenY) {
  return { zoom: camera.zoom, x: camera.x - deltaScreenX / camera.zoom, y: camera.y - deltaScreenY / camera.zoom };
}

/**
 * The camera with its centre kept over the map (a margin around it), so that the map is never lost off screen.
 * @param {Camera} camera
 * @param {Bounds} bounds the map's extent, in world units
 * @param {number} margin
 * @returns {Camera}
 */
export function keepCenterOver(camera, bounds, margin) {
  return {
    zoom: camera.zoom,
    x: Math.min(bounds.maxX + margin, Math.max(bounds.minX - margin, camera.x)),
    y: Math.min(bounds.maxY + margin, Math.max(bounds.minY - margin, camera.y)),
  };
}

/**
 * Whether a screen point is inside a rectangle that is made at least `minSize` wide and high around its centre (a finger needs room).
 * @param {{ left: number, top: number, width: number, height: number }} rect
 * @param {number} screenX
 * @param {number} screenY
 * @param {number} minSize
 */
export function rectHit(rect, screenX, screenY, minSize) {
  const width = Math.max(rect.width, minSize);
  const height = Math.max(rect.height, minSize);
  const left = rect.left + rect.width / 2 - width / 2;
  const top = rect.top + rect.height / 2 - height / 2;
  return screenX >= left && screenX <= left + width && screenY >= top && screenY <= top + height;
}
