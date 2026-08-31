/**
 * @jest-environment jsdom
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import * as THREE from 'three';

const { PerformanceManager } = await import(
  '../../../../src/presentation/three/managers/PerformanceManager.js'
);

describe('PerformanceManager zone frustum culling', () => {
  /** @type {THREE.Scene} */
  let scene;
  /** @type {{ camera: THREE.PerspectiveCamera }} */
  let cameraWrapper;
  /** @type {THREE.Group[]} */
  let zoneGroups;

  beforeEach(() => {
    scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 1000);
    camera.position.set(8, 20, 8);
    camera.lookAt(8, 0, 8);
    camera.updateMatrixWorld(true);
    cameraWrapper = { camera };

    const zoneGroup = new THREE.Group();
    const terrainTile = new THREE.Group();
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial()
    );
    mesh.rotation.x = -Math.PI / 2;
    terrainTile.add(mesh);
    terrainTile.position.set(4, 0.22, 4);
    zoneGroup.add(terrainTile);
    zoneGroups = [zoneGroup];
    scene.add(zoneGroup);
  });

  test('editor mode keeps non-empty zones visible without frustum hiding', () => {
    zoneGroups[0].visible = false;
    const manager = new PerformanceManager(scene, cameraWrapper, zoneGroups, []);
    manager.updateFrustumCulling(true);
    expect(zoneGroups[0].visible).toBe(true);
  });

  test('invalidateFrustumCache forces next culling pass', () => {
    const manager = new PerformanceManager(scene, cameraWrapper, zoneGroups, []);
    manager.lastFrustumUpdateCameraPosition.copy(cameraWrapper.camera.position);
    manager.invalidateFrustumCache();
    manager.updateFrustumCulling(false);
    expect(zoneGroups[0].visible).toBe(true);
  });

  test('keeps zones visible when terrain children are Groups', () => {
    const manager = new PerformanceManager(scene, cameraWrapper, zoneGroups, []);
    manager.updateFrustumCulling(false);
    expect(zoneGroups[0].visible).toBe(true);
  });
});
