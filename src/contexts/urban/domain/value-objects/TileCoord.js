export function createTileCoord(x, y) {
  if (!Number.isInteger(x) || !Number.isInteger(y)) {
    throw new Error(`TileCoord: invalid coordinates (${x}, ${y})`);
  }
  return Object.freeze({ x, y });
}
