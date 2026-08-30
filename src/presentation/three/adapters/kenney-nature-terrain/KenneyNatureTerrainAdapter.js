// Kenney nature-kit terrain — sync tile clones after preload.

import * as THREE from 'three';
import { getTerrainCatalogEntry, TERRAIN_CATALOG } from '../../../../shared/terrain-catalog/terrainCatalog.js';
import { beachCompassToYawRadians } from '../../../../shared/terrain-catalog/beachBorderCompass.js';
import { WORLD_PLATFORM_Y } from '../../../../shared/terrain-catalog/terrainWorldContract.js';
import {
  applyTerrainMeshPresentation,
  getKenneyNatureTerrainTemplate,
  loadKenneyNatureTerrainTemplate,
} from './KenneyNatureTerrainLoader.js';
import { getTerrainSurfaceMesh } from './terrainSurfaceMesh.js';

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
    for (const [terrainId, entry] of Object.entries(TERRAIN_CATALOG)) {
      if (!entry?.glb) continue;
      await loadKenneyNatureTerrainTemplate(terrainId, entry.glb);
    }
    this.ready = true;
  }

  /**
   * @param {string} terrainId — canonical id, e.g. `nature:ground_grass`
   * @param {number} x
   * @param {number} y
   * @param {string} [legacyId='grass']
   * @param {{ compass?: import('../../../../shared/terrain-catalog/beachBorderCompass.js').BeachBorderCompass, surfaceY?: number }} [options]
   * @returns {THREE.Object3D}
   */
  createTerrainTile(terrainId, x, y, legacyId = 'grass', options = {}) {
    if (!this.ready) {
      throw new Error('[Kenney nature terrain] Adapter not initialized');
    }

    const entry = getTerrainCatalogEntry(terrainId);
    if (!entry?.glb) {
      throw new Error(`[Kenney nature terrain] Unknown terrain: ${terrainId}`);
    }

    const template = getKenneyNatureTerrainTemplate(terrainId);
    if (!template) {
      throw new Error(`[Kenney nature terrain] Template not loaded: ${terrainId}`);
    }

    const root = template.clone(true);
    if (options.compass) {
      root.rotation.y = beachCompassToYawRadians(options.compass);
    }
    root.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        applyTerrainMeshPresentation(child, terrainId);
      }
    });
    const group = new THREE.Group();
    group.name = legacyId;
    group.renderOrder = terrainId === 'nature:platform_beach'
      ? 4
      : terrainId.startsWith('nature:cliff_')
        ? 3
        : 2;
    group.add(root);

    const surfaceY = options.surfaceY ?? entry.surfaceY ?? 0;
    group.position.set(x, WORLD_PLATFORM_Y + surfaceY, y);
    // Kenney ground_grass is Y-up, 1×1 centered on origin — matches legacy grass tile coords.

    const surfaceMesh = getTerrainSurfaceMesh(group);
    group.userData = {
      id: legacyId,
      x,
      y,
      isBuilding: false,
      isKenneyNatureTerrain: true,
      terrainId,
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
