import { getLandUse } from './LandUseCatalog.js';

/**
 * The sides of a tile, as the tile (x, y) of the grid sits at world (x, ·, y): north is y - 1.
 * `rotationY` turns a straight Kenney fence, which stands along the north edge (its -z side) of a tile, onto that side.
 */
const SIDES = Object.freeze([
  Object.freeze({ side: 'north', dx: 0, dy: -1, rotationY: 0 }),
  Object.freeze({ side: 'east', dx: 1, dy: 0, rotationY: -Math.PI / 2 }),
  Object.freeze({ side: 'south', dx: 0, dy: 1, rotationY: Math.PI }),
  Object.freeze({ side: 'west', dx: -1, dy: 0, rotationY: Math.PI / 2 }),
]);

/**
 * The fences around the plots: one straight fence on each side of a plot tile that does not face a tile of the same use (two plots of one use side by side
 * are one field; two of different uses keep their own fence). Each fence spans its whole edge, so they meet at the corners with no gap.
 * @param {Array<{ x: number, y: number, use: string }>} plots
 * @returns {Array<{ id: string, assetId: string, x: number, y: number, rotationY: number }>}
 */
export function plotFencePieces(plots) {
  const useAt = new Map(plots.map((plot) => [`${plot.x},${plot.y}`, plot.use]));
  const fences = [];
  for (const { x, y, use } of plots) {
    const { fenceAssetId } = getLandUse(use);
    for (const { side, dx, dy, rotationY } of SIDES) {
      if (useAt.get(`${x + dx},${y + dy}`) === use) continue;
      fences.push({ id: `plot-fence-${x}-${y}-${side}`, assetId: fenceAssetId, x, y, rotationY });
    }
  }
  return fences;
}

/**
 * Why a tile cannot be put up for sale, or null when it can: outside the city, already for sale, covered by a building or a road, or ground that is not
 * clear and flat (a tree, a rock, a cliff, a slope: a forest is planted on bare level ground).
 * @param {{ buildingId?: string, plot?: object, relief?: { flat: boolean, obstacle: boolean } } | undefined} tile
 * @returns {'out_of_bounds' | 'plot_taken' | 'plot_built' | 'plot_ground' | null}
 */
export function plotMarkRefusal(tile) {
  if (!tile) return 'out_of_bounds';
  if (tile.plot) return 'plot_taken';
  if (tile.buildingId !== undefined) return 'plot_built';
  if (tile.relief && (tile.relief.obstacle || !tile.relief.flat)) return 'plot_ground';
  return null;
}
