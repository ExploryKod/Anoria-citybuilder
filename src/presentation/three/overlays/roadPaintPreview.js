import * as THREE from 'three';
import { WORLD_PLATFORM_Y } from '../../../shared/terrain-catalog/terrainWorldContract.js';

/**
 * The road being dragged, before it is laid: a flat tint on every tile it would cover — green where it can be
 * built, red where something stops it. Pure display of a plan; it knows no rule of the game.
 */

const VALID_COLOR = 0x35d07f;
const BLOCKED_COLOR = 0xe5484d;
const LIFT = 0.16;

/**
 * @param {{ scene: THREE.Scene }} deps
 */
export function createRoadPaintPreview({ scene }) {
  /** @type {THREE.InstancedMesh[]} */
  let meshes = [];

  function layer(tiles, color) {
    if (!tiles.length) return;
    const geometry = new THREE.PlaneGeometry(0.92, 0.92).rotateX(-Math.PI / 2);
    const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6, depthWrite: false });
    const mesh = new THREE.InstancedMesh(geometry, material, tiles.length);
    const matrix = new THREE.Matrix4();
    tiles.forEach((tile, index) => {
      matrix.makeTranslation(tile.x, WORLD_PLATFORM_Y + LIFT, tile.y);
      mesh.setMatrixAt(index, matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.renderOrder = 11;
    // Never picked: a click on the preview is a click on the ground under it.
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
   * @param {{ valid: Array<{ x: number, y: number }>, blocked: Array<{ x: number, y: number }> }} plan
   */
  function show({ valid, blocked }) {
    clear();
    layer(valid, VALID_COLOR);
    layer(blocked, BLOCKED_COLOR);
  }

  return { show, clear };
}
