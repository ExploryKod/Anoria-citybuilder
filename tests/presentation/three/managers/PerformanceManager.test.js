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
    manager.updateFrustumCulling(false);
    manager.invalidateFrustumCache();
    manager.updateFrustumCulling(false);
    expect(zoneGroups[0].visible).toBe(true);
  });

  // Regression: a road placed into a zone, or a zoom with no camera movement, left the zone's
  // visibility stale until the camera moved a few units.
  test('a mesh added to a hidden zone shows at once, and a zoom re-runs the culling', () => {
    const manager = new PerformanceManager(scene, cameraWrapper, zoneGroups, []);
    manager.updateFrustumCulling(false);
    zoneGroups[0].visible = false;
    const road = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial());
    road.position.set(4, 0.22, 4);
    zoneGroups[0].add(road);
    expect(zoneGroups[0].visible).toBe(true);

    manager.updateFrustumCulling(false);
    expect(zoneGroups[0].visible).toBe(true);

    // Same camera position, but a projection so narrow that the zone is out of view.
    cameraWrapper.camera.fov = 0.01;
    cameraWrapper.camera.updateProjectionMatrix();
    manager.updateFrustumCulling(false);
    expect(zoneGroups[0].visible).toBe(false);
  });

  // The hover pick walks only the zones its ray crosses (it walked every mesh of the city at every frame).
  test('zonesAlongRay returns the zones the ray crosses, and a mesh added to a zone moves contentVersion', () => {
    const farZone = new THREE.Group();
    const farTile = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial());
    farTile.rotation.x = -Math.PI / 2;
    farTile.position.set(60, 0.22, 60);
    farZone.add(farTile);
    zoneGroups.push(farZone);
    scene.add(farZone);

    const manager = new PerformanceManager(scene, cameraWrapper, zoneGroups, []);
    const downAtTile = new THREE.Ray(new THREE.Vector3(4, 10, 4), new THREE.Vector3(0, -1, 0));
    expect(manager.zonesAlongRay(downAtTile)).toEqual([zoneGroups[0]]);

    const before = manager.contentVersion;
    zoneGroups[0].add(new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial()));
    expect(manager.contentVersion).toBe(before + 1);
  });

  test('keeps zones visible when terrain children are Groups', () => {
    const manager = new PerformanceManager(scene, cameraWrapper, zoneGroups, []);
    manager.updateFrustumCulling(false);
    expect(zoneGroups[0].visible).toBe(true);
  });
});
