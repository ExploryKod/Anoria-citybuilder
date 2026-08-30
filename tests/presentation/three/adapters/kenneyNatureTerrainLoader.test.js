import { describe, expect, test } from '@jest/globals';
import * as THREE from 'three';
import { applyTerrainMeshPresentation } from '../../../../src/presentation/three/adapters/kenney-nature-terrain/KenneyNatureTerrainLoader.js';

describe('KenneyNatureTerrainLoader presentation', () => {
  test('applyTerrainMeshPresentation uses catalog color instead of GLB baseColor', () => {
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshStandardMaterial({ color: 0x74ecdd })
    );

    applyTerrainMeshPresentation(mesh, 'nature:ground_grass');

    expect(mesh.material.color.getHex()).toBe(0x2fe7c5);
  });
});
