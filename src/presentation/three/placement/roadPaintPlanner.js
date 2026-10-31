/**
 * The adaptive road drag: from where the player pressed to where the cursor is, the road is an L (one turn at
 * most, along the axis the cursor has gone furthest on first), and each tile gets the piece and the turn that
 * fit its neighbours in the path (and the road already there): a straight run, a bend where the path turns, a
 * tee or a cross where it crosses a road. The player's own choice of piece and turn (S, R) only rules a
 * single tile.
 *
 * Pure: pieces come from the mesh catalog's `roadSides` (which tile sides the asphalt of an unturned piece
 * reaches), nothing here names a road piece.
 */

/** Sides in the order a quarter turn (R) carries them: east → north → west → south → east. */
const TURN_ORDER = ['east', 'north', 'west', 'south'];

/** @type {Readonly<Record<string, { dx: number, dy: number }>>} */
const SIDE_STEP = Object.freeze({
  north: { dx: 0, dy: -1 },
  east: { dx: 1, dy: 0 },
  south: { dx: 0, dy: 1 },
  west: { dx: -1, dy: 0 },
});

const OPPOSITE = Object.freeze({ north: 'south', south: 'north', east: 'west', west: 'east' });

/**
 * @param {string} side
 * @param {number} steps Quarter turns.
 */
function turnSide(side, steps) {
  const index = TURN_ORDER.indexOf(side);
  return TURN_ORDER[(((index + steps) % 4) + 4) % 4];
}

/**
 * The two sides a road on a slope may reach: the one facing uphill and the one facing downhill. A road climbs a slope straight; a bend, a tee or a side
 * road on it would leave the ramp across its flank.
 * @param {{ dx: number, dy: number }} slope the neighbour the slope rises toward
 * @returns {string[]}
 */
export function slopeAxisSides(slope) {
  const high = Object.entries(SIDE_STEP).find(([, step]) => step.dx === slope.dx && step.dy === slope.dy)?.[0];
  if (!high) throw new Error(`[roadPaintPlanner] a slope rises toward a side of the tile, got (${slope.dx}, ${slope.dy})`);
  return [high, OPPOSITE[high]];
}

const LEVEL_TOLERANCE = 0.01;

/**
 * How high the road of a tile stands on one of its sides: the level of a flat tile, the top or the foot of a slope on its two ends. Null on the flanks of a
 * slope, where no road runs.
 * @param {{ elevation: number, slope: { dx: number, dy: number, rise: number } | null } | undefined} relief absent = plain grass at level 0
 * @param {string} side
 * @returns {number | null}
 */
function edgeHeight(relief, side) {
  if (!relief) return 0;
  if (!relief.slope) return relief.elevation;
  const step = SIDE_STEP[side];
  if (step.dx === relief.slope.dx && step.dy === relief.slope.dy) return relief.elevation;
  if (step.dx === -relief.slope.dx && step.dy === -relief.slope.dy) return relief.elevation - relief.slope.rise;
  return null;
}

/**
 * Two roads side by side must meet at the same height: a road only changes level along a slope, so two flat tiles of different levels (or a slope's end
 * against the wrong level) leave a step the walkers would cross through the cliff.
 * @param {{ x: number, y: number }} from
 * @param {{ x: number, y: number }} to a tile next to `from`
 * @param {object | undefined} reliefFrom the `tile.relief` of `from`
 * @param {object | undefined} reliefTo the `tile.relief` of `to`
 * @returns {boolean}
 */
export function roadLevelsMeet(from, to, reliefFrom, reliefTo) {
  const side = sideToward(from, to);
  if (!side) throw new Error(`[roadPaintPlanner] roadLevelsMeet needs two adjacent tiles, got (${from.x}, ${from.y}) and (${to.x}, ${to.y})`);
  const here = edgeHeight(reliefFrom, side);
  const there = edgeHeight(reliefTo, OPPOSITE[side]);
  if (here === null || there === null) return true;
  return Math.abs(here - there) <= LEVEL_TOLERANCE;
}

/**
 * The sides a piece reaches once turned `steps` quarter turns.
 * @param {ReadonlyArray<string>} sides
 * @param {number} steps
 * @returns {string[]}
 */
export function turnedSides(sides, steps) {
  return sides.map((side) => turnSide(side, steps));
}

/**
 * The road pieces of a mesh catalog: every entry that declares `roadSides`, with the sides its unturned mesh
 * reaches once its own base yaw is counted.
 * @param {Record<string, { roadSides?: string[], transform?: { rotationDeg?: { y?: number } } }>} assets
 * @returns {Array<{ id: string, sides: string[] }>}
 */
export function roadPiecesFrom(assets) {
  return Object.entries(assets)
    .filter(([, asset]) => Array.isArray(asset.roadSides))
    .map(([id, asset]) => ({
      id,
      sides: turnedSides(asset.roadSides, Math.round((asset.transform?.rotationDeg?.y ?? 0) / 90)),
    }));
}

