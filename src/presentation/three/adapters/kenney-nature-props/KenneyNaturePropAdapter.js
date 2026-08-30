import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
  getNaturePropCatalogEntry,
  resolveNaturePropGlbName,
} from '../../../../shared/editor-catalog/naturePropCatalog.js';
import { resolveTerrainDisplayColorHex } from '../../../../shared/terrain-catalog/terrainDisplayColor.js';
import { WORLD_PLATFORM_Y } from '../../../../shared/terrain-catalog/terrainWorldContract.js';

const loader = new GLTFLoader();
/** @type {Map<string, THREE.Object3D>} */
const templateCache = new Map();
/** @type {Map<string, Promise<THREE.Object3D>>} */
const loadingCache = new Map();

let adapterInstance = null;

/**
 * @param {THREE.Mesh} mesh
 * @param {string} propId
 */
function applyPropMeshPresentation(mesh, propId) {
  const entry = getNaturePropCatalogEntry(propId);
  const color = entry?.displayColor ?? resolveTerrainDisplayColorHex('nature:ground_grass');
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  mesh.renderOrder = 5;
  const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  const unlit = materials.map((material) => {
    material?.dispose?.();
    return new THREE.MeshBasicMaterial({
      color,
      side: THREE.DoubleSide,
      fog: true,
    });
  });
  mesh.material = unlit.length > 1 ? unlit : unlit[0];
}

/**
 * @param {string} propId
 * @returns {Promise<THREE.Object3D>}
 */
async function loadPropTemplate(propId) {
  if (templateCache.has(propId)) {
    return templateCache.get(propId);
  }
  if (loadingCache.has(propId)) {
    return loadingCache.get(propId);
  }

  const entry = getNaturePropCatalogEntry(propId);
  const glbUrl = entry?.glb;
  if (!glbUrl) {
    throw new Error(`[Kenney nature prop] Unknown prop: ${propId}`);
  }

  const promise = loader.loadAsync(glbUrl).then((gltf) => {
    const template = gltf.scene;
    template.name = `kenney-nature-prop-${resolveNaturePropGlbName(propId)}`;
    template.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        applyPropMeshPresentation(child, propId);
      }
    });
    templateCache.set(propId, template);
    loadingCache.delete(propId);
    return template;
  });

  loadingCache.set(propId, promise);
  return promise;
}

export class KenneyNaturePropAdapter {
  constructor() {
    this.ready = false;
    /** @type {Promise<void> | null} */
    this._initPromise = null;
  }

  isReady() {
    return this.ready;
  }

  async initialize() {
    if (this.ready) return;
    if (!this._initPromise) {
      this._initPromise = this._load();
    }
    await this._initPromise;
  }

  async _load() {
    const { NATURE_PROP_CATALOG } = await import(
      '../../../../shared/editor-catalog/naturePropCatalog.js'
    );
    await Promise.all(
      Object.keys(NATURE_PROP_CATALOG).map((propId) => loadPropTemplate(propId))
    );
    this.ready = true;
  }

  /**
   * @param {string} propId
   * @param {number} x
   * @param {number} y
   * @param {number} [rotationY=0]
   * @returns {THREE.Object3D}
   */
  createPropInstance(propId, x, y, rotationY = 0) {
    if (!this.ready) {
      throw new Error('[Kenney nature prop] Adapter not initialized');
    }
    const template = templateCache.get(propId);
    if (!template) {
      throw new Error(`[Kenney nature prop] Template not loaded: ${propId}`);
    }

    const root = template.clone(true);
    const group = new THREE.Group();
    group.name = resolveNaturePropGlbName(propId);
    group.add(root);
    group.rotation.y = rotationY;
    group.position.set(x, WORLD_PLATFORM_Y + 0.02, y);
    group.userData = {
      isEditorNatureProp: true,
      isKenneyNatureProp: true,
      propId,
      x,
      y,
      rotationY,
      layer: 'nature',
    };
    group.renderOrder = 5;
    return group;
  }
}

export function getKenneyNaturePropAdapter() {
  if (!adapterInstance) {
    adapterInstance = new KenneyNaturePropAdapter();
  }
  return adapterInstance;
}
