import * as THREE from 'three';
import { WORLD_PLATFORM_Y } from '../../../shared/terrain-catalog/terrainWorldContract.js';
import { groundShearMatrix } from '../placement/groundShear.js';

/**
 * The road being dragged, before it is laid: a flat tint on every tile it would cover — green where it can be
 * built, red where something stops it. The eraser uses it too: red is what it will take (the whole of each building it
 * touches), amber the area the player drew. Pure display of a plan; it knows no rule of the game.
 */

const VALID_COLOR = 0x35d07f;
const BLOCKED_COLOR = 0xe5484d;
const AREA_COLOR = 0xf0b429;
const LIFT = 0.16;

/**
 * @param {{ scene: THREE.Scene, getGroundPose: (x: number, y: number) => { elevation: number, slope: { dx: number, dy: number, rise: number } | null } }} deps
 *   `getGroundPose`: how the ground of a tile lies (how high above the flat ground, and its slope if it is one): the tint lies on it, not in it
 */
export function createRoadPaintPreview({ scene, getGroundPose }) {
  /** @type {THREE.InstancedMesh[]} */
  let meshes = [];

  function layer(tiles, color) {
    if (!tiles.length) return;
    const geometry = new THREE.PlaneGeometry(0.92, 0.92).rotateX(-Math.PI / 2);
    const material = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.6, depthWrite: false });
    const mesh = new THREE.InstancedMesh(geometry, material, tiles.length);
    const matrix = new THREE.Matrix4();
    tiles.forEach((tile, index) => {
      const pose = getGroundPose(tile.x, tile.y);
      if (pose.slope) groundShearMatrix(pose.slope, matrix);
      else matrix.identity();
      matrix.setPosition(tile.x, WORLD_PLATFORM_Y + LIFT + pose.elevation, tile.y);
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
   * @param {{ valid: Array<{ x: number, y: number }>, blocked: Array<{ x: number, y: number }>, area?: Array<{ x: number, y: number }> }} plan
   *   `area`: the tiles of a drawn area that hold nothing to take (the eraser's square); a tile is in one list only
   */
  function show({ valid, blocked, area = [] }) {
    clear();
    layer(area, AREA_COLOR);
    layer(valid, VALID_COLOR);
    layer(blocked, BLOCKED_COLOR);
  }

  return { show, clear };
}
