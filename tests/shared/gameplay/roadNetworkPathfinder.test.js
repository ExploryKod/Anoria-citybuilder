import { describe, expect, test } from '@jest/globals';
import { findRoadPathBetweenBuildings, findShortestRoadPath, findFarthestRoadPath } from '../../../src/shared/gameplay/roadNetworkPathfinder.js';

/**
 * Grid legend: 'B' = building, 'R' = road, '.' = empty.
 * Builds an `isRoadTile(x, y)` predicate from an ASCII grid so tests read
 * like the map they describe.
 */
function gridFromRows(rows) {
  return (x, y) => {
    if (y < 0 || y >= rows.length) return false;
    const row = rows[y];
    if (x < 0 || x >= row.length) return false;
    return row[x] === 'R';
  };
}

describe('findRoadPathBetweenBuildings', () => {
  test('routes from a fixed origin building to a fixed destination building via roads', () => {
    // Origin building at (0,1), destination building at (4,1), connected by a straight road.
    const rows = [
      '.....',
      'BRRRB',
      '.....',
    ];
    const isRoadTile = gridFromRows(rows);

    const path = findRoadPathBetweenBuildings({
      start: { x: 0, y: 1 },
      end: { x: 4, y: 1 },
      isRoadTile,
    });

    expect(path).not.toBeNull();
    expect(path[0]).toEqual({ x: 0, y: 1 });
    expect(path[path.length - 1]).toEqual({ x: 4, y: 1 });
    // Straight line: origin, 3 road tiles, destination.
    expect(path).toEqual([
      { x: 0, y: 1 },
      { x: 1, y: 1 },
      { x: 2, y: 1 },
      { x: 3, y: 1 },
      { x: 4, y: 1 },
    ]);
  });

  test('finds the shortest route around a bend, not just the first walk it finds', () => {
    const rows = [
      'B.....',
      'RRR...',
      '..R...',
      '..RRRB',
    ];
    const isRoadTile = gridFromRows(rows);

    const path = findRoadPathBetweenBuildings({
      start: { x: 0, y: 0 },
      end: { x: 5, y: 3 },
      isRoadTile,
    });

    expect(path).not.toBeNull();
    expect(path[0]).toEqual({ x: 0, y: 0 });
    expect(path[path.length - 1]).toEqual({ x: 5, y: 3 });
    // Shortest possible: origin + 7 road tiles + destination.
    expect(path).toHaveLength(9);
  });

  test('returns null when no road connects the two buildings', () => {
    const rows = [
      'B...B',
    ];
    const isRoadTile = gridFromRows(rows);

    const path = findRoadPathBetweenBuildings({
      start: { x: 0, y: 0 },
      end: { x: 4, y: 0 },
      isRoadTile,
    });

    expect(path).toBeNull();
  });

  test('returns null when a building has no adjacent road at all', () => {
    const rows = [
      'B.....',
      '.RRRRR',
    ];
    const isRoadTile = gridFromRows(rows);

    const path = findRoadPathBetweenBuildings({
      start: { x: 0, y: 0 },
      end: { x: 5, y: 1 },
      isRoadTile,
    });

    expect(path).toBeNull();
  });
});

describe('findShortestRoadPath', () => {
  test('walks between two road tiles a caller has already resolved itself', () => {
    // Callers that use a looser building→road entry rule than plain 4-neighbor
    // touch (e.g. the game's real road-access radius) still need this BFS for
    // the walk between whichever road tiles they resolved.
    const rows = [
      'RRR',
    ];
    const isRoadTile = gridFromRows(rows);

    const path = findShortestRoadPath({ x: 0, y: 0 }, { x: 2, y: 0 }, isRoadTile);

    expect(path).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ]);
  });
});

describe('findFarthestRoadPath', () => {
  test('walks to the end of a straight road', () => {
    const rows = ['RRRRR'];
    const isRoadTile = gridFromRows(rows);

    const path = findFarthestRoadPath({ x: 0, y: 0 }, isRoadTile);

    expect(path).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 3, y: 0 },
      { x: 4, y: 0 },
    ]);
  });

  test('returns just the start tile when it has no road neighbors at all', () => {
    const rows = ['R'];
    const isRoadTile = gridFromRows(rows);

    const path = findFarthestRoadPath({ x: 0, y: 0 }, isRoadTile);

    expect(path).toEqual([{ x: 0, y: 0 }]);
  });

  test('follows a bend to the true farthest tile by hop count, not straight-line distance', () => {
    const rows = [
      '.....R',
      '.....R',
      'RRRRRR',
    ];
    const isRoadTile = gridFromRows(rows);

    const path = findFarthestRoadPath({ x: 0, y: 2 }, isRoadTile);

    // (0,2) -> ... -> (5,2) is 5 hops, then north to (5,1) -> (5,0) is 2 more: 7 hops, 8 tiles inclusive.
    expect(path[path.length - 1]).toEqual({ x: 5, y: 0 });
    expect(path).toHaveLength(8);
  });

  test('a farthest-tile-then-retrace loop returns to the exact start with no gaps', () => {
    const rows = ['RRRR'];
    const isRoadTile = gridFromRows(rows);

    const outbound = findFarthestRoadPath({ x: 0, y: 0 }, isRoadTile);
    const loop = [...outbound, ...outbound.slice(0, -1).reverse()];

    expect(loop).toEqual([
      { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }, { x: 3, y: 0 },
      { x: 2, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 0 },
    ]);
  });
});
