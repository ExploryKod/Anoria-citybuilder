/**
 * Generic road-network pathfinder — shared, presentation-agnostic.
 *
 * Finds a real shortest route between two building tiles over the road
 * graph (BFS), the way Caesar 3 / Pharaoh walkers travel: leave the origin
 * building onto its adjacent road, walk the road network, arrive at the
 * destination building from its adjacent road.
 *
 * Deliberately agnostic: it knows nothing about buildings, goods, citizens,
 * or effects — it only knows tiles and a caller-supplied `isRoadTile(x, y)`
 * predicate. Any future walker type (cart, tax collector, ...) reuses this
 * unchanged; only the catalog data describing that walker changes.
 *
 * @typedef {{ x: number, y: number }} Tile
 */

const DIRECTIONS = [
  { dx: 0, dy: -1 },
  { dx: 0, dy: 1 },
  { dx: -1, dy: 0 },
  { dx: 1, dy: 0 },
];

/** @param {Tile} tile */
function tileKey(tile) {
  return `${tile.x},${tile.y}`;
}

/**
 * @param {Tile} tile
 * @param {(x: number, y: number) => boolean} isRoadTile
 * @returns {Tile[]}
 */
function getRoadNeighbors(tile, isRoadTile) {
  const neighbors = [];
  for (const { dx, dy } of DIRECTIONS) {
    const x = tile.x + dx;
    const y = tile.y + dy;
    if (isRoadTile(x, y)) {
      neighbors.push({ x, y });
    }
  }
  return neighbors;
}

/**
 * Finds the nearest road tile touching (adjacent to) a building tile.
 *
 * @param {Tile} buildingTile
 * @param {(x: number, y: number) => boolean} isRoadTile
 * @returns {Tile | null}
 */
export function findAdjacentRoadTile(buildingTile, isRoadTile) {
  const neighbors = getRoadNeighbors(buildingTile, isRoadTile);
  return neighbors[0] ?? null;
}

/**
 * Breadth-first shortest path between two road tiles. Exported so callers
 * that resolve "which road tile does this building enter from" using their
 * own rule (e.g. the game's 2-tile road-access radius — see
 * presentation/three/walkers/WalkerEventController.js) can still reuse this
 * for the walk itself, without going through `findRoadPathBetweenBuildings`'s
 * stricter direct-touch default.
 *
 * @param {Tile} startRoad
 * @param {Tile} endRoad
 * @param {(x: number, y: number) => boolean} isRoadTile
 * @returns {Tile[] | null} tile path from startRoad to endRoad, inclusive
 */
export function findShortestRoadPath(startRoad, endRoad, isRoadTile) {
  if (startRoad.x === endRoad.x && startRoad.y === endRoad.y) {
    return [startRoad];
  }

  const startKey = tileKey(startRoad);
  const endKey = tileKey(endRoad);
  const cameFrom = new Map();
  const visited = new Set([startKey]);
  const queue = [startRoad];

  for (let head = 0; head < queue.length; head += 1) {
    const current = queue[head];
    const currentKey = tileKey(current);

    for (const next of getRoadNeighbors(current, isRoadTile)) {
      const nextKey = tileKey(next);
      if (visited.has(nextKey)) continue;
      visited.add(nextKey);
      cameFrom.set(nextKey, currentKey);

      if (nextKey === endKey) {
        const path = [next];
        let key = currentKey;
        while (key !== startKey) {
          const [x, y] = key.split(',').map(Number);
          path.push({ x, y });
          key = cameFrom.get(key);
        }
        path.push(startRoad);
        return path.reverse();
      }

      queue.push(next);
    }
  }

  return null;
}

/**
 * Finds a full route between two building tiles: origin building → its
 * adjacent road → shortest road-network path → destination's adjacent
 * road → destination building.
 *
 * @param {object} params
 * @param {Tile} params.start Origin building tile
 * @param {Tile} params.end Destination building tile
 * @param {(x: number, y: number) => boolean} params.isRoadTile
 * @returns {Tile[] | null} full tile path, or null if unreachable
 */
export function findRoadPathBetweenBuildings({ start, end, isRoadTile }) {
  const startRoad = findAdjacentRoadTile(start, isRoadTile);
  const endRoad = findAdjacentRoadTile(end, isRoadTile);
  if (!startRoad || !endRoad) return null;

  const roadPath = findShortestRoadPath(startRoad, endRoad, isRoadTile);
  if (!roadPath) return null;

  return [start, ...roadPath, end];
}
