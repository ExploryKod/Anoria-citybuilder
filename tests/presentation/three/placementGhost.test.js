/**
 * @jest-environment jsdom
 */

import { describe, expect, test, jest, beforeEach } from '@jest/globals';
import * as THREE from 'three';

jest.unstable_mockModule(
  '../../../src/presentation/three/adapters/kenney-city-kit/kenneyCityKitConfig.js',
  () => ({
    isKenneyBuildingId: (id) => id === 'kenney:test-house',
    KENNEY_CITY_KIT_PLATFORM_HEIGHT: 0.2,
  })
);

jest.unstable_mockModule(
  '../../../src/presentation/three/adapters/kenney-city-kit/KenneyCityKitMeshAdapter.js',
  () => ({
    getKenneyCityKitMeshAdapter: () => ({
      createBuilding: async (x, y) => {
        const group = new THREE.Group();
        group.position.set(x, 0.2, y);
        return group;
      },
    }),
  })
);

const { createPlacementGhostController } = await import(
  '../../../src/presentation/three/placementGhost.js'
);

describe('placementGhost', () => {
  /** @type {THREE.Scene} */
  let scene;
  /** @type {ReturnType<typeof createPlacementGhostController>} */
  let controller;

  beforeEach(() => {
    scene = new THREE.Scene();
    controller = createPlacementGhostController({
      scene,
      assetManager: {
        createAsset: () => null,
      },
    });
  });

  test('moves Kenney ghost mesh when hover tile changes', async () => {
    controller.show('kenney:test-house', 2, 3, true, { gridSize: 1 });
    await Promise.resolve();

    const ghost = scene.children.find((child) => child.name === 'placement-ghost');
    expect(ghost).toBeTruthy();
    expect(ghost.position.x).toBe(2);
    expect(ghost.position.z).toBe(3);

    controller.show('kenney:test-house', 5, 7, true, { gridSize: 1 });
    expect(ghost.position.x).toBe(5);
    expect(ghost.position.z).toBe(7);
    expect(scene.children).toHaveLength(1);
  });
});
