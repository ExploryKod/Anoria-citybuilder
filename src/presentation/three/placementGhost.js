import * as THREE from 'three';
import { getPlacementYawAngle, setPlacementRotationStep } from './placementRotation.js';
import { ASSET_CATALOG } from './meshs/resolveBuildingMesh.js';
import { getBuildingSourceAdapter } from './adapters/buildingSourceAdapterRegistry.js';
import {
  isEditorPlacementTool,
  isEditorTerrainTool,
} from '../../shared/editor-catalog/editorToolIds.js';
import { getKenneyNatureTerrainAdapter } from './adapters/kenney-nature-terrain/KenneyNatureTerrainAdapter.js';
import { getKenneyNaturePropAdapter } from './adapters/kenney-nature-props/KenneyNaturePropAdapter.js';
import { propGroupWorldY } from '../../shared/editor-catalog/kenneyPlacementProfile.js';
import { maxEditorPlacementRotationSteps, isEditorRiverAsset, resolveRiverMountFromRotationStep, resolveVerticalFaceRiverAssetId } from '../../shared/editor-catalog/editorKenneyAssetBehavior.js';
import { applyKenneyVerticalEdgeMountToObject } from '../../shared/editor-catalog/editorVerticalFaceMount.js';
import { WORLD_PLATFORM_Y } from '../../shared/terrain-catalog/terrainWorldContract.js';

/**
 * @param {string} assetId
 * @returns {boolean}
 */
function isLazyKenneyEditorAsset(assetId) {
  return isEditorPlacementTool(assetId);
}

/**
 * The registered BuildingSourceAdapter for `assetId`'s catalog source, if
 * any — this file must never branch on a source name itself (see
 * adapters/buildingSourceAdapterRegistry.js); a nature/terrain editor asset
 * (no registered building adapter) falls through to the editor-stack path
 * below instead.
 * @param {string} assetId
 * @returns {import('./adapters/buildingSourceAdapterRegistry.js').BuildingSourceAdapter | null}
 */
