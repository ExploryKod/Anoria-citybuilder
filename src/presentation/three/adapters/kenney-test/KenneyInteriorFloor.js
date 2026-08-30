// Kenney test — interior floor: opaque underlay + Kenney planks module(s).

import * as THREE from 'three';
import { cloneKenneyModule } from './KenneyModuleLoader.js';
import { KENNEY_WOOD_WALL_COLOR } from './kenneyTestConfig.js';

/** Kenney planks.glb top surface (local Y). */
const PLANKS_TOP_Y = 0.06;

/**
 * Opaque underlay blocks grass bleed through gaps between plank boards.
 *
 * @param {THREE.Group} group
 * @param {number} gridSize
 */
function addKenneyFloorUnderlay(group, gridSize) {
  const floorGroup = new THREE.Group();
  floorGroup.name = 'kenney-floor-underlay';

  for (let tileX = 0; tileX < gridSize; tileX += 1) {
    for (let tileZ = 0; tileZ < gridSize; tileZ += 1) {
      const underlay = new THREE.Mesh(
        new THREE.PlaneGeometry(0.98, 0.98),
        new THREE.MeshStandardMaterial({
          color: KENNEY_WOOD_WALL_COLOR,
          roughness: 0.95,
          metalness: 0,
          side: THREE.DoubleSide,
        })
      );
      underlay.rotation.x = -Math.PI / 2;
      underlay.position.set(tileX, 0.002, tileZ);
      underlay.receiveShadow = true;
      floorGroup.add(underlay);
    }
  }

  group.add(floorGroup);
}

/**
 * @param {THREE.Group} group
 * @param {number} gridSize
 * @param {Record<string, { glb?: string }>} moduleCatalog
 */
async function addKenneyPlanksTiles(group, gridSize, moduleCatalog) {
  const moduleId = 'planks';
  const moduleEntry = moduleCatalog[moduleId];
  if (!moduleEntry?.glb) {
    console.warn('[Kenney test] planks module missing — underlay only');
    return PLANKS_TOP_Y;
  }

  const planksGroup = new THREE.Group();
  planksGroup.name = 'kenney-floor-planks';

  for (let tileX = 0; tileX < gridSize; tileX += 1) {
    for (let tileZ = 0; tileZ < gridSize; tileZ += 1) {
      const planks = await cloneKenneyModule(moduleId, moduleEntry.glb);
      planks.position.set(tileX, 0, tileZ);
      planks.name = `kenney-planks-${tileX}-${tileZ}`;
      planksGroup.add(planks);
    }
  }

  group.add(planksGroup);
  return PLANKS_TOP_Y;
}

/**
 * @param {THREE.Group} group
 * @param {number} gridSize
 * @param {Record<string, { glb?: string }>} moduleCatalog
 * @returns {Promise<number>} Y of the walkable floor top (for interior shell).
 */
export async function addKenneyInteriorFloor(group, gridSize, moduleCatalog) {
  addKenneyFloorUnderlay(group, gridSize);
  return addKenneyPlanksTiles(group, gridSize, moduleCatalog);
}

export { PLANKS_TOP_Y };
