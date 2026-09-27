import { describe, test, expect } from '@jest/globals';
import { BUILDING_ASSETS } from '../../src/presentation/three/assets/buildingAssets.js';
import {
  planRoadPaint,
  pieceForSides,
  roadPathBetween,
  roadPiecesFrom,
  turnedSides,
} from '../../src/presentation/three/placement/roadPaintPlanner.js';

const pieces = roadPiecesFrom(BUILDING_ASSETS);
const none = () => [];
const sidesOf = (planned) => turnedSides(pieces.find((piece) => piece.id === planned.buildingId).sides, planned.rotationStep).sort();

describe('adaptive road drag', () => {
  test('the catalog declares the road pieces, and every shape has one', () => {
    expect(pieces.length).toBeGreaterThanOrEqual(5);
    for (const shape of [['east', 'west'], ['north', 'east'], ['north', 'east', 'west'], ['north', 'east', 'south', 'west'], ['east']]) {
      expect(pieceForSides(shape, pieces)).not.toBeNull();
    }
  });

  test('the path is an L that goes first along the axis the cursor is furthest on', () => {
    const { cells } = roadPathBetween({ x: 2, y: 2 }, { x: 5, y: 3 });
    expect(cells).toEqual([{ x: 2, y: 2 }, { x: 3, y: 2 }, { x: 4, y: 2 }, { x: 5, y: 2 }, { x: 5, y: 3 }]);
    const down = roadPathBetween({ x: 2, y: 2 }, { x: 3, y: 6 }).cells;
    expect(down.slice(0, 5)).toEqual([{ x: 2, y: 2 }, { x: 2, y: 3 }, { x: 2, y: 4 }, { x: 2, y: 5 }, { x: 2, y: 6 }]);
  });

  test('a straight run stays straight and a turn becomes a bend on the sides it joins', () => {
    const path = roadPathBetween({ x: 0, y: 0 }, { x: 3, y: 2 }).cells; // east ×3, then south ×2
    const plan = planRoadPaint({ path, pieces, existingSides: none });

    expect(sidesOf(plan[0])).toEqual(['east', 'west']); // the start runs on
    expect(sidesOf(plan[1])).toEqual(['east', 'west']);
    expect(sidesOf(plan[3])).toEqual(['south', 'west']); // the corner: it arrives from the west, leaves to the south
    expect(sidesOf(plan[4])).toEqual(['north', 'south']);
    expect(sidesOf(plan[5])).toEqual(['north', 'south']);
  });

  test('turning the other way gives the bend the other turn', () => {
    const path = roadPathBetween({ x: 3, y: 0 }, { x: 0, y: 2 }).cells; // west ×3, then south ×2
    const plan = planRoadPaint({ path, pieces, existingSides: none });
    expect(sidesOf(plan[3])).toEqual(['east', 'south']);
  });

  test('crossing a road makes a cross, and joining one from the side a tee', () => {
    const crossing = planRoadPaint({
      path: roadPathBetween({ x: 0, y: 1 }, { x: 2, y: 1 }).cells,
      pieces,
      existingSides: (x, y) => (x === 1 && y === 1 ? ['north', 'south'] : []),
    });
    expect(sidesOf(crossing[1])).toEqual(['east', 'north', 'south', 'west']);

    const joining = planRoadPaint({
      path: roadPathBetween({ x: 1, y: 0 }, { x: 1, y: 1 }).cells, // arrives from the north onto a road that runs east-west
      pieces,
      existingSides: (x, y) => (x === 1 && y === 1 ? ['east', 'west'] : []),
    });
    expect(sidesOf(joining[1])).toEqual(['east', 'north', 'west']);
  });

  test('a single tile leaves the piece and the turn to the player', () => {
    expect(planRoadPaint({ path: [{ x: 4, y: 4 }], pieces, existingSides: none })).toEqual([{ x: 4, y: 4, single: true }]);
  });
});
