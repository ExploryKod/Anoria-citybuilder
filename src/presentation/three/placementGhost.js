import * as THREE from 'three';
import { setPlacementRotationStep } from './placementRotation.js';

/**
 * Semi-transparent placement preview (ghost) that follows the cursor tile.
 * Visual only — no city / Dexie / placement rules.
 */

const GHOST_VALID = new THREE.Color(0x2ecc71);
const GHOST_INVALID = new THREE.Color(0xe74c3c);
const GHOST_ANCHORED = new THREE.Color(0x7c3aed);

/**
 * Flat tinted materials (no texture map) so valid/invalid is obvious on GLTF meshes.
 * @param {boolean} valid
 * @param {'hover' | 'anchored'} [mode]
 * @returns {THREE.MeshBasicMaterial}
 */
function createGhostMaterial(valid, mode = 'hover') {
  const anchored = mode === 'anchored';
  const color = anchored ? GHOST_ANCHORED : valid ? GHOST_VALID : GHOST_INVALID;
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: anchored ? 0.52 : valid ? 0.55 : 0.65,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
}

/**
 * @param {THREE.Object3D} root
 * @param {{ valid?: boolean, mode?: 'hover' | 'anchored' }} [options]
 */
export function applyGhostAppearance(root, { valid = true, mode = 'hover' } = {}) {
  if (!root) return;

  root.traverse((obj) => {
    if (!(obj instanceof THREE.Mesh)) return;

    obj.raycast = () => {};
    obj.castShadow = false;
    obj.receiveShadow = false;
    obj.userData = {
      ...(obj.userData || {}),
      isPlacementGhost: true,
      nonInteractive: true,
    };

    const count = Array.isArray(obj.material) ? obj.material.length : 1;
    const ghostMats = Array.from({ length: count }, () => createGhostMaterial(valid, mode));
    obj.material = count > 1 ? ghostMats : ghostMats[0];
  });

  root.name = 'placement-ghost';
  root.userData = {
    ...(root.userData || {}),
    isPlacementGhost: true,
    nonInteractive: true,
    ghostMode: mode,
  };
}

/**
 * @param {object} params
 * @param {import('three').Scene} params.scene
 * @param {{ createAsset: Function }} params.assetManager
 */
export function createPlacementGhostController({ scene, assetManager }) {
  /** @type {THREE.Object3D | null} */
  let ghost = null;
  let currentAssetId = null;
  let lastX = null;
  let lastY = null;
  let lastValid = true;
  let lastGridSize = 1;
  let isAnchored = false;
  let baseRotationY = 0;
  let rotationStep = 0;
  let ghostMode = 'hover';

  function disposeGhost() {
    if (!ghost) return;
    scene.remove(ghost);
    ghost.traverse((obj) => {
      if (obj instanceof THREE.Mesh) {
        const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
        mats.forEach((m) => m?.dispose?.());
      }
    });
    ghost = null;
    currentAssetId = null;
    isAnchored = false;
    baseRotationY = 0;
    rotationStep = 0;
    ghostMode = 'hover';
  }

  function setTilePosition(mesh, x, y, gridSize = 1) {
    const worldPlatformHeight = 0.2;
    const centerOffset = (gridSize - 1) / 2;
    mesh.position.set(x + centerOffset, worldPlatformHeight + 0.04, y + centerOffset);
    if (mesh.userData) {
      mesh.userData.x = x;
      mesh.userData.y = y;
      mesh.userData.gridSize = gridSize;
    }
  }

  function spawn(assetId, x, y, valid, mode = 'hover', gridSize = 1) {
    disposeGhost();

    const mesh = assetManager.createAsset(assetId, x, y);
    if (!mesh) return;

    applyGhostAppearance(mesh, { valid, mode });
    setTilePosition(mesh, x, y, gridSize);
    mesh.renderOrder = 999;
    scene.add(mesh);

    ghost = mesh;
    currentAssetId = assetId;
    lastX = x;
    lastY = y;
    lastValid = valid;
    lastGridSize = gridSize;
    isAnchored = mode === 'anchored';
    ghostMode = mode;
    baseRotationY = mesh.rotation.y;
    rotationStep = 0;
  }

  /**
   * @param {string} assetId
   * @param {number} x
   * @param {number} y
   * @param {boolean} [valid]
   * @param {{ mode?: 'hover' | 'anchored', gridSize?: number }} [options]
   */
  function show(assetId, x, y, valid = true, options = {}) {
    if (!assetId || typeof x !== 'number' || typeof y !== 'number') {
      return;
    }

    const mode = options.mode ?? 'hover';
    const gridSize = options.gridSize ?? 1;

    if (isAnchored) {
      return;
    }

    if (
      ghost
      && currentAssetId === assetId
      && lastX === x
      && lastY === y
      && lastValid === valid
      && ghostMode === mode
      && lastGridSize === gridSize
    ) {
      return;
    }

    if (!ghost || currentAssetId !== assetId || lastValid !== valid || ghostMode !== mode || lastGridSize !== gridSize) {
      spawn(assetId, x, y, valid, mode, gridSize);
      return;
    }

    setTilePosition(ghost, x, y, gridSize);
    lastX = x;
    lastY = y;
    lastGridSize = gridSize;
  }

  /**
   * Lock ghost on tile for rotation step (touch flow).
   */
  function anchor(assetId, x, y, valid = true, gridSize = 1) {
    spawn(assetId, x, y, valid, 'anchored', gridSize);
  }

  /**
   * @param {number} step 0–3
   */
  function setRotationStep(step) {
    if (!ghost) return;
    rotationStep = ((step % 4) + 4) % 4;
    setPlacementRotationStep(ghost, baseRotationY, rotationStep);
  }

  function rotateStep() {
    setRotationStep(rotationStep + 1);
    return rotationStep;
  }

  function clear() {
    disposeGhost();
    lastX = null;
    lastY = null;
    lastValid = true;
    lastGridSize = 1;
  }

  return {
    show,
    anchor,
    setRotationStep,
    rotateStep,
    clear,
    get active() {
      return Boolean(ghost);
    },
    get anchored() {
      return isAnchored;
    },
    get rotationStep() {
      return rotationStep;
    },
    get tile() {
      return lastX == null || lastY == null ? null : { x: lastX, y: lastY, gridSize: lastGridSize };
    },
  };
}
