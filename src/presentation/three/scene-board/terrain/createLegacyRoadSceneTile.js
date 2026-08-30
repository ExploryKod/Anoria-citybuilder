import * as THREE from 'three';

const boundsScratch = new THREE.Box3();
const WORLD_PLATFORM_Y = 0.2;

/**
 * @param {string} logicalId
 * @param {number} x
 * @param {number} y
 * @param {{ materials: Record<string, THREE.Material>, roadGeometry?: THREE.PlaneGeometry }} options
 * @returns {import('../SceneTilePort.js').SceneTilePort}
 */
export function createLegacyRoadSceneTile(logicalId, x, y, options) {
  const material = options.materials?.roads;
  const geometry = options.roadGeometry ?? new THREE.PlaneGeometry(1, 1);
  const root = new THREE.Mesh(geometry, material);
  root.name = logicalId;
  root.rotation.x = -Math.PI / 2;
  root.position.set(x, WORLD_PLATFORM_Y + 0.5, y);
  root.castShadow = false;
  root.receiveShadow = true;
  root.userData = {
    id: logicalId,
    x,
    y,
    isBuilding: false,
    isRoad: true,
    time: 0,
  };

  return {
    root,
    x,
    y,
    layer: 'terrain',
    logicalId,
    participatesInPick: true,
    getPickRoot: () => root,
    getBounds: () => boundsScratch.setFromObject(root),
    getSurfaceMesh: () => root,
    setSurfaceMaterial: (nextMaterial) => {
      root.material = nextMaterial;
    },
    hasSurfaceMesh: () => true,
  };
}
