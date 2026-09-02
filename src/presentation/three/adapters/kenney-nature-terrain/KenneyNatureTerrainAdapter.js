// Kenney nature-kit terrain — sync tile clones after preload.

import * as THREE from 'three';
import { getTerrainCatalogEntry } from '../../../../shared/terrain-catalog/terrainCatalog.js';
import { beachCompassToYawRadians } from '../../../../shared/terrain-catalog/beachBorderCompass.js';
import { WORLD_PLATFORM_Y } from '../../../../shared/terrain-catalog/terrainWorldContract.js';
import {
  getKenneyNatureTerrainTemplate,
  loadKenneyNatureTerrainTemplate,
  resolveTerrainRenderOrder,
} from './KenneyNatureTerrainLoader.js';
import { getTerrainSurfaceMesh } from './terrainSurfaceMesh.js';
import { propGroupWorldY } from '../../../../shared/editor-catalog/kenneyPlacementProfile.js';

let adapterInstance = null;

export class KenneyNatureTerrainAdapter {
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
    const { TERRAIN_PRELOAD_IDS, getTerrainCatalogEntry } = await import(
      '../../../../shared/terrain-catalog/terrainCatalog.js'
    );
    for (const terrainId of TERRAIN_PRELOAD_IDS) {
      const entry = getTerrainCatalogEntry(terrainId);
      if (!entry?.glb) continue;
      await loadKenneyNatureTerrainTemplate(terrainId, entry.glb, 'flat');
    }
    this.ready = true;
  }

  /** Editor / custom-map stack tiles — lit GLBs. Carousel icons are Isometric PNGs. */
  async ensureTerrainTemplate(terrainId, presentation = 'lit') {
    const entry = getTerrainCatalogEntry(terrainId);
    if (!entry?.glb) {
      throw new Error(`[Kenney nature terrain] Unknown terrain: ${terrainId}`);
    }
    if (!getKenneyNatureTerrainTemplate(terrainId, presentation)) {
      await loadKenneyNatureTerrainTemplate(terrainId, entry.glb, presentation);
    }
  }

  /**
   * @param {string} terrainId
   * @param {number} x
   * @param {number} y
   * @param {string} [legacyId='grass']
   * @param {{ compass?: import('../../../../shared/terrain-catalog/beachBorderCompass.js').BeachBorderCompass, surfaceY?: number, presentation?: 'gltf' | 'flat' | 'lit', baseLocalY?: number, editorStackId?: string, rotationY?: number }} [options]
   * @returns {import('three').Object3D}
   */
  createTerrainTile(terrainId, x, y, legacyId = 'grass', options = {}) {
    if (!this.ready) {
      throw new Error('[Kenney nature terrain] Adapter not initialized');
    }

    const presentation = options.presentation ?? 'flat';
    const entry = getTerrainCatalogEntry(terrainId);
    if (!entry?.glb) {
      throw new Error(`[Kenney nature terrain] Unknown terrain: ${terrainId}`);
    }

    const template = getKenneyNatureTerrainTemplate(terrainId, presentation);
    if (!template) {
      throw new Error(
        `[Kenney nature terrain] Template not loaded: ${terrainId} (${presentation})`
      );
    }

    const root = template.clone(true);
    if (options.compass) {
      root.rotation.y = beachCompassToYawRadians(options.compass);
    }

    const group = new THREE.Group();
    group.name = legacyId;
    group.renderOrder = resolveTerrainRenderOrder(terrainId);
    group.frustumCulled = false;
    group.add(root);

    const surfaceY = options.surfaceY ?? entry.surfaceY ?? 0;
    if (options.baseLocalY != null) {
      group.position.set(x, WORLD_PLATFORM_Y + propGroupWorldY(terrainId, options.baseLocalY), y);
    } else {
      group.position.set(x, WORLD_PLATFORM_Y + surfaceY, y);
    }
    if (typeof options.rotationY === 'number') {
      group.rotation.y = options.rotationY;
    }

    const surfaceMesh = getTerrainSurfaceMesh(group);
    group.userData = {
      id: legacyId,
      x,
      y,
      isBuilding: false,
      isKenneyNatureTerrain: true,
      terrainId,
      editorStackId: options.editorStackId ?? null,
      time: 0,
      kenneyTerrainSurfaceMesh: surfaceMesh,
    };

    return group;
  }
}

export function getKenneyNatureTerrainAdapter() {
  if (!adapterInstance) {
    adapterInstance = new KenneyNatureTerrainAdapter();
  }
  return adapterInstance;
}
