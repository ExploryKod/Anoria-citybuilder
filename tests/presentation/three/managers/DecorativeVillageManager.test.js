import { describe, test, expect, jest } from '@jest/globals';
import * as THREE from 'three';
import { DecorativeVillageManager } from '../../../../src/presentation/three/managers/DecorativeVillageManager.js';
import { buildNeighborHamletDecoSpots } from '../../../../src/core/persistence/hamlet/neighborHamletDecoSpots.js';

describe('DecorativeVillageManager across a hamlet rebuild', () => {
  test('a village detached by scene.clear() is still freed on the next sync', () => {
    const scene = new THREE.Scene();
    const manager = new DecorativeVillageManager(scene, { createAsset: () => new THREE.Group() });
    const unlockedHamletIds = [...new Set(buildNeighborHamletDecoSpots(16).map((spot) => spot.hamletId))];

    manager.syncUnlockedNeighborHamlets(16, unlockedHamletIds);
    const village = scene.getObjectByName('decorative-village');
    expect(village).toBeDefined();

    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshBasicMaterial();
    village.add(new THREE.Mesh(geometry, material));
    const geometryDispose = jest.spyOn(geometry, 'dispose');
    const materialDispose = jest.spyOn(material, 'dispose');

    scene.clear();
    manager.syncUnlockedNeighborHamlets(16, []);

    expect(geometryDispose).toHaveBeenCalledTimes(1);
    expect(materialDispose).toHaveBeenCalledTimes(1);
  });
});
