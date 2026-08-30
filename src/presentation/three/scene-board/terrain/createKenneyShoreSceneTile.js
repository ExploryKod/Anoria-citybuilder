import * as THREE from 'three';
import { getKenneyNatureTerrainAdapter } from '../../adapters/kenney-nature-terrain/KenneyNatureTerrainAdapter.js';
import {
  getTerrainSurfaceMesh,
  setTerrainSurfaceMaterial,
} from '../../adapters/kenney-nature-terrain/terrainSurfaceMesh.js';

const boundsScratch = new THREE.Box3();

/**
 * @param {number} x
 * @param {number} y
 * @param {import('../../../../shared/terrain-catalog/islandShoreLayout.js').IslandShoreTileSpec} spec
 * @returns {import('../SceneTilePort.js').SceneTilePort}
 */
export function createKenneyShoreSceneTile(x, y, spec) {
  const logicalId = spec.terrainId.replace('nature:', '');
  const root = getKenneyNatureTerrainAdapter().createTerrainTile(
    spec.terrainId,
    x,
    y,
    logicalId,
    {
      compass: spec.compass,
      surfaceY: spec.surfaceY,
    }
  );

  if (spec.decorative) {
    root.userData.isDecorative = true;
    root.userData.nonInteractive = true;
  }

  return {
    root,
    x,
    y,
    layer: 'terrain',
    logicalId,
    participatesInPick: !spec.decorative,
    getPickRoot: () => root,
    getBounds: () => boundsScratch.setFromObject(root),
    getSurfaceMesh: () => getTerrainSurfaceMesh(root),
    setSurfaceMaterial: (material) => {
      setTerrainSurfaceMaterial(root, material);
    },
    hasSurfaceMesh: () => Boolean(getTerrainSurfaceMesh(root)),
  };
}

/** @deprecated use createKenneyShoreSceneTile */
export function createKenneyBeachBorderSceneTile(x, y, compass) {
  return createKenneyShoreSceneTile(x, y, {
    x,
    y,
    ring: 2,
    terrainId: 'nature:platform_beach',
    compass,
  });
}
