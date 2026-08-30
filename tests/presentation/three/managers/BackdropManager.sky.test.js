/**
 * @jest-environment jsdom
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import * as THREE from 'three';

const { BackdropManager } = await import(
  '../../../../src/presentation/three/managers/BackdropManager.js'
);

describe('BackdropManager', () => {
  /** @type {THREE.Scene} */
  let scene;
  /** @type {InstanceType<typeof BackdropManager>} */
  let manager;

  beforeEach(() => {
    scene = new THREE.Scene();
    manager = new BackdropManager(scene);
  });

  test('applyAtmosphere sets background and fog', () => {
    manager.applyAtmosphere();
    expect(scene.background).toBeInstanceOf(THREE.Color);
    expect(scene.fog).toBeTruthy();
    expect(scene.getObjectByName('sky-dome')).toBeFalsy();
  });
});
