import * as THREE from 'three';
import { WORLD_PLATFORM_Y } from '../../../shared/terrain-catalog/terrainWorldContract.js';

/**
 * The "range" mode's picture: the roads a building reaches lit blue (as in Caesar III), and a
 * translucent volume over the buildings that receive what it gives (green) or give what it takes
 * (amber). Pure display of a `computeBuildingReach` result — it knows no rule of the game.
 */

const ROAD_COLOR = 0x3d8bff;
const OUT_COLOR = 0x35d07f;
const IN_COLOR = 0xffb020;
const ROAD_LIFT = 0.12;
const VOLUME_HEIGHT = 1.0;

/**
 * @param {{ scene: THREE.Scene }} deps
 */
export function createReachOverlay({ scene }) {
  /** @type {THREE.InstancedMesh[]} */
  let meshes = [];

  function instanced(geometry, color, opacity, tiles, y) {
    const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false });
    const mesh = new THREE.InstancedMesh(geometry, material, tiles.length);
    const matrix = new THREE.Matrix4();
    tiles.forEach((tile, index) => {
      matrix.makeTranslation(tile.x, y, tile.y);
      mesh.setMatrixAt(index, matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.renderOrder = 10;
    // Never picked: a click on the overlay is a click on what lies under it.
    mesh.raycast = () => {};
    scene.add(mesh);
    meshes.push(mesh);
  }

  function clear() {
    for (const mesh of meshes) {
      scene.remove(mesh);
      mesh.geometry.dispose();
      mesh.material.dispose();
      mesh.dispose?.();
    }
    meshes = [];
  }

  /**
   * @param {{ roads: Array<{ x: number, y: number }>, buildings: Array<{ tiles: Array<{ x: number, y: number }>, direction: 'out' | 'in' }> }} reach
   */
  function show(reach) {
    clear();
    if (reach.roads.length) {
      const flat = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
      instanced(flat, ROAD_COLOR, 0.55, reach.roads, WORLD_PLATFORM_Y + ROAD_LIFT);
    }
    for (const [direction, color] of [['out', OUT_COLOR], ['in', IN_COLOR]]) {
      const tiles = reach.buildings.filter((b) => b.direction === direction).flatMap((b) => b.tiles);
      if (!tiles.length) continue;
      const volume = new THREE.BoxGeometry(1, VOLUME_HEIGHT, 1);
      instanced(volume, color, 0.35, tiles, WORLD_PLATFORM_Y + VOLUME_HEIGHT / 2);
    }
  }

  return { show, clear };
}
