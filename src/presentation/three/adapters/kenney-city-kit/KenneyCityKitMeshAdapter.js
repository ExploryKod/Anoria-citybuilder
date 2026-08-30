// Kenney city kits — facade for scene.js (prefab GLB buildings).

import * as THREE from 'three';
import {
  KENNEY_CITY_KIT_CATALOG_URL,
  KENNEY_CITY_KIT_PLATFORM_HEIGHT,
  KENNEY_CITY_KIT_PREFAB_BY_BUILDING_ID,
  isKenneyBuildingId,
} from './kenneyCityKitConfig.js';
import {
  cloneKenneyCityKitPrefab,
} from './KenneyCityKitLoader.js';

let adapterInstance = null;

/** @type {Promise<object> | null} */
let catalogPromise = null;

function loadKenneyCityKitCatalog() {
  if (!catalogPromise) {
    catalogPromise = fetch(KENNEY_CITY_KIT_CATALOG_URL).then((response) => {
      if (!response.ok) {
        throw new Error(`Kenney city kit catalog HTTP ${response.status}`);
      }
      return response.json();
    });
  }
  return catalogPromise;
}

/**
 * @param {object} catalog
 * @param {string} prefabKey — `kitId:buildingId`
 */
function resolvePrefabEntry(catalog, prefabKey) {
  const [kitId, buildingId] = prefabKey.split(':');
  const kit = catalog.kits?.[kitId];
  const building = kit?.buildings?.[buildingId];
  if (!building?.glb) {
    throw new Error(`Kenney city kit prefab not found: ${prefabKey}`);
  }
  return {
    kitId,
    buildingId,
    glb: building.glb,
    footprintWidth: building.footprintWidth ?? 1,
    footprintDepth: building.footprintDepth ?? 1,
    gridSize: building.gridSize ?? 1,
  };
}

export class KenneyCityKitMeshAdapter {
  constructor() {
    this.ready = false;
    /** @type {Promise<void> | null} */
    this._initPromise = null;
  }

  isKenneyBuildingId(buildingId) {
    return isKenneyBuildingId(buildingId);
  }

  async initialize() {
    if (this.ready) return;
    if (!this._initPromise) {
      this._initPromise = this._load();
    }
    await this._initPromise;
  }

  async _load() {
    await loadKenneyCityKitCatalog();
    this.ready = true;
  }

  /**
   * @param {number} originX
   * @param {number} originZ
   * @param {{ buildingId: string, rotationStep?: number, prefabKey?: string }} options
   * @returns {Promise<THREE.Group>}
   */
  async createBuilding(originX, originZ, options) {
    await this.initialize();
    const catalog = await loadKenneyCityKitCatalog();
    const buildingId = options.buildingId;
    const prefabKey =
      options.prefabKey ??
      KENNEY_CITY_KIT_PREFAB_BY_BUILDING_ID[buildingId];
    if (!prefabKey) {
      throw new Error(`No Kenney city kit prefab for building id: ${buildingId}`);
    }

    const def = resolvePrefabEntry(catalog, prefabKey);
    const mesh = await cloneKenneyCityKitPrefab(prefabKey, def.glb);
    const group = new THREE.Group();
    group.name = `kenney-city-kit-${prefabKey}`;
    group.add(mesh);

    const rotationStep = ((options.rotationStep ?? 0) % 4 + 4) % 4;
    let footprintWidth = def.footprintWidth;
    let footprintDepth = def.footprintDepth;
    if (rotationStep % 2 === 1) {
      [footprintWidth, footprintDepth] = [footprintDepth, footprintWidth];
    }

    const centerX = (footprintWidth - 1) / 2;
    const centerZ = (footprintDepth - 1) / 2;
    group.position.set(
      originX + centerX,
      KENNEY_CITY_KIT_PLATFORM_HEIGHT,
      originZ + centerZ
    );
    group.rotation.y = rotationStep * (Math.PI / 2);

    group.userData.id = buildingId;
    group.userData.type = buildingId;
    group.userData.isKenneyCityKit = true;
    group.userData.prefabKey = prefabKey;
    group.userData.gridSize = Math.max(footprintWidth, footprintDepth);
    group.userData.footprintWidth = footprintWidth;
    group.userData.footprintDepth = footprintDepth;
    group.userData.x = originX;
    group.userData.y = originZ;

    return group;
  }
}

export function getKenneyCityKitMeshAdapter() {
  if (!adapterInstance) {
    adapterInstance = new KenneyCityKitMeshAdapter();
  }
  return adapterInstance;
}
