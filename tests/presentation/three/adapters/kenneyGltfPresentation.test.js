import { describe, expect, test } from '@jest/globals';
import * as THREE from 'three';
import {
  applyEditorKenneyGltfPresentation,
  applyLitKenneyGltfPresentation,
  resolveKenneyGltfPresentationMode,
} from '../../../../src/presentation/three/adapters/kenney-nature/kenneyGltfPresentation.js';

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
    expect(mesh.castShadow).toBe(false);
    expect(mesh.receiveShadow).toBe(false);
    expect(mesh.renderOrder).toBe(5);
  });

  test('converts GLB materials to lit Lambert with shadows on props', () => {
    const root = new THREE.Group();
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: 0x448844 })
    );
    root.add(mesh);

    applyLitKenneyGltfPresentation(root, { renderOrder: 5, role: 'prop' });

    expect(mesh.material).toBeInstanceOf(THREE.MeshLambertMaterial);
    expect(mesh.material.color.getHex()).toBe(0x448844);
    expect(mesh.castShadow).toBe(true);
    expect(mesh.receiveShadow).toBe(true);
    expect(mesh.renderOrder).toBe(5);
  });

  test('lit terrain receives shadows but does not cast them', () => {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: 0x886644 })
    );

    applyLitKenneyGltfPresentation(mesh, { role: 'terrain' });

    expect(mesh.material).toBeInstanceOf(THREE.MeshLambertMaterial);
    expect(mesh.castShadow).toBe(false);
    expect(mesh.receiveShadow).toBe(true);
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

  test('3D scene always uses lit presentation (carousel uses PNGs)', () => {
    expect(resolveKenneyGltfPresentationMode()).toBe('lit');
  });
});
