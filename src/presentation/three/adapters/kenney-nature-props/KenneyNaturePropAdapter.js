import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import {
  getNaturePropCatalogEntry,
  resolveNaturePropGlbName,
} from '../../../../shared/editor-catalog/naturePropCatalog.js';
import { WORLD_PLATFORM_Y } from '../../../../shared/terrain-catalog/terrainWorldContract.js';
import { propGroupWorldY } from '../../../../shared/editor-catalog/kenneyPlacementProfile.js';
import { applyEditorKenneyGltfPresentation } from '../kenney-nature/kenneyGltfPresentation.js';

const loader = new GLTFLoader();
const PROP_RENDER_ORDER = 5;

/** @type {Map<string, THREE.Object3D>} */
const templateCache = new Map();
/** @type {Map<string, Promise<THREE.Object3D>>} */
const loadingCache = new Map();

let adapterInstance = null;

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
    applyEditorKenneyGltfPresentation(template, { renderOrder: PROP_RENDER_ORDER });
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
    this.ready = true;
  }

  /**
   * @param {string} propId
   */
  async ensurePropLoaded(propId) {
    await loadPropTemplate(propId);
  }

  /**
   * @param {string} propId
   * @param {number} x
   * @param {number} y
   * @param {number} [rotationY=0]
   * @param {{ baseLocalY?: number, editorStackId?: string }} [options]
   * @returns {THREE.Object3D}
   */
  createPropInstance(propId, x, y, rotationY = 0, options = {}) {
    if (!this.ready) {
      throw new Error('[Kenney nature prop] Adapter not initialized');
    }
    const template = templateCache.get(propId);
    if (!template) {
      throw new Error(`[Kenney nature prop] Template not loaded: ${propId}`);
    }

    const baseLocalY = options.baseLocalY ?? 0.02;
    const root = template.clone(true);
    const group = new THREE.Group();
    group.name = resolveNaturePropGlbName(propId);
    group.add(root);
    group.rotation.y = rotationY;
    group.position.set(x, WORLD_PLATFORM_Y + propGroupWorldY(propId, baseLocalY), y);
    group.userData = {
      isEditorNatureProp: true,
      isKenneyNatureProp: true,
      propId,
      editorStackId: options.editorStackId ?? null,
      baseLocalY,
      x,
      y,
      rotationY,
      layer: 'nature',
    };
    group.renderOrder = PROP_RENDER_ORDER;
    group.frustumCulled = false;
    return group;
  }
}

export function getKenneyNaturePropAdapter() {
  if (!adapterInstance) {
    adapterInstance = new KenneyNaturePropAdapter();
  }
  return adapterInstance;
}
