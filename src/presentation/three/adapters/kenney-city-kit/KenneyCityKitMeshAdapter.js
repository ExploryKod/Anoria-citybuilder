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
import { resolveFootprint } from '../../../../shared/asset-footprint/resolveFootprint.js';

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

/** Height of the plot highlight above the ghost's base group, in tiles. */
const PLOT_LIFT = 0.16;

/** Thickness of the plot's border, in tiles. */
const PLOT_BORDER = 0.1;

/**
 * Flat frame around the plot (a border, the inside left open so the ground and the ghost show), in the group's
 * own (unrotated) frame so it turns with the mesh. Marked so the ghost styles it as the plot, not as the building.
 * @param {number} width
 * @param {number} depth
 */
function createPlotHighlight(width, depth) {
  const halfW = width / 2;
  const halfD = depth / 2;
  const frame = new THREE.Shape();
  frame.moveTo(-halfW, -halfD);
  frame.lineTo(halfW, -halfD);
  frame.lineTo(halfW, halfD);
  frame.lineTo(-halfW, halfD);
  frame.closePath();
  const inside = new THREE.Path();
  inside.moveTo(-halfW + PLOT_BORDER, -halfD + PLOT_BORDER);
  inside.lineTo(-halfW + PLOT_BORDER, halfD - PLOT_BORDER);
  inside.lineTo(halfW - PLOT_BORDER, halfD - PLOT_BORDER);
  inside.lineTo(halfW - PLOT_BORDER, -halfD + PLOT_BORDER);
  inside.closePath();
  frame.holes.push(inside);

  const plot = new THREE.Mesh(new THREE.ShapeGeometry(frame), new THREE.MeshBasicMaterial());
  plot.rotation.x = -Math.PI / 2;
  // The ghost's base is at the platform (KENNEY_CITY_KIT_PLATFORM_HEIGHT, +0.04 for the ghost) but the grass
  // tile's top is higher, so a shape laid there is hidden by the ground. Lift it as the reach overlay lifts the roads
  // it lights (WORLD_PLATFORM_Y + 0.2 in world, i.e. 0.16 here).
  plot.position.y = PLOT_LIFT;
  plot.userData.isPlotHighlight = true;
  plot.name = 'plot-highlight';
  return plot;
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
   * The mesh is centred on the PLOT the game reserves for `plotBuildingId` (its declared footprint), not on
   * the model's own footprint: a house's model sits in the middle of its plot, whatever its size.
   * @param {{ buildingId: string, plotBuildingId: string, rotationStep?: number, prefabKey?: string, showPlot?: boolean }} options
   * `showPlot` adds a flat highlight of the plot under the mesh (placement ghost).
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

    if (!options.plotBuildingId) {
      throw new Error(`[KenneyCityKitMeshAdapter] plotBuildingId is required to centre "${buildingId}" on its plot`);
    }
    const plot = resolveFootprint(options.plotBuildingId);
    if (options.showPlot) {
      group.add(createPlotHighlight(plot.width, plot.depth));
    }
    const rotationStep = ((options.rotationStep ?? 0) % 4 + 4) % 4;
    let footprintWidth = plot.width;
    let footprintDepth = plot.depth;
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
