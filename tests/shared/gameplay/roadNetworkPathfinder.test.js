import { describe, expect, test } from '@jest/globals';
import { findRoadPathBetweenBuildings, findShortestRoadPath } from '../../../src/shared/gameplay/roadNetworkPathfinder.js';

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
