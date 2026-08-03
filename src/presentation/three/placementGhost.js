import * as THREE from 'three';
import { isRoadBuildingType } from '../../contexts/construction/domain/policies/FootprintAvailabilityPolicy.js';

/**
 * Semi-transparent placement preview (ghost) that follows the cursor tile.
 * Does not write to city.tiles / Dexie — visual only.
 */

const GHOST_VALID = new THREE.Color(0x2ecc71);
const GHOST_INVALID = new THREE.Color(0xe74c3c);

/**
 * Flat tinted materials (no texture map) so valid/invalid is obvious on GLTF roads.
 * @param {boolean} valid
 * @returns {THREE.MeshBasicMaterial}
 */
function createGhostMaterial(valid) {
  return new THREE.MeshBasicMaterial({
    color: valid ? GHOST_VALID : GHOST_INVALID,
    transparent: true,
    opacity: valid ? 0.55 : 0.65,
    depthWrite: false,
    // Slight lift over terrain so the tint reads clearly
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
}

/**
 * @param {THREE.Object3D} root
 * @param {{ valid?: boolean }} [options]
 */
export function applyGhostAppearance(root, { valid = true } = {}) {
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
    const ghostMats = Array.from({ length: count }, () => createGhostMaterial(valid));
    obj.material = count > 1 ? ghostMats : ghostMats[0];
  });

  root.name = 'placement-ghost';
  root.userData = {
    ...(root.userData || {}),
    isPlacementGhost: true,
    nonInteractive: true,
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
  }

  function setTilePosition(mesh, x, y) {
    const worldPlatformHeight = 0.2;
    // Slightly above real roads so tint isn't lost to z-fighting
    mesh.position.set(x, worldPlatformHeight + 0.04, y);
    if (mesh.userData) {
      mesh.userData.x = x;
      mesh.userData.y = y;
    }
  }

  function spawn(assetId, x, y, valid) {
    disposeGhost();

    const mesh = assetManager.createAsset(assetId, x, y);
    if (!mesh) return;

    applyGhostAppearance(mesh, { valid });
    setTilePosition(mesh, x, y);
    mesh.renderOrder = 999;
    scene.add(mesh);

    ghost = mesh;
    currentAssetId = assetId;
    lastX = x;
    lastY = y;
    lastValid = valid;
  }

  /**
   * Show or refresh ghost for a tool + tile.
   * @param {string} assetId
   * @param {number} x
   * @param {number} y
   * @param {boolean} [valid]
   */
  function show(assetId, x, y, valid = true) {
    if (!assetId || typeof x !== 'number' || typeof y !== 'number') {
      return;
    }

    if (ghost && currentAssetId === assetId && lastX === x && lastY === y && lastValid === valid) {
      return;
    }

    // Validity or orientation change → recreate (materials / rotation)
    if (!ghost || currentAssetId !== assetId || lastValid !== valid) {
      spawn(assetId, x, y, valid);
      return;
    }

    setTilePosition(ghost, x, y);
    lastX = x;
    lastY = y;
  }

  /**
   * @param {number} x
   * @param {number} y
   * @param {boolean} [valid]
   */
  function move(x, y, valid = true) {
    if (typeof x !== 'number' || typeof y !== 'number' || !currentAssetId) return;
    show(currentAssetId, x, y, valid);
  }

  /**
   * Swap orientation / asset while keeping tile.
   * @param {string} assetId
   * @param {boolean} [valid]
   */
  function setAsset(assetId, valid = lastValid) {
    if (!assetId) return;
    if (lastX == null || lastY == null) {
      currentAssetId = assetId;
      return;
    }
    show(assetId, lastX, lastY, valid);
  }

  function clear() {
    disposeGhost();
    lastX = null;
    lastY = null;
    lastValid = true;
  }

  /**
   * @param {object|null|undefined} city
   * @param {number} x
   * @param {number} y
   */
  function isValidRoadPlacement(city, x, y) {
    const tile = city?.tiles?.[x]?.[y];
    if (!tile) return false;
    return !tile.buildingId || isRoadBuildingType(tile.buildingId);
  }

  return {
    show,
    move,
    setAsset,
    clear,
    isValidRoadPlacement,
    get active() {
      return Boolean(ghost);
    },
    get tile() {
      return lastX == null || lastY == null ? null : { x: lastX, y: lastY };
    },
  };
}
