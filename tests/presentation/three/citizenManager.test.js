/**
 * @jest-environment jsdom
 */
import { describe, expect, test, jest } from '@jest/globals';
import * as THREE from 'three';

const loaded = [];
jest.unstable_mockModule('three/addons/loaders/GLTFLoader.js', () => ({
  GLTFLoader: class {
    load(url, onLoad) {
      loaded.push(url);
      const scene = new THREE.Group();
      scene.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial()));
      const animations = [new THREE.AnimationClip('static', 1, []), new THREE.AnimationClip('idle', 1, []), new THREE.AnimationClip('walk', 1, [])];
      onLoad({ scene, animations });
    }
  },
}));

const { CitizenManager } = await import('../../../src/presentation/three/managers/CitizenManager.js');
const { WALKER_ASSETS, WALKER_TYPES } = await import('../../../src/presentation/three/assets/walkerAssets.js');

describe('CitizenManager (catalog-driven walkers)', () => {
  test('creates a walker from the walker type: model, height, size and animations come from the catalog', async () => {
    loaded.length = 0;
    const manager = new CitizenManager(new THREE.Scene(), {});
    const citizen = await manager.createCitizenInstance('citizen');

    const expectedId = WALKER_TYPES.citizen.appearances[0];
    const asset = WALKER_ASSETS[expectedId];
    expect(citizen.appearanceId).toBe(expectedId);
    expect(loaded[0]).toContain(encodeURI(asset.geometry.glb.split('/').pop()));
    expect(citizen.groundY).toBeCloseTo(0.2 + asset.transform.positionOffsetY);
    expect(citizen.character.scale.x).toBeCloseTo(asset.transform.scale);
    expect(Object.keys(citizen.animations)).toEqual(['static', 'idle', 'walk']);
    // Starts idle, and the role → clip mapping comes from the catalog.
    expect(manager.pickAnimationName(citizen, 'idle')).toBe('idle');
    expect(manager.pickAnimationName(citizen, 'walk')).toBe('walk');
    expect(citizen.currentAction).toBeTruthy();
  });

  test('successive walkers of a type rotate through its pool (and reset() restarts it)', async () => {
    const manager = new CitizenManager(new THREE.Scene(), {});
    const pool = WALKER_TYPES.citizen.appearances;
    const ids = [];
    for (let i = 0; i < pool.length + 1; i += 1) {
      ids.push((await manager.createCitizenInstance('citizen')).appearanceId);
    }
    expect(ids).toEqual([...pool, pool[0]]);

    manager.reset();
    expect((await manager.createCitizenInstance('citizen')).appearanceId).toBe(pool[0]);
  });

  test('each visual is fetched once, however many walkers use it', async () => {
    loaded.length = 0;
    const manager = new CitizenManager(new THREE.Scene(), {});
    const pool = WALKER_TYPES.citizen.appearances;
    for (let i = 0; i < pool.length * 3; i += 1) {
      await manager.createCitizenInstance('citizen');
    }
    expect(loaded).toHaveLength(pool.length);
  });

  test('an unknown walker type resolves null instead of throwing', async () => {
    const manager = new CitizenManager(new THREE.Scene(), {});
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(manager.createCitizenInstance('dragon')).resolves.toBeNull();
    errorSpy.mockRestore();
  });
});
