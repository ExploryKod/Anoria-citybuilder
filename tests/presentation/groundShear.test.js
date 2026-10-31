/**
 * A road on a slope is sheared, not turned: its two ends must stay at the edges of the tile, at the height of the neighbouring roads (a turned plate leaves a
 * groove at both ends).
 */
import { describe, test, expect } from '@jest/globals';
import * as THREE from 'three';
import { applyGroundShear } from '../../src/presentation/three/placement/groundShear.js';

describe('a road laid on a slope', () => {
  test('keeps its whole span: one end at the low edge, the other at the high edge', () => {
    const road = new THREE.Mesh(new THREE.BoxGeometry(1, 0.02, 1));
    road.position.set(4, 0.7, 6);
    // Rises toward +z (the neighbour at y + 1) by 1.0
    applyGroundShear(road, { dx: 0, dy: 1, rise: 1 });
    road.updateMatrixWorld(true);

    const edge = (z) => new THREE.Vector3(0, 0, z).applyMatrix4(road.matrixWorld);
    const low = edge(-0.5);
    const high = edge(0.5);
    expect(high.z - low.z).toBeCloseTo(1, 6);
    expect(high.y - low.y).toBeCloseTo(1, 6);
    // Its middle stays where it was put (halfway up the slope)
    expect(edge(0).y).toBeCloseTo(0.7, 6);
    // Across the slope nothing moves: the width does not change
    expect(new THREE.Vector3(0.5, 0, 0).applyMatrix4(road.matrixWorld).y).toBeCloseTo(0.7, 6);
  });

  test('on flat ground the mesh is moved as usual again', () => {
    const road = new THREE.Mesh(new THREE.BoxGeometry(1, 0.02, 1));
    applyGroundShear(road, { dx: 1, dy: 0, rise: 0.5 });
    expect(road.matrixAutoUpdate).toBe(false);
    applyGroundShear(road, null);
    expect(road.matrixAutoUpdate).toBe(true);
  });
});
