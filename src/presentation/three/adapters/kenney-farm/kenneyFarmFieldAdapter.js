// Kenney farm field — a BuildingSourceAdapter that ASSEMBLES a field from 3D
// GLBs the catalog entry declares: a ground piece (`geometry.glb`, tiled once
// per footprint tile) and one crop model PER GROWTH STAGE (`crop.stages`)
// planted on it as InstancedMesh grids. What is planted depends on the crop STAGE, driven by the
// season through the catalog's own `crop.stageBySeason` table — fallow means
// no crop at all. The game only ever calls `mesh.userData.applySeason(season)`;
// nothing here names a crop, a season or an id.
//
// Catalog shape (see buildingAssets.js 'Farm-Wheat'):
//   geometry.glb          ground GLB, one per tile (1×1, centered on its origin)
//   crop.glb              optional default crop GLB for stages that name none
//   crop.perTile          plants per tile side (perTile × perTile per tile)
//   crop.stages           { [stage]: { glb?, scale? } | null }  — null = nothing planted;
//                         each stage may use its own GLB (e.g. wheat stage A → B)
//   crop.stageBySeason    { [season]: stage }            — season names as in TimeManager
//   crop.defaultStage     stage used when the season is unknown
//   crop.requiresStaff    true → the crop only exists while the building has workers:
//                         a field without staff stays at `crop.idleStage` (default 'fallow'),
//                         and a freshly placed field starts unstaffed
//   crop.previewStage     stage shown on the placement ghost (default: defaultStage)
//
// The game drives the assembled mesh through two hooks on `mesh.userData`:
//   applySeason(season)     from the season / time update
//   applyStaffing(staffed)  from the employment read model

import { createEmptyStocks } from '../../../../shared/building-catalog/resourceRoleQueries.js';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { registerBuildingSourceAdapter } from '../buildingSourceAdapterRegistry.js';
import { applyLitKenneyGltfPresentation } from '../kenney-nature/kenneyGltfPresentation.js';
import { resolveFootprint } from '../../../../shared/asset-footprint/resolveFootprint.js';

const FIELD_PLATFORM_HEIGHT = 0.2;
const DEFAULT_OFFSET_Y = 0.05;

const loader = new GLTFLoader();
/** @type {Map<string, Promise<THREE.Object3D>>} */
const templateCache = new Map();

/**
 * @param {string} glbUrl
 * @returns {Promise<THREE.Object3D>}
 */
function loadTemplate(glbUrl) {
  if (!templateCache.has(glbUrl)) {
    const promise = loader.loadAsync(encodeURI(glbUrl)).then((gltf) => {
      // Same lit Lambert look as the rest of the Kenney nature pieces.
      applyLitKenneyGltfPresentation(gltf.scene, { role: 'prop' });
      return gltf.scene;
    });
    // A failed load must not stay cached forever.
    promise.catch(() => templateCache.delete(glbUrl));
    templateCache.set(glbUrl, promise);
  }
  return templateCache.get(glbUrl);
}

/** Small deterministic PRNG so a field looks the same every time it is rebuilt. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Plants `perTile × perTile` crops on every tile of a width × depth field. Each
 * growth stage owns its InstancedMeshes (one per sub-mesh of its crop model);
 * only the active stage's are drawn.
 *
 * @param {Record<string, { template: THREE.Object3D, scale: number }>} stageModels
 * @param {object} cropConfig the catalog entry's `crop` fact
 * @param {number} width tiles
 * @param {number} depth tiles
 * @param {number} seed
 * @returns {{ root: THREE.Group, setStage: (stage: string) => void }}
 */
