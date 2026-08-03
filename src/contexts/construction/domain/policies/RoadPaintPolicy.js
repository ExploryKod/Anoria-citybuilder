/**
 * Cells to paint between two road tiles (grid line, inclusive of end).
 * Bresenham so fast mouse moves still fill gaps.
 *
 * @param {number} x0
 * @param {number} y0
 * @param {number} x1
 * @param {number} y1
 * @returns {ReadonlyArray<{ x: number, y: number }>}
 */
export function listRoadPaintCells(x0, y0, x1, y1) {
  const startX = Math.floor(Number(x0));
  const startY = Math.floor(Number(y0));
  const endX = Math.floor(Number(x1));
  const endY = Math.floor(Number(y1));

  if (!Number.isFinite(startX) || !Number.isFinite(startY) || !Number.isFinite(endX) || !Number.isFinite(endY)) {
    return Object.freeze([]);
  }

  if (startX === endX && startY === endY) {
    return Object.freeze([{ x: endX, y: endY }]);
  }

  const cells = [];
  let x = startX;
  let y = startY;
  const dx = Math.abs(endX - startX);
  const dy = Math.abs(endY - startY);
  const sx = startX < endX ? 1 : -1;
  const sy = startY < endY ? 1 : -1;
  let err = dx - dy;

  // Skip the start cell (already painted); include the end.
  while (x !== endX || y !== endY) {
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      x += sx;
    }
    if (e2 < dx) {
      err += dx;
      y += sy;
    }
    cells.push({ x, y });
  }

  return Object.freeze(cells);
}
