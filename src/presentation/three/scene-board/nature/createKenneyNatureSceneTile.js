import * as THREE from 'three';
import { getKenneyNaturePropAdapter } from '../../adapters/kenney-nature-props/KenneyNaturePropAdapter.js';
import { getNaturePropCatalogEntry } from '../../../../shared/editor-catalog/naturePropCatalog.js';

const boundsScratch = new THREE.Box3();

/**
 * @param {string} propId
 * @param {number} x
 * @param {number} y
 * @param {number} [rotationY=0]
 * @returns {import('../SceneTilePort.js').SceneTilePort}
 */
export function createKenneyNatureSceneTile(propId, x, y, rotationY = 0) {
  const root = getKenneyNaturePropAdapter().createPropInstance(propId, x, y, rotationY);
  const entry = getNaturePropCatalogEntry(propId);

  return {
    root,
    x,
    y,
    layer: 'nature',
    logicalId: propId,
    participatesInPick: true,
    getPickRoot: () => root,
    getBounds: () => boundsScratch.setFromObject(root),
    getSurfaceMesh: () => null,
    setSurfaceMaterial: () => {},
    hasSurfaceMesh: () => false,
  };
}