function createCropField(stageModels, cropConfig, width, depth, seed) {
  const perTile = Math.max(1, cropConfig.perTile ?? 3);
  const root = new THREE.Group();
  root.name = 'crop-field';

  // One placement per plant: position on its tile grid cell, jittered yaw/scale.
  const rng = mulberry32(seed);
  const placements = [];
  for (let i = 0; i < width; i += 1) {
    for (let j = 0; j < depth; j += 1) {
      for (let a = 0; a < perTile; a += 1) {
        for (let b = 0; b < perTile; b += 1) {
          placements.push({
            x: (i - (width - 1) / 2) + ((a + 0.5) / perTile - 0.5) + (rng() - 0.5) * 0.06,
            z: (j - (depth - 1) / 2) + ((b + 0.5) / perTile - 0.5) + (rng() - 0.5) * 0.06,
            yaw: rng() * Math.PI * 2,
            scaleJitter: 0.9 + rng() * 0.2,
          });
        }
      }
    }
  }

  /** @type {Record<string, { scale: number, parts: Array<{ mesh: THREE.InstancedMesh, matrix: THREE.Matrix4 }> }>} */
  const stages = {};
  for (const [stage, { template, scale: stageScale }] of Object.entries(stageModels)) {
    template.updateWorldMatrix(true, true);
    const parts = [];
    template.traverse((child) => {
      if (!(child instanceof THREE.Mesh)) return;
      const mesh = new THREE.InstancedMesh(child.geometry, child.material, placements.length);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.frustumCulled = false;
      mesh.count = 0;
      root.add(mesh);
      parts.push({ mesh, matrix: child.matrixWorld.clone() });
    });
    stages[stage] = { scale: stageScale, parts, filled: false };
  }

  const composed = new THREE.Matrix4();
  const placement = new THREE.Matrix4();
  const quaternion = new THREE.Quaternion();
  const yAxis = new THREE.Vector3(0, 1, 0);
  const position = new THREE.Vector3();
  const scale = new THREE.Vector3();

  const fillStage = (stageData) => {
    if (stageData.filled) return;
    stageData.parts.forEach(({ mesh, matrix }) => {
      placements.forEach((plant, index) => {
        position.set(plant.x, 0, plant.z);
        quaternion.setFromAxisAngle(yAxis, plant.yaw);
        scale.setScalar(stageData.scale * plant.scaleJitter);
        placement.compose(position, quaternion, scale);
        composed.multiplyMatrices(placement, matrix);
        mesh.setMatrixAt(index, composed);
      });
      mesh.instanceMatrix.needsUpdate = true;
    });
    stageData.filled = true;
  };

  return {
    root,
    setStage(stage) {
      for (const [name, stageData] of Object.entries(stages)) {
        const active = name === stage;
        if (active) fillStage(stageData);
        stageData.parts.forEach(({ mesh }) => { mesh.count = active ? placements.length : 0; });
      }
    },
  };
}

/**
 * @param {import('three').Object3D} mesh
 * @param {number} x
 * @param {number} y
 * @param {number} footprintWidth
 * @param {number} footprintDepth
 * @param {number} offsetY
 */
function setTilePosition(mesh, x, y, footprintWidth, footprintDepth, offsetY) {
  mesh.position.set(
    x + (footprintWidth - 1) / 2,
    FIELD_PLATFORM_HEIGHT + offsetY,
    y + (footprintDepth - 1) / 2,
  );
  mesh.userData.x = x;
  mesh.userData.y = y;
}

