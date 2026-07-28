/**
 * Coordonnée de tuile sur la grille (entiers).
 */
export function createTileCoord(x, y) {
  const tileX = toGridInteger(x);
  const tileY = toGridInteger(y);
  if (tileX === null || tileY === null) {
    throw new Error(`TileCoord: invalid coordinates (${x}, ${y})`);
  }
  return Object.freeze({ x: tileX, y: tileY });
}

/** @returns {{ x: number, y: number } | null} */
export function tryCreateTileCoord(x, y) {
  try {
    return createTileCoord(x, y);
  } catch {
    return null;
  }
}

/**
 * @param {unknown} value
 * @returns {number | null}
 */
export function toGridInteger(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n)) return null;
  return n;
}
