/**
 * @jest-environment jsdom
 */

import { describe, test, expect, beforeEach } from '@jest/globals';
import * as THREE from 'three';
import {
  GAME_MODES,
  clearGameMode,
  setGameMode,
} from '../../../../src/shared/gameplay/gameMode.js';
import {
  KENNEY_GROUND_GRASS_COLOR,
  SCENE_SEA_COLOR,
} from '../../../../src/shared/terrain-catalog/terrainAtmosphere.js';

const { BackdropManager } = await import(
  '../../../../src/presentation/three/managers/BackdropManager.js'
);

describe('BackdropManager', () => {
  /** @type {THREE.Scene} */
  let scene;
  /** @type {InstanceType<typeof BackdropManager>} */
  let manager;

  beforeEach(() => {
    clearGameMode();
    scene = new THREE.Scene();
    manager = new BackdropManager(scene);
  });

  test('applyAtmosphere sets background and fog', () => {
    manager.applyAtmosphere();
    expect(scene.background).toBeInstanceOf(THREE.Color);
    expect(scene.fog).toBeTruthy();
    expect(scene.getObjectByName('sky-dome')).toBeFalsy();
  });

  test('uses sea ground fill in editor mode', () => {
    setGameMode(GAME_MODES.EDITOR);
    manager.syncGroundFill(16);
    const groundFill = scene.getObjectByName('kenney-ground-fill');
    expect(groundFill).toBeTruthy();
    expect(groundFill.material.color.getHex()).toBe(SCENE_SEA_COLOR);
  });

  test('uses grass ground fill in gameplay mode', () => {
    manager.syncGroundFill(16);
    const groundFill = scene.getObjectByName('kenney-ground-fill');
    expect(groundFill.material.color.getHex()).toBe(KENNEY_GROUND_GRASS_COLOR);
  });
});