function getGhostAdapter(assetId) {
  return getBuildingSourceAdapter(ASSET_CATALOG[assetId]?.source);
}

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
    fog: false,
    toneMapped: false,
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
  /** In-flight async spawn — avoids restarting load every animation frame. */
  let pendingAsyncSpawn = null;
  let lastMountKey = 'surface';
  /** Active editor tool id (may differ from visual mesh id, e.g. river → waterfall). */
  let placementToolId = null;

  function resolvePlacementToolId(assetId, options = {}) {
    return options.placementToolId ?? placementToolId ?? assetId;
  }

  function isEditorGhostPlacement(assetId, options = {}) {
    return isEditorPlacementTool(resolvePlacementToolId(assetId, options));
  }

  function resolveEditorMountKey(options = {}) {
    const preview = options.editorGhostPreview;
    if (preview?.mountMode === 'verticalFace') {
      return `vf|${preview.faceDirection}|${preview.hostAssetId ?? ''}`;
    }
    return 'surface';
  }

  function getSpawnSignature(assetId, valid, mode, options = {}) {
    const gridSize = options.gridSize ?? 1;
    const rotationStep = options.rotationStep ?? 0;
    const footprintWidth = options.footprintWidth ?? gridSize;
    const footprintHeight = options.footprintHeight ?? gridSize;
    const anchorY = options.placementBaseLocalY ?? '';
    const mountKey = resolveEditorMountKey(options);
    return `${assetId}|${mode}|${valid}|${gridSize}|${footprintWidth}|${footprintHeight}|${rotationStep}|${anchorY}|${mountKey}`;
  }

  function disposeGhost() {
    spawnGeneration += 1;
    pendingAsyncSpawn = null;
    if (!ghost) return;
    scene.remove(ghost);
    disposeGhostMaterials(ghost);
    ghost = null;
    currentAssetId = null;
    placementToolId = null;
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
   * @param {number} baseLocalY
   * @param {string} propId
   */
  function setEditorStackGhostPosition(mesh, x, y, baseLocalY, assetId, rotationStep = 0) {
    mesh.position.set(x, WORLD_PLATFORM_Y + propGroupWorldY(assetId, baseLocalY) + 0.04, y);
    mesh.rotation.y = rotationStep * (Math.PI / 2);
    if (mesh.userData) {
      mesh.userData.x = x;
      mesh.userData.y = y;
      mesh.userData.gridSize = 1;
    }
  }

  /**
   * @param {THREE.Object3D} mesh
   * @param {number} x
   * @param {number} y
   * @param {string} assetId
   * @param {{ placementBaseLocalY?: number, rotationStep?: number, editorGhostPreview?: { ok?: boolean, baseLocalY?: number, x?: number, y?: number, mountMode?: string, faceDirection?: string | null, hostAssetId?: string } }} [options]
   */
  function applyEditorStackGhostTransform(mesh, x, y, assetId, options = {}) {
    const preview = options.editorGhostPreview;
    const tileX = preview?.x ?? x;
    const tileY = preview?.y ?? y;
    const baseLocalY = preview?.baseLocalY ?? options.placementBaseLocalY;

    if (
      preview?.mountMode === 'verticalFace'
      && preview.faceDirection
      && baseLocalY != null
    ) {
      const childAssetId = resolveVerticalFaceRiverAssetId(
        preview.hostAssetId ?? 'nature:cliff_rock'
      );
      applyKenneyVerticalEdgeMountToObject(
        mesh,
        preview.faceDirection,
        childAssetId,
        tileX,
        tileY,
        baseLocalY,
        WORLD_PLATFORM_Y
      );
      mesh.position.y += 0.04;
      if (mesh.userData) {
        mesh.userData.x = tileX;
        mesh.userData.y = tileY;
        mesh.userData.gridSize = 1;
      }
      return;
    }

    if (baseLocalY == null) {
      return;
    }

    const step = options.rotationStep ?? rotationStep;
    const surfaceStep = isEditorRiverAsset(assetId)
      ? resolveRiverMountFromRotationStep(step).surfaceRotationStep
      : step;
    setEditorStackGhostPosition(mesh, tileX, tileY, baseLocalY, assetId, surfaceStep);
  }

  /**
   * @param {THREE.Object3D} mesh
   * @param {string} assetId
   * @param {number} x
   * @param {number} y
   * @param {{ gridSize?: number, footprintWidth?: number, footprintHeight?: number, rotationStep?: number }} [options]
   */
  function repositionGhost(mesh, assetId, x, y, options = {}) {
    const adapter = getGhostAdapter(assetId);
    if (adapter) {
      adapter.repositionGhost(mesh, x, y, { ...options, baseYawAngle, controllerRotationStep: rotationStep });
      return;
    }
    if (isEditorGhostPlacement(assetId, options) && options.placementBaseLocalY != null) {
      applyEditorStackGhostTransform(
        mesh,
        x,
        y,
        resolvePlacementToolId(assetId, options),
        options
      );
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
    if (isEditorGhostPlacement(assetId, options) && options.placementBaseLocalY != null) {
      applyEditorStackGhostTransform(
        mesh,
        x,
        y,
        resolvePlacementToolId(assetId, options),
        options
      );
    } else {
      mesh.position.y += 0.04;
    }
    mesh.renderOrder = 999;
    scene.add(mesh);

    ghost = mesh;
    currentAssetId = assetId;
    placementToolId = resolvePlacementToolId(assetId, options);
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
    lastMountKey = resolveEditorMountKey(options);

    const adapter = getGhostAdapter(assetId);
    if (adapter) {
      baseYawAngle = adapter.resolveBaseYawAngle(mesh);
      if (!adapter.rotationRequiresRespawn && rotationStep) {
        setPlacementRotationStep(mesh, baseYawAngle, rotationStep);
      }
    } else if (!isEditorGhostPlacement(assetId, options)) {
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
    placementToolId = resolvePlacementToolId(assetId, options);
    const signature = getSpawnSignature(assetId, valid, mode, options);

    if (pendingAsyncSpawn?.signature === signature) {
      pendingAsyncSpawn.x = x;
      pendingAsyncSpawn.y = y;
      pendingAsyncSpawn.valid = valid;
      pendingAsyncSpawn.options = options;
      return;
    }

    disposeGhost();
    const requestId = spawnGeneration;
    pendingAsyncSpawn = { signature, assetId, x, y, valid, mode, options };

    const finishAsyncSpawn = (buildMesh) => {
      if (requestId !== spawnGeneration) {
        disposeGhostMaterials(buildMesh);
        return;
      }
      const target = pendingAsyncSpawn;
      if (!target || target.signature !== signature) {
        disposeGhostMaterials(buildMesh);
        return;
      }
      pendingAsyncSpawn = null;

      const gridSize = target.options.gridSize ?? 1;
      const toolId = resolvePlacementToolId(target.assetId, target.options);
      if (isEditorGhostPlacement(target.assetId, target.options) && target.options.placementBaseLocalY != null) {
        applyEditorStackGhostTransform(
          buildMesh,
          target.x,
          target.y,
          toolId,
          target.options
        );
      } else {
        setTilePosition(buildMesh, target.x, target.y, gridSize);
      }
      mountGhost(
        buildMesh,
        target.assetId,
        target.x,
        target.y,
        target.valid,
        target.mode,
        { ...target.options, gridSize }
      );
    };

    const failAsyncSpawn = (error, label) => {
      if (requestId === spawnGeneration && pendingAsyncSpawn?.signature === signature) {
        pendingAsyncSpawn = null;
      }
      console.warn(`[placementGhost] ${label} failed:`, assetId, error);
    };

    const adapter = getGhostAdapter(assetId);
    if (adapter) {
      // Rotation is baked into the created mesh only when the adapter can't
      // rotate it in place afterwards (rotationRequiresRespawn) — otherwise
      // spawn produces a neutral mesh and mountGhost/repositionGhost own
      // rotation, so a later in-place rotate doesn't need a full respawn.
      const rotationStepForCreate = adapter.rotationRequiresRespawn ? (options.rotationStep ?? 0) : 0;
      const result = adapter.createMesh(x, y, {
        catalogEntry: ASSET_CATALOG[assetId],
        rotationStep: rotationStepForCreate,
        assetManager,
      });
      if (result && typeof result.then === 'function') {
        result.then(finishAsyncSpawn).catch((error) => {
          failAsyncSpawn(error, 'ghost mesh');
        });
        return;
      }
      if (!result) {
        pendingAsyncSpawn = null;
        return;
      }
      finishAsyncSpawn(result);
      return;
    }

    if (isLazyKenneyEditorAsset(assetId) || isLazyKenneyEditorAsset(placementToolId ?? assetId)) {
      const gridSize = options.gridSize ?? 1;
      const loadPromise = isEditorTerrainTool(assetId)
        ? getKenneyNatureTerrainAdapter().ensureTerrainTemplate(assetId)
        : getKenneyNaturePropAdapter().ensurePropLoaded(assetId);

      loadPromise
        .then(() => {
          if (requestId !== spawnGeneration) return;
          const target = pendingAsyncSpawn;
          if (!target || target.signature !== signature) return;
          const mesh = assetManager.createAsset(assetId, target.x, target.y);
          if (!mesh) {
            if (requestId === spawnGeneration && pendingAsyncSpawn?.signature === signature) {
              pendingAsyncSpawn = null;
            }
            return;
          }
          finishAsyncSpawn(mesh);
        })
        .catch((error) => {
          failAsyncSpawn(error, 'Kenney editor preview');
        });
      return;
    }

    // Neither a registered building-source adapter nor a lazy editor asset —
    // last-resort attempt straight through the asset manager, for whatever
    // isn't (yet) declared in a catalog/adapter.
    pendingAsyncSpawn = null;
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

    placementToolId = resolvePlacementToolId(assetId, options);

    const mode = options.mode ?? 'hover';
    const gridSize = options.gridSize ?? 1;
    const rotationStepOpt = options.rotationStep ?? rotationStep;
    const mountKey = resolveEditorMountKey(options);

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
      && lastMountKey === mountKey
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
      || lastMountKey !== mountKey
    ) {
      spawn(assetId, x, y, valid, mode, options);
      return;
    }

    repositionGhost(ghost, assetId, x, y, options);
    lastX = x;
    lastY = y;
    lastMountKey = mountKey;
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
  function setRotationStep(step, maxSteps = 4) {
    if (!ghost || !currentAssetId) return;
    rotationStep = ((step % maxSteps) + maxSteps) % maxSteps;
    lastRotationStep = rotationStep;

    if (getGhostAdapter(currentAssetId)?.rotationRequiresRespawn) {
      spawn(currentAssetId, lastX, lastY, lastValid, ghostMode, {
        gridSize: lastGridSize,
        footprintWidth: lastFootprintWidth,
        footprintHeight: lastFootprintHeight,
        rotationStep,
      });
      return;
    }

    if (isEditorGhostPlacement(placementToolId)) {
      return;
    }

    setPlacementRotationStep(ghost, baseYawAngle, rotationStep);
    if (lastX != null && lastY != null) {
      repositionGhost(ghost, currentAssetId, lastX, lastY, {
        gridSize: lastGridSize,
        footprintWidth: lastFootprintWidth,
        footprintHeight: lastFootprintHeight,
        rotationStep,
        placementToolId,
      });
    }
  }

  function rotateStep() {
    if (!ghost || !currentAssetId) {
      return rotationStep;
    }
    const toolId = placementToolId ?? currentAssetId;
    const maxSteps = maxEditorPlacementRotationSteps(toolId);
    setRotationStep(rotationStep + 1, maxSteps);
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
    lastMountKey = 'surface';
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
