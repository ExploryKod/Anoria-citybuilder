// Kenney test — thin facade used by scene.js (parallel to AssetManager, not a replacement).

import * as THREE from 'three';
import { KENNEY_BUILDING_ID, KENNEY_INTERIOR_FLOOR_MODULE, KENNEY_L1_SHOWCASE } from './kenneyTestConfig.js';
import {
  composeKenneyBuilding,
  listKenneyRecipeModuleIds,
  loadKenneyModularCatalog,
} from './KenneyBuildingComposer.js';
import { preloadKenneyModules } from './KenneyModuleLoader.js';

let adapterInstance = null;

export class KenneyModularMeshAdapter {
  constructor() {
    this.ready = false;
    /** @type {Promise<void> | null} */
    this._initPromise = null;
  }

  isKenneyBuildingId(buildingId) {
    return buildingId === KENNEY_BUILDING_ID;
  }

  async initialize() {
    if (this.ready) return;
    if (!this._initPromise) {
      this._initPromise = this._load();
    }
    await this._initPromise;
  }

  async _load() {
    const catalog = await loadKenneyModularCatalog();
    const moduleIds = new Set();
    for (const entry of KENNEY_L1_SHOWCASE) {
      const ids = await listKenneyRecipeModuleIds(entry.recipeId);
      ids.forEach((id) => moduleIds.add(id));
    }
    moduleIds.add(KENNEY_INTERIOR_FLOOR_MODULE);
    await preloadKenneyModules(moduleIds, catalog.modules);
    this.ready = true;
  }

  /**
   * @param {number} originX
   * @param {number} originZ
   * @param {{ rotationStep?: number, buildingId?: string, recipeId: string }} options
   * @returns {Promise<THREE.Group>}
   */
  async createBuilding(originX, originZ, options) {
    await this.initialize();
    return composeKenneyBuilding({
      recipeId: options.recipeId,
      originX,
      originZ,
      rotationStep: options.rotationStep ?? 0,
      buildingId: options.buildingId ?? KENNEY_BUILDING_ID,
    });
  }

  /**
   * @param {THREE.Scene} threeScene
   * @param {THREE.Group} interactiveGroup
   */
  async spawnDemoBuilding(threeScene, interactiveGroup) {
    const existing = threeScene.getObjectByName('kenney-test-demo-root');
    existing?.parent?.remove(existing);

    const root = new THREE.Group();
    root.name = 'kenney-test-demo-root';

    for (const entry of KENNEY_L1_SHOWCASE) {
      const mesh = await this.createBuilding(entry.x, entry.z, {
        recipeId: entry.recipeId,
      });
      mesh.name = `kenney-demo-${entry.recipeId}`;
      root.add(mesh);
    }

    interactiveGroup.add(root);
    return root;
  }
}

export function getKenneyModularMeshAdapter() {
  if (!adapterInstance) {
    adapterInstance = new KenneyModularMeshAdapter();
  }
  return adapterInstance;
}
