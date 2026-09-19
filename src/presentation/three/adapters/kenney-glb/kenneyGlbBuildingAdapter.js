// Generic "one Kenney GLB per catalog id" BuildingSourceAdapter — single-tile
// pieces (road pieces, nature-kit trees and rocks…) loaded straight from the
// GLB URL the catalog entry declares (`geometry.glb`). The catalog only
// declares which GLB, base yaw (`transform.rotationDeg.y`), scale and height
// (`transform.positionOffsetY`, added to the world platform); everything
// specific to creating, positioning and rotating lives here.
//
// Behavior keyed off the entry's own `tags`, never off an id:
//  - 'road'   → marked exactly like the village roads were (`name = 'roads'`,
//               `userData.isRoad`) because neighbor detection, erase and
//               road-paint logic key on those, not on the mesh's source.
//  - 'nature' → Kenney's lit presentation (normalized materials + shadows).
//  - 'building' → `userData.isBuilding` (trees/rocks are not buildings).

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { setPlacementRotationStep, getPlacementYawAngle } from '../../placement/placementRotation.js';
import { registerBuildingSourceAdapter } from '../buildingSourceAdapterRegistry.js';
import { applyLitKenneyGltfPresentation } from '../kenney-nature/kenneyGltfPresentation.js';

const KENNEY_GLB_PLATFORM_HEIGHT = 0.2;
const DEFAULT_OFFSET_Y = 0.05;

const loader = new GLTFLoader();
/** @type {Map<string, Promise<THREE.Object3D>>} */
const templateCache = new Map();

/**
 * @param {string} glbUrl
 * @param {boolean} lit apply Kenney's lit presentation (nature pieces)
 * @returns {Promise<THREE.Object3D>}
 */
function loadTemplate(glbUrl, lit) {
  const cacheKey = `${glbUrl}::${lit ? 'lit' : 'raw'}`;
  if (!templateCache.has(cacheKey)) {
    const promise = loader.loadAsync(encodeURI(glbUrl)).then((gltf) => {
      if (lit) {
        applyLitKenneyGltfPresentation(gltf.scene, { role: 'prop' });
      } else {
        gltf.scene.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.receiveShadow = true;
          }
        });
      }
      return gltf.scene;
    });
    // A failed load must not stay cached forever.
    promise.catch(() => templateCache.delete(cacheKey));
    templateCache.set(cacheKey, promise);
  }
  return templateCache.get(cacheKey);
}

/**
 * @param {import('three').Object3D} mesh
 * @param {number} x
 * @param {number} y
 * @param {number} offsetY
 */
function setTilePosition(mesh, x, y, offsetY) {
  mesh.position.set(x, KENNEY_GLB_PLATFORM_HEIGHT + offsetY, y);
  mesh.userData.x = x;
  mesh.userData.y = y;
}

registerBuildingSourceAdapter('kenneyGlb', {
  async createMesh(x, y, { catalogEntry, buildingId, rotationStep = 0 }) {
    const glb = catalogEntry.geometry.glb;
    if (!glb) {
      throw new Error(`[kenneyGlbBuildingAdapter] catalog entry "${buildingId}" has no geometry.glb`);
    }
    const tags = catalogEntry.tags ?? [];
    const isRoad = tags.includes('road');
    const template = await loadTemplate(glb, tags.includes('nature'));

    const group = new THREE.Group();
    group.add(template.clone(true));
    group.name = isRoad ? 'roads' : buildingId;

    const baseYaw = THREE.MathUtils.degToRad(catalogEntry.transform?.rotationDeg?.y ?? 0);
    const step = ((rotationStep % 4) + 4) % 4;
    group.rotation.y = baseYaw + step * (Math.PI / 2);
    group.scale.setScalar(catalogEntry.transform?.scale ?? 1);

    const offsetY = catalogEntry.transform?.positionOffsetY ?? DEFAULT_OFFSET_Y;
    group.userData = {
      id: buildingId,
      type: buildingId,
      name: buildingId,
      isBuilding: tags.includes('building'),
      isRoad,
      gridSize: 1,
      footprintWidth: 1,
      footprintDepth: 1,
      neighbors: [],
      pop: 0,
      stocks: { food: 0, cabbage: 0, wheat: 0, carrot: 0 },
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
    setTilePosition(group, x, y, offsetY);
    return group;
  },
  repositionGhost(mesh, x, y, options = {}) {
    setTilePosition(mesh, x, y, mesh.userData?.placementOffsetY ?? DEFAULT_OFFSET_Y);
    const step = options.rotationStep ?? options.controllerRotationStep ?? 0;
    setPlacementRotationStep(mesh, options.baseYawAngle ?? mesh.userData?.baseYaw ?? 0, step);
  },
  // A single-tile mesh rotating in place — no footprint to recompute.
  rotationRequiresRespawn: false,
  // The catalog's base yaw is baked into the created mesh.
  resolveBaseYawAngle: (mesh) => getPlacementYawAngle(mesh),
});
