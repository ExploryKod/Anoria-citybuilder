/**
 * @jest-environment jsdom
 */

import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import * as THREE from 'three';

jest.unstable_mockModule('three/addons/loaders/GLTFLoader.js', () => {
  class GLTFLoader {
    load(_url, onLoad) {
      const root = new THREE.Group();
      // Approx. native sky-day-dome: hemisphere radius ~2.6, base at y≈0
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(2.6, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2),
        new THREE.MeshStandardMaterial()
      );
      root.add(mesh);
      onLoad({ scene: root });
    }
  }
  return { GLTFLoader };
});

const { BackdropManager } = await import(
  '../../../../src/presentation/three/managers/BackdropManager.js'
);

describe('BackdropManager sky dome', () => {
  /** @type {THREE.Scene} */
  let scene;
  /** @type {InstanceType<typeof BackdropManager>} */
  let manager;

  beforeEach(() => {
    scene = new THREE.Scene();
    manager = new BackdropManager(scene);
  });

  test('initializeSky attaches an unlit sky-dome that syncs to the camera', async () => {
    await manager.initializeSky();

    const dome = scene.getObjectByName('sky-dome');
    expect(dome).toBeTruthy();
    expect(manager.skyDome).toBe(dome);
    expect(scene.background).toBeInstanceOf(THREE.Color);

    let sawBasic = false;
    dome.traverse((child) => {
      if (!child.isMesh) return;
      expect(child.material).toBeInstanceOf(THREE.MeshBasicMaterial);
      expect(child.material.side).toBe(THREE.BackSide);
      expect(child.material.fog).toBe(false);
      expect(child.material.depthWrite).toBe(false);
      expect(child.castShadow).toBe(false);
      sawBasic = true;
    });
    expect(sawBasic).toBe(true);

    const camera = new THREE.PerspectiveCamera();
    camera.position.set(10, 20, 30);
    manager.syncSkyToCamera(camera);
    expect(dome.position.x).toBe(10);
    expect(dome.position.z).toBe(30);
    expect(dome.position.y).toBeLessThan(20);
  });

  test('detachSky removes the live instance but keeps the template for reload', async () => {
    await manager.initializeSky();
    expect(scene.getObjectByName('sky-dome')).toBeTruthy();

    manager.detachSky();
    expect(scene.getObjectByName('sky-dome')).toBeFalsy();
    expect(manager.skyDome).toBeNull();

    await manager.initializeSky();
    expect(scene.getObjectByName('sky-dome')).toBeTruthy();
  });
});
