import { describe, expect, test } from '@jest/globals';
import { KENNEY_GROUND_GRASS_COLOR } from '../../../../src/shared/terrain-catalog/terrainAtmosphere.js';
import * as THREE from 'three';
import { applyFlatTerrainMeshPresentation } from '../../../../src/presentation/three/adapters/kenney-nature-terrain/KenneyNatureTerrainLoader.js';

describe('KenneyNatureTerrainLoader presentation', () => {
  test('applyFlatTerrainMeshPresentation uses catalog color instead of GLB baseColor', () => {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshStandardMaterial({ color: 0x74ecdd })
    );

    applyFlatTerrainMeshPresentation(mesh, 'nature:ground_grass');

    expect(mesh.material.color.getHex()).toBe(KENNEY_GROUND_GRASS_COLOR);
  });
});
