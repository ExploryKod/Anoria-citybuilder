import { describe, expect, test } from '@jest/globals';
import * as THREE from 'three';
import {
  pickTileFromRaycast,
  resolveTileRaycastTarget,
} from '../../../src/presentation/three/scene-board/tileRaycast.js';
import { attachSceneTilePort } from '../../../src/presentation/three/scene-board/SceneTilePort.js';

describe('tileRaycast', () => {
  test('resolveTileRaycastTarget walks up to the tile Group', () => {
    const tile = new THREE.Group();
    const port = attachSceneTilePort({
      root: tile,
      x: 3,
      y: 7,
      layer: 'terrain',
      logicalId: 'grass',
      participatesInPick: true,
      getPickRoot: () => tile,
      getBounds: () => new THREE.Box3(),
      getSurfaceMesh: () => null,
      setSurfaceMaterial: () => {},
      hasSurfaceMesh: () => false,
    });
    const surface = new THREE.Mesh(new THREE.PlaneGeometry(1, 1));
    tile.add(surface);

    expect(resolveTileRaycastTarget(surface)).toBe(tile);
    expect(port.getPickRoot()).toBe(tile);
  });

  test('resolveTileRaycastTarget returns null without tile userData', () => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1));
    expect(resolveTileRaycastTarget(mesh)).toBeNull();
  });

  test('pickTileFromRaycast hits meshes inside invisible zone groups', () => {
    const zoneGroup = new THREE.Group();
    zoneGroup.visible = false;

    const tile = new THREE.Group();
    attachSceneTilePort({
      root: tile,
      x: 2,
      y: 4,
      layer: 'terrain',
      logicalId: 'grass',
      participatesInPick: true,
      getPickRoot: () => tile,
      getBounds: () => new THREE.Box3(),
      getSurfaceMesh: () => null,
      setSurfaceMaterial: () => {},
      hasSurfaceMesh: () => false,
    });

    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial()
    );
    mesh.rotation.x = -Math.PI / 2;
    tile.add(mesh);
    tile.position.set(2, 0, 4);
    zoneGroup.add(tile);
    zoneGroup.updateMatrixWorld(true);

    const raycaster = new THREE.Raycaster();
    raycaster.set(new THREE.Vector3(2, 10, 4), new THREE.Vector3(0, -1, 0));

    expect(pickTileFromRaycast(raycaster, [tile])).toBe(tile);
  });
});
