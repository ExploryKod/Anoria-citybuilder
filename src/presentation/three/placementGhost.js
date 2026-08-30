import * as THREE from 'three';
import { getPlacementYawAngle, setPlacementRotationStep } from './placementRotation.js';
import {
  isKenneyBuildingId,
  KENNEY_CITY_KIT_PLATFORM_HEIGHT,
} from './adapters/kenney-city-kit/kenneyCityKitConfig.js';
import { getKenneyCityKitMeshAdapter } from './adapters/kenney-city-kit/KenneyCityKitMeshAdapter.js';

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
 * @param {THREE.Object3D} root
 */
function disposeGhostMaterials(root) {
  root.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach((m) => m?.dispose?.());
    }
  });
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
  let lastFootprintWidth = 1;
  let lastFootprintHeight = 1;
  let lastRotationStep = 0;
  let isAnchored = false;
  /** Authored yaw on the correct Euler axis (Y upright / Z tipped). */
  let baseYawAngle = 0;
  let rotationStep = 0;
  let ghostMode = 'hover';
  /** Bumps on dispose to cancel in-flight Kenney GLB loads. */
  let spawnGeneration = 0;

  function disposeGhost() {
    spawnGeneration += 1;
    if (!ghost) return;
    scene.remove(ghost);
    disposeGhostMaterials(ghost);
    ghost = null;
    currentAssetId = null;
    isAnchored = false;
    baseYawAngle = 0;
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

  /**
   * @param {THREE.Object3D} mesh
   * @param {number} x
   * @param {number} y
   * @param {{ gridSize?: number, footprintWidth?: number, footprintHeight?: number, rotationStep?: number }} [options]
   */
  function setKenneyTilePosition(mesh, x, y, options = {}) {
    const rotationStep = options.rotationStep ?? 0;
    let footprintWidth = options.footprintWidth ?? options.gridSize ?? 1;
    let footprintDepth = options.footprintHeight ?? options.gridSize ?? 1;
    if (rotationStep % 2 === 1) {
      [footprintWidth, footprintDepth] = [footprintDepth, footprintWidth];
    }

    const centerX = (footprintWidth - 1) / 2;
    const centerZ = (footprintDepth - 1) / 2;
    mesh.position.set(
      x + centerX,
      KENNEY_CITY_KIT_PLATFORM_HEIGHT + 0.04,
      y + centerZ
    );
    mesh.rotation.y = rotationStep * (Math.PI / 2);

    if (mesh.userData) {
      mesh.userData.x = x;
      mesh.userData.y = y;
      mesh.userData.gridSize = Math.max(footprintWidth, footprintDepth);
      mesh.userData.footprintWidth = footprintWidth;
      mesh.userData.footprintDepth = footprintDepth;
    }
  }

  /**
   * @param {THREE.Object3D} mesh
   * @param {string} assetId
   * @param {number} x
   * @param {number} y
   * @param {{ gridSize?: number, footprintWidth?: number, footprintHeight?: number, rotationStep?: number }} [options]
   */
  function repositionGhost(mesh, assetId, x, y, options = {}) {
    if (isKenneyBuildingId(assetId)) {
      setKenneyTilePosition(mesh, x, y, options);
      return;
    }
    setTilePosition(mesh, x, y, options.gridSize ?? 1);
    const step = options.rotationStep ?? rotationStep;
    if (step) {
      setPlacementRotationStep(mesh, baseYawAngle, step);
    }
  }

  /**
   * @param {THREE.Object3D} mesh
   * @param {string} assetId
   * @param {number} x
   * @param {number} y
   * @param {boolean} valid
   * @param {'hover' | 'anchored'} mode
   * @param {{ gridSize?: number, rotationStep?: number }} options
   */
  function mountGhost(mesh, assetId, x, y, valid, mode, options = {}) {
    applyGhostAppearance(mesh, { valid, mode });
    mesh.position.y += 0.04;
    mesh.renderOrder = 999;
    scene.add(mesh);

    ghost = mesh;
    currentAssetId = assetId;
    lastX = x;
    lastY = y;
    lastValid = valid;
    lastGridSize = options.gridSize ?? 1;
    lastFootprintWidth = options.footprintWidth ?? lastGridSize;
    lastFootprintHeight = options.footprintHeight ?? lastGridSize;
    lastRotationStep = options.rotationStep ?? 0;
    isAnchored = mode === 'anchored';
    ghostMode = mode;
    rotationStep = lastRotationStep;

    if (isKenneyBuildingId(assetId)) {
      baseYawAngle = 0;
    } else {
      baseYawAngle = getPlacementYawAngle(mesh);
      if (rotationStep) {
        setPlacementRotationStep(mesh, baseYawAngle, rotationStep);
      }
    }
  }

  /**
   * @param {string} assetId
   * @param {number} x
   * @param {number} y
   * @param {boolean} valid
   * @param {'hover' | 'anchored'} mode
   * @param {{ gridSize?: number, footprintWidth?: number, footprintHeight?: number, rotationStep?: number }} [options]
   */
  function spawn(assetId, x, y, valid, mode = 'hover', options = {}) {
    disposeGhost();
    const requestId = spawnGeneration;

    if (isKenneyBuildingId(assetId)) {
      getKenneyCityKitMeshAdapter()
        .createBuilding(x, y, {
          buildingId: assetId,
          rotationStep: options.rotationStep ?? 0,
        })
        .then((mesh) => {
          if (requestId !== spawnGeneration) {
            disposeGhostMaterials(mesh);
            return;
          }
          mountGhost(mesh, assetId, x, y, valid, mode, options);
        })
        .catch((error) => {
          console.warn('[placementGhost] Kenney preview failed:', assetId, error);
        });
      return;
    }

    const gridSize = options.gridSize ?? 1;
    const mesh = assetManager.createAsset(assetId, x, y);
    if (!mesh) return;

    setTilePosition(mesh, x, y, gridSize);
    mountGhost(mesh, assetId, x, y, valid, mode, { ...options, gridSize });
  }

  /**
   * @param {string} assetId
   * @param {number} x
   * @param {number} y
   * @param {boolean} [valid]
   * @param {{ mode?: 'hover' | 'anchored', gridSize?: number, footprintWidth?: number, footprintHeight?: number, rotationStep?: number }} [options]
   */
  function show(assetId, x, y, valid = true, options = {}) {
    if (!assetId || typeof x !== 'number' || typeof y !== 'number') {
      return;
    }

    const mode = options.mode ?? 'hover';
    const gridSize = options.gridSize ?? 1;
    const rotationStepOpt = options.rotationStep ?? rotationStep;

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
      && lastRotationStep === rotationStepOpt
    ) {
      return;
    }

    if (
      !ghost
      || currentAssetId !== assetId
      || lastValid !== valid
      || ghostMode !== mode
      || lastGridSize !== gridSize
      || lastRotationStep !== rotationStepOpt
    ) {
      spawn(assetId, x, y, valid, mode, options);
      return;
    }

    repositionGhost(ghost, assetId, x, y, options);
    lastX = x;
    lastY = y;
    lastGridSize = gridSize;
    lastFootprintWidth = options.footprintWidth ?? gridSize;
    lastFootprintHeight = options.footprintHeight ?? gridSize;
  }

  /**
   * Lock ghost on tile for rotation step (touch flow).
   */
  function anchor(assetId, x, y, valid = true, gridSize = 1, options = {}) {
    spawn(assetId, x, y, valid, 'anchored', { gridSize, ...options });
  }

  /**
   * @param {number} step 0–3
   */
  function setRotationStep(step) {
    if (!ghost || !currentAssetId) return;
    rotationStep = ((step % 4) + 4) % 4;
    lastRotationStep = rotationStep;

    if (isKenneyBuildingId(currentAssetId)) {
      spawn(currentAssetId, lastX, lastY, lastValid, ghostMode, {
        gridSize: lastGridSize,
        footprintWidth: lastFootprintWidth,
        footprintHeight: lastFootprintHeight,
        rotationStep,
      });
      return;
    }

    setPlacementRotationStep(ghost, baseYawAngle, rotationStep);
    if (lastX != null && lastY != null) {
      repositionGhost(ghost, currentAssetId, lastX, lastY, {
        gridSize: lastGridSize,
        footprintWidth: lastFootprintWidth,
        footprintHeight: lastFootprintHeight,
        rotationStep,
      });
    }
  }

  function rotateStep() {
    if (!ghost || !currentAssetId) {
      return rotationStep;
    }
    setRotationStep(rotationStep + 1);
    return rotationStep;
  }

  function clear() {
    disposeGhost();
    lastX = null;
    lastY = null;
    lastValid = true;
    lastGridSize = 1;
    lastFootprintWidth = 1;
    lastFootprintHeight = 1;
    lastRotationStep = 0;
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
