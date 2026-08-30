import { describe, expect, test, beforeEach } from '@jest/globals';
import * as THREE from 'three';
import {
  clearSceneObjectFactories,
  createSceneTile,
  registerSceneObjectFactory,
} from '../../../../src/presentation/three/scene-board/SceneObjectRegistry.js';
import { attachSceneTilePort } from '../../../../src/presentation/three/scene-board/SceneTilePort.js';
import {
  applyRoadMaterialToTerrainTile,
  restoreGrassMaterialOnTerrainTile,
} from '../../../../src/presentation/three/scene-board/terrain/terrainSceneTileOps.js';

describe('SceneObjectRegistry terrain', () => {
  beforeEach(() => {
    clearSceneObjectFactories();
  });

  test('createSceneTile uses registered factory and attaches port', () => {
    registerSceneObjectFactory(
      (id) => id === 'grass',
      (_id, x, y) => {
        const root = new THREE.Group();
        return {
          root,
          x,
          y,
          layer: 'terrain',
          logicalId: 'grass',
          participatesInPick: true,
          getPickRoot: () => root,
          getBounds: () => new THREE.Box3(),
          getSurfaceMesh: () => null,
          setSurfaceMaterial: () => {},
          hasSurfaceMesh: () => false,
        };
      }
    );

    const port = attachSceneTilePort(createSceneTile('grass', 2, 3));
    expect(port.x).toBe(2);
    expect(port.y).toBe(3);
    expect(port.root.userData.sceneTilePort).toBe(port);
  });
});

describe('terrainSceneTileOps', () => {
  test('apply and restore road/grass materials through the port', () => {
    const root = new THREE.Group();
    const surface = new THREE.Mesh(new THREE.PlaneGeometry(1, 1));
    root.add(surface);
    const grassMat = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const roadMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });

    const port = attachSceneTilePort({
      root,
      x: 4,
      y: 5,
      layer: 'terrain',
      logicalId: 'grass',
      participatesInPick: true,
      getPickRoot: () => root,
      getBounds: () => new THREE.Box3(),
      getSurfaceMesh: () => surface,
      setSurfaceMaterial: (material) => {
        surface.material = material;
      },
      hasSurfaceMesh: () => true,
    });

    expect(applyRoadMaterialToTerrainTile(root, roadMat, { x: 4, y: 5, rotationStep: 1 })).toBe(true);
    expect(surface.material).toBe(roadMat);
    expect(root.userData.isRoad).toBe(true);

    expect(restoreGrassMaterialOnTerrainTile(root, grassMat, { x: 4, y: 5 })).toBe(true);
    expect(surface.material).toBe(grassMat);
    expect(root.userData.isRoad).toBe(false);
    expect(port.logicalId).toBe('grass');
  });
});