registerBuildingSourceAdapter('kenneyFarmField', {
  async createMesh(x, y, { catalogEntry, buildingId, rotationStep = 0 }) {
    const groundGlb = catalogEntry.geometry.glb;
    const cropConfig = catalogEntry.crop;
    if (!groundGlb) {
      throw new Error(`[kenneyFarmFieldAdapter] catalog entry "${buildingId}" has no geometry.glb`);
    }
    const stageEntries = Object.entries(cropConfig?.stages ?? {}).filter(([, stageConfig]) => stageConfig);
    const [groundTemplate, ...stageTemplates] = await Promise.all([
      loadTemplate(groundGlb),
      ...stageEntries.map(([, stageConfig]) => loadTemplate(stageConfig.glb ?? cropConfig.glb)),
    ]);
    const stageModels = Object.fromEntries(
      stageEntries.map(([stage, stageConfig], index) => [
        stage,
        { template: stageTemplates[index], scale: stageConfig.scale ?? 1 },
      ]),
    );

    // Footprint from the single source of truth; the ghost path passes no id (1×1).
    const footprint = buildingId ? resolveFootprint(buildingId) : { width: 1, depth: 1 };
    const step = ((rotationStep % 4) + 4) % 4;
    const swap = step % 2 === 1;
    const footprintWidth = swap ? footprint.depth : footprint.width;
    const footprintDepth = swap ? footprint.width : footprint.depth;

    const group = new THREE.Group();
    group.name = buildingId ?? 'kenney-farm-field';

    for (let i = 0; i < footprintWidth; i += 1) {
      for (let j = 0; j < footprintDepth; j += 1) {
        const ground = groundTemplate.clone(true);
        ground.position.set(i - (footprintWidth - 1) / 2, 0, j - (footprintDepth - 1) / 2);
        group.add(ground);
      }
    }

    const baseYaw = THREE.MathUtils.degToRad(catalogEntry.transform?.rotationDeg?.y ?? 0);
    group.rotation.y = baseYaw + step * (Math.PI / 2);
    group.scale.setScalar(catalogEntry.transform?.scale ?? 1);

    const offsetY = catalogEntry.transform?.positionOffsetY ?? DEFAULT_OFFSET_Y;
    group.userData = {
      id: buildingId,
      type: buildingId,
      name: buildingId,
      isBuilding: true,
      isRoad: false,
      gridSize: Math.max(footprintWidth, footprintDepth),
      footprintWidth,
      footprintDepth,
      neighbors: [],
      pop: 0,
      stocks: createEmptyStocks(),
      time: 0,
      roads: 0,
      stage: 0,
      stageName: '',
      price: 0,
      cityFunds: 0,
      maintenance: 0,
      worldTime: 0,
      baseYaw,
      placementOffsetY: offsetY,
    };

    if (cropConfig) {
      const field = createCropField(stageModels, cropConfig, footprintWidth, footprintDepth, (x * 73856093) ^ (y * 19349663));
      group.add(field.root);

      // Stage = f(season, staffing): no workers means nothing is planted at all.
      let season = null;
      let staffed = false;
      const refresh = () => {
        if (cropConfig.requiresStaff && !staffed) {
          field.setStage(cropConfig.idleStage ?? 'fallow');
          return;
        }
        field.setStage(cropConfig.stageBySeason?.[season] ?? cropConfig.defaultStage);
      };
      group.userData.applySeason = (nextSeason) => {
        season = nextSeason;
        refresh();
      };
      group.userData.applyStaffing = (isStaffed) => {
        if (staffed === Boolean(isStaffed)) return;
        staffed = Boolean(isStaffed);
        refresh();
      };
      // Placement ghost: show the crop so the player sees what they are placing.
      group.userData.showPreview = () => {
        field.setStage(cropConfig.previewStage ?? cropConfig.defaultStage);
      };
      refresh();
    }

    setTilePosition(group, x, y, footprintWidth, footprintDepth, offsetY);
    return group;
  },
  repositionGhost(mesh, x, y) {
    setTilePosition(
      mesh,
      x,
      y,
      mesh.userData?.footprintWidth ?? 1,
      mesh.userData?.footprintDepth ?? 1,
      mesh.userData?.placementOffsetY ?? DEFAULT_OFFSET_Y,
    );
  },
  // The footprint can swap width/depth on odd rotation steps — a full respawn
  // recomputes the field at the new footprint.
  rotationRequiresRespawn: true,
  // The catalog's base yaw is baked into the created mesh.
  resolveBaseYawAngle: () => 0,
});
