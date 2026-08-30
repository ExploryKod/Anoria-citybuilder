import * as THREE from 'three';
import { getSceneTilePortFromObject } from './SceneTilePort.js';

const pickMeshScratch = [];
const intersectScratch = [];

/**
 * @param {import('three').Object3D | null | undefined} object
 * @returns {import('three').Object3D | null}
 */
export function resolveTileRaycastTarget(object) {
  const port = getSceneTilePortFromObject(object);
  if (port?.participatesInPick) {
    return port.getPickRoot();
  }

  let current = object ?? null;
  while (current) {
    const { x, y } = current.userData ?? {};
    if (typeof x === 'number' && typeof y === 'number') {
      return current;
    }
    current = current.parent;
  }
  return null;
}

/**
 * Raycast pick meshes directly so culled/invisible zone parents do not block hits.
 * @param {import('three').Raycaster} raycaster
 * @param {import('three').Object3D[]} roots
 * @returns {import('three').Intersection[]}
 */
function intersectPickMeshes(raycaster, roots) {
  pickMeshScratch.length = 0;
  intersectScratch.length = 0;

  for (const root of roots) {
    root.traverse((object) => {
      if (
        object instanceof THREE.Mesh
        && object.geometry
        && object.layers.test(raycaster.layers)
      ) {
        pickMeshScratch.push(object);
      }
    });
  }

  for (const mesh of pickMeshScratch) {
    mesh.raycast(raycaster, intersectScratch);
  }

  intersectScratch.sort((a, b) => a.distance - b.distance);
  return intersectScratch;
}

/**
 * @param {import('three').Raycaster} raycaster
 * @param {import('three').Object3D[]} roots
 * @returns {import('three').Object3D | null}
 */
export function pickTileFromRaycast(raycaster, roots) {
  for (const hit of intersectPickMeshes(raycaster, roots)) {
    const tile = resolveTileRaycastTarget(hit.object);
    if (tile) return tile;
  }
  return null;
}
