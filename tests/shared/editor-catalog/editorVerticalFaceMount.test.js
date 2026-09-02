import { describe, expect, test } from '@jest/globals';
import {
  computeKenneyVerticalEdgeMountTransform,
  glueFaceWorldCoordinate,
  neighborTileForHostFace,
  oppositeFaceDirection,
  sharedGridEdgeCoordinate,
} from '../../../src/shared/editor-catalog/editorVerticalFaceMount.js';

describe('editorVerticalFaceMount', () => {
  test('neighbor tile is one step across the host face', () => {
    expect(neighborTileForHostFace(4, 4, 'north')).toEqual({ x: 4, y: 5 });
    expect(neighborTileForHostFace(4, 4, 'south')).toEqual({ x: 4, y: 3 });
    expect(neighborTileForHostFace(4, 4, 'east')).toEqual({ x: 5, y: 4 });
    expect(neighborTileForHostFace(4, 4, 'west')).toEqual({ x: 3, y: 4 });
  });

  test('opposite face pairs', () => {
    expect(oppositeFaceDirection('north')).toBe('south');
    expect(oppositeFaceDirection('east')).toBe('west');
  });

  test('shared grid edge sits between host and child tiles', () => {
    expect(sharedGridEdgeCoordinate(4, 4, 'north')).toEqual({ axis: 'z', value: 4.5 });
    expect(sharedGridEdgeCoordinate(4, 4, 'east')).toEqual({ axis: 'x', value: 4.5 });
    expect(sharedGridEdgeCoordinate(4, 4, 'south')).toEqual({ axis: 'z', value: 3.5 });
    expect(sharedGridEdgeCoordinate(4, 4, 'west')).toEqual({ axis: 'x', value: 3.5 });
  });

  test('1x1 waterfall sits on child tile center with glue face on grid line', () => {
    const host = { x: 4, y: 4 };
    const child = neighborTileForHostFace(host.x, host.y, 'north');
    const edge = sharedGridEdgeCoordinate(host.x, host.y, 'north');

    const north = computeKenneyVerticalEdgeMountTransform(
      'north',
      child.x,
      child.y,
      'nature:cliff_waterfall_rock',
      0
    );

    expect(north.rotationX).toBe(0);
    expect(north.x).toBe(child.x);
    expect(north.z).toBe(child.y);
    expect(glueFaceWorldCoordinate('north', north.x, north.z)).toBe(edge.value);

    const eastChild = neighborTileForHostFace(host.x, host.y, 'east');
    const eastEdge = sharedGridEdgeCoordinate(host.x, host.y, 'east');
    const east = computeKenneyVerticalEdgeMountTransform(
      'east',
      eastChild.x,
      eastChild.y,
      'nature:cliff_waterfall_rock',
      0
    );

    expect(east.x).toBe(eastChild.x);
    expect(east.z).toBe(eastChild.y);
    expect(glueFaceWorldCoordinate('east', east.x, east.z)).toBe(eastEdge.value);
    expect(east.rotationY).toBe(-Math.PI / 2);
  });

  test('half cliff pivots group origin on the grid line', () => {
    const child = neighborTileForHostFace(4, 4, 'north');
    const north = computeKenneyVerticalEdgeMountTransform(
      'north',
      child.x,
      child.y,
      'nature:cliff_half_rock',
      0
    );

    expect(north.z).toBe(4.5);
    expect(north.x).toBe(child.x);
  });
});