/**
 * The piece, and how many quarter turns, that reach exactly these sides: the first piece (in catalog order) and
 * the fewest turns that do. Null when no piece has that shape.
 * @param {ReadonlyArray<string>} wanted
 * @param {ReadonlyArray<{ id: string, sides: string[] }>} pieces
 * @returns {{ buildingId: string, rotationStep: number } | null}
 */
export function pieceForSides(wanted, pieces) {
  const target = [...new Set(wanted)].sort().join();
  for (const piece of pieces) {
    for (let step = 0; step < 4; step += 1) {
      if (turnedSides(piece.sides, step).sort().join() === target) return { buildingId: piece.id, rotationStep: step };
    }
  }
  return null;
}

/**
 * The L a drag draws: along the axis the cursor has gone furthest on first, then along the other.
 * @param {{ x: number, y: number }} start Where the player pressed.
 * @param {{ x: number, y: number }} end The tile under the cursor.
 * @param {'x' | 'y' | null} [previousAxis] The axis chosen before: kept on a tie, so the path does not flip.
 * @returns {{ cells: Array<{ x: number, y: number }>, axis: 'x' | 'y' | null }}
 */
export function roadPathBetween(start, end, previousAxis = null) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (dx === 0 && dy === 0) return { cells: [{ x: start.x, y: start.y }], axis: null };

  const axis = Math.abs(dx) > Math.abs(dy) ? 'x' : Math.abs(dy) > Math.abs(dx) ? 'y' : (previousAxis ?? 'x');
  const cells = [{ x: start.x, y: start.y }];
  let { x, y } = start;
  const walk = (along) => {
    const step = Math.sign(along === 'x' ? dx : dy);
    const count = Math.abs(along === 'x' ? dx : dy);
    for (let i = 0; i < count; i += 1) {
      if (along === 'x') x += step;
      else y += step;
      cells.push({ x, y });
    }
  };
  walk(axis);
  walk(axis === 'x' ? 'y' : 'x');
  return { cells, axis };
}

/**
 * The drag of a building that takes a plot (a house): along the path the player drew, the origin of each plot
 * that does not overlap the one before — as many as fit end to end, none adapted to its neighbours. The first
 * plot is where the player pressed.
 *
 * @param {object} params
 * @param {Array<{ x: number, y: number }>} params.path The L, in order (see `roadPathBetween`).
 * @param {number} params.width Plot width in tiles, rotation already applied.
 * @param {number} params.depth Plot depth in tiles, rotation already applied.
 * @returns {Array<{ x: number, y: number }>}
 */
export function plotsAlongPath({ path, width, depth }) {
  /** @type {Array<{ x: number, y: number }>} */
  const plots = [];
  for (const cell of path) {
    const overlaps = plots.some(
      (plot) => cell.x < plot.x + width && cell.x + width > plot.x && cell.y < plot.y + depth && cell.y + depth > plot.y,
    );
    if (!overlaps) plots.push({ x: cell.x, y: cell.y });
  }
  return plots;
}

/** The side of `from` that faces the adjacent `to`. */
function sideToward(from, to) {
  return Object.entries(SIDE_STEP).find(([, step]) => from.x + step.dx === to.x && from.y + step.dy === to.y)?.[0] ?? null;
}

/**
 * The piece and turn of every tile of a path.
 *
 * @param {object} params
 * @param {Array<{ x: number, y: number }>} params.path The L, in order.
 * @param {ReadonlyArray<{ id: string, sides: string[] }>} params.pieces
 * @param {(x: number, y: number) => string[]} params.existingSides The sides the road already on a tile reaches
 *   (empty when there is none): they are kept, so crossing a road makes a tee or a cross.
 * @returns {Array<{ x: number, y: number, buildingId: string, rotationStep: number } | { x: number, y: number, single: true }>}
 *   A single-tile path has no direction of its own: it is returned as `{ single: true }` for the player's own choice.
 */
export function planRoadPaint({ path, pieces, existingSides }) {
  if (path.length === 1) return [{ x: path[0].x, y: path[0].y, single: true }];

  return path.map((cell, index) => {
    const sides = new Set(existingSides(cell.x, cell.y));
    const previous = path[index - 1];
    const next = path[index + 1];
    if (previous) sides.add(sideToward(cell, previous));
    if (next) sides.add(sideToward(cell, next));
    // An end of the path runs on straight, in the direction of the drag, instead of stopping short with a cap.
    if (sides.size === 1) sides.add(OPPOSITE[[...sides][0]]);

    const piece = pieceForSides([...sides], pieces);
    if (!piece) throw new Error(`[roadPaintPlanner] no road piece reaches ${[...sides].join('+')}`);
    return { x: cell.x, y: cell.y, ...piece };
  });
}
