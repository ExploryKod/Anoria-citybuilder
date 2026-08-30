import * as THREE from 'three';
import { getKenneyNatureTerrainAdapter } from '../../adapters/kenney-nature-terrain/KenneyNatureTerrainAdapter.js';
import {
  getTerrainSurfaceMesh,
  setTerrainSurfaceMaterial,
} from '../../adapters/kenney-nature-terrain/terrainSurfaceMesh.js';
import { resolveTerrainId } from '../../../../shared/terrain-catalog/resolveTerrainId.js';

const boundsScratch = new THREE.Box3();

/**
 * @param {string} logicalId
 * @param {number} x
 * @param {number} y
 * @returns {import('../SceneTilePort.js').SceneTilePort}
 */
export function createKenneyTerrainSceneTile(logicalId, x, y) {
  const canonicalId = resolveTerrainId(logicalId);
  const root = getKenneyNatureTerrainAdapter().createTerrainTile(
    canonicalId,
    x,
    y,
    logicalId
  );

  return {
    root,
    x,
    y,
    layer: 'terrain',
    logicalId,
    participatesInPick: true,
    getPickRoot: () => root,
    getBounds: () => boundsScratch.setFromObject(root),
    getSurfaceMesh: () => getTerrainSurfaceMesh(root),
    setSurfaceMaterial: (material) => {
      setTerrainSurfaceMaterial(root, material);
    },
    hasSurfaceMesh: () => Boolean(getTerrainSurfaceMesh(root)),
  };
}
