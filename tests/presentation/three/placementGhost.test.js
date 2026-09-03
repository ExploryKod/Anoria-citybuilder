/**
 * @jest-environment jsdom
 */

import { describe, expect, test, jest, beforeEach } from '@jest/globals';
import * as THREE from 'three';

jest.unstable_mockModule(
  '../../../src/presentation/three/adapters/kenney-city-kit/kenneyCityKitConfig.js',
  () => ({
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

jest.unstable_mockModule(
  '../../../src/shared/editor-catalog/editorToolIds.js',
  () => ({
    isEditorTerrainTool: (id) => id === 'nature:ground_grass',
    isEditorNatureTool: (id) => id === 'nature-prop:tree_cone_dark',
    isEditorPlacementTool: (id) =>
      id === 'nature:ground_grass' || id === 'nature-prop:tree_cone_dark',
  })
);

jest.unstable_mockModule(
  '../../../src/presentation/three/adapters/kenney-nature-terrain/KenneyNatureTerrainAdapter.js',
  () => ({
    getKenneyNatureTerrainAdapter: () => ({
      ensureTerrainTemplate: async () => {},
    }),
  })
);

jest.unstable_mockModule(
  '../../../src/presentation/three/adapters/kenney-nature-props/KenneyNaturePropAdapter.js',
  () => ({
    getKenneyNaturePropAdapter: () => ({
      ensurePropLoaded: async () => {},
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
    // House-Blue is villageTown-labelled but catalog-reassigned to a Kenney
    // mesh (buildingAssets.js) — this is the exact case that must take the
    // Kenney branch by catalog `source`, not by an id-prefix guess.
    controller.show('House-Blue', 2, 3, true, { gridSize: 1 });
    await Promise.resolve();

    const ghost = scene.children.find((child) => child.name === 'placement-ghost');
    expect(ghost).toBeTruthy();
    expect(ghost.position.x).toBe(2);
    expect(ghost.position.z).toBe(3);

    controller.show('House-Blue', 5, 7, true, { gridSize: 1 });
    expect(ghost.position.x).toBe(5);
    expect(ghost.position.z).toBe(7);
    expect(scene.children).toHaveLength(1);
  });

  test('rotateStep only applies when the ghost is visible', () => {
    const syncController = createPlacementGhostController({
      scene,
      assetManager: {
        createAsset: () => new THREE.Group(),
      },
    });

    expect(syncController.rotationStep).toBe(0);
    syncController.rotateStep();
    expect(syncController.rotationStep).toBe(0);

    // Farm-Wheat stays villageTown-sourced (House-Blue/Red/Purple are all
    // reassigned to Kenney now) — the synchronous createAsset path, not the
    // async Kenney adapter.
    syncController.show('Farm-Wheat', 2, 3, true, { gridSize: 1 });
    syncController.rotateStep();
    expect(syncController.rotationStep).toBe(1);
  });

  test('shows editor terrain ghost after async template load without respawn cancelling it', async () => {
    let createCalls = 0;
    const editorController = createPlacementGhostController({
      scene,
      assetManager: {
        createAsset: () => {
          createCalls += 1;
          const group = new THREE.Group();
          group.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)));
          return group;
        },
      },
    });

    editorController.show('nature:ground_grass', 4, 5, true, { gridSize: 1 });
    editorController.show('nature:ground_grass', 4, 5, true, { gridSize: 1 });
    editorController.show('nature:ground_grass', 6, 7, true, { gridSize: 1 });

    await Promise.resolve();
    await Promise.resolve();

    const ghost = scene.children.find((child) => child.name === 'placement-ghost');
    expect(ghost).toBeTruthy();
    expect(createCalls).toBe(1);
    expect(ghost.position.x).toBe(6);
    expect(ghost.position.z).toBe(7);
  });

  test('shows editor nature prop ghost after async template load', async () => {
    const editorController = createPlacementGhostController({
      scene,
      assetManager: {
        createAsset: () => {
          const group = new THREE.Group();
          group.add(new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1)));
          return group;
        },
      },
    });

    editorController.show('nature-prop:tree_cone_dark', 1, 2, true, { gridSize: 1 });
    await Promise.resolve();
    await Promise.resolve();

    const ghost = scene.children.find((child) => child.name === 'placement-ghost');
    expect(ghost).toBeTruthy();
  });
});
