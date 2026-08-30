import * as THREE from 'three';

const boundsScratch = new THREE.Box3();
const WORLD_PLATFORM_Y = 0.2;

/**
 * @param {string} logicalId
 * @param {number} x
 * @param {number} y
 * @param {{ materials: Record<string, THREE.Material>, boxGeometry: THREE.BoxGeometry }} options
 * @returns {import('../SceneTilePort.js').SceneTilePort}
 */
export function createLegacyPlaceholderTerrainSceneTile(logicalId, x, y, options) {
  const material = options.materials?.terrain ?? options.materials?.grass;
  const root = new THREE.Mesh(options.boxGeometry, material);
  root.name = logicalId;
  root.userData = {
    id: logicalId,
    x,
    y,
    isBuilding: false,
    isPlaceholder: true,
    time: 0,
  };
  root.position.set(x, WORLD_PLATFORM_Y - 0.4, y);
  root.castShadow = true;
  root.receiveShadow = true;

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
