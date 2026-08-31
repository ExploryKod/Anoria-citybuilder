import * as THREE from 'three';
import { WORLD_PLATFORM_Y } from '../../../shared/terrain-catalog/terrainWorldContract.js';

const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -WORLD_PLATFORM_Y);
const groundHitScratch = new THREE.Vector3();

/**
 * When a tile has no mesh (editor sea), raycast the build plane to recover grid coords.
 *
 * @param {import('three').Raycaster} raycaster
 * @param {number} citySize
 * @returns {{ userData: { x: number, y: number, isEditorTilePick: true } } | null}
 */
export function pickEditorTileOnGroundPlane(raycaster, citySize) {
  if (!raycaster.ray.intersectPlane(groundPlane, groundHitScratch)) {
    return null;
  }

  const x = Math.round(groundHitScratch.x);
  const y = Math.round(groundHitScratch.z);
  if (x < 0 || y < 0 || x >= citySize || y >= citySize) {
    return null;
  }

  return {
    userData: {
      x,
      y,
      isEditorTilePick: true,
    },
  };
}
