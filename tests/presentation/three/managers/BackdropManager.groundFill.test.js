/**
 * @jest-environment jsdom
 */

import { describe, test, expect, jest } from '@jest/globals';
import * as THREE from 'three';
import { BackdropManager } from '../../../../src/presentation/three/managers/BackdropManager.js';

describe('BackdropManager ground fill across a hamlet rebuild', () => {
  test('the previous ground plane geometry is freed when scene.clear() detached it', () => {
    const scene = new THREE.Scene();
    const backdrop = new BackdropManager(scene);
    backdrop.syncGroundFill(16);

    const previous = scene.getObjectByName('kenney-ground-fill');
    const previousGeometryDispose = jest.spyOn(previous.geometry, 'dispose');

    scene.clear();
    backdrop.syncGroundFill(16);

    expect(previousGeometryDispose).toHaveBeenCalledTimes(1);
    const grounds = scene.children.filter((child) => child.name === 'kenney-ground-fill');
    expect(grounds).toHaveLength(1);
    expect(grounds[0]).not.toBe(previous);
  });

  test('syncing twice without a clear keeps one ground plane and frees the replaced geometry', () => {
    const scene = new THREE.Scene();
    const backdrop = new BackdropManager(scene);
    backdrop.syncGroundFill(16);

    const ground = scene.getObjectByName('kenney-ground-fill');
    const firstGeometry = ground.geometry;
    const firstGeometryDispose = jest.spyOn(firstGeometry, 'dispose');

    backdrop.syncGroundFill(20);

    expect(firstGeometryDispose).toHaveBeenCalledTimes(1);
    expect(scene.children.filter((child) => child.name === 'kenney-ground-fill')).toHaveLength(1);
  });
});
