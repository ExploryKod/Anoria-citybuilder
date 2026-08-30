import { describe, expect, test } from '@jest/globals';
import * as THREE from 'three';
import { applyEditorKenneyGltfPresentation } from '../../../../src/presentation/three/adapters/kenney-nature/kenneyGltfPresentation.js';

describe('kenneyGltfPresentation', () => {
  test('converts lit GLB materials to unlit editor presentation', () => {
    const root = new THREE.Group();
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: 0x72d3d5 })
    );
    root.add(mesh);

    applyEditorKenneyGltfPresentation(root, { renderOrder: 5 });

    expect(mesh.material).toBeInstanceOf(THREE.MeshBasicMaterial);
    expect(mesh.material.color.getHex()).toBe(0x72d3d5);
    expect(mesh.material.fog).toBe(false);
    expect(mesh.material.toneMapped).toBe(false);
    expect(mesh.renderOrder).toBe(5);
  });

  test('preserves existing MeshBasicMaterial colors while disabling fog', () => {
    const root = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial({ color: 0xe7b5a3, fog: true, toneMapped: true })
    );

    applyEditorKenneyGltfPresentation(root);

    expect(root.material).toBeInstanceOf(THREE.MeshBasicMaterial);
    expect(root.material.color.getHex()).toBe(0xe7b5a3);
    expect(root.material.fog).toBe(false);
    expect(root.material.toneMapped).toBe(false);
  });
});
