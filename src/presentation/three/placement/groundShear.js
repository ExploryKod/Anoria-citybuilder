import * as THREE from 'three';

/**
 * What lies on a slope (a road, its ghost, a tint) is not turned to follow it, it is **sheared**: every point is lifted in proportion to how far along the slope
 * it is (`y += rise × distance along the slope from the middle of the tile`). A turned plate would cover less ground than its length (at 45°, 0.71 of a tile)
 * and leave a groove at both ends; a sheared one keeps its whole span, so its two ends stay at the edges of the tile, at the exact height of the neighbouring
 * roads, and its width and thickness do not change.
 */

/**
 * The shear of a slope, around the middle of the tile (the origin of what lies on it).
 * @param {{ dx: number, dy: number, rise: number }} slope the neighbour the slope rises toward, and by how much
 * @param {THREE.Matrix4} [target]
 * @returns {THREE.Matrix4}
 */
export function groundShearMatrix(slope, target = new THREE.Matrix4()) {
  target.identity();
  // Column-major: (row y, column x) and (row y, column z)
  target.elements[1] = slope.rise * slope.dx;
  target.elements[9] = slope.rise * slope.dy;
  return target;
}

/**
 * Lay a mesh on the slope of its tile, or back on flat ground when there is none. The mesh keeps its own position, turn and scale (the turn the planner chose
 * for a road stays what it is); its matrix is then computed here, so call this again whenever the mesh is moved or turned.
 * @param {THREE.Object3D} mesh
 * @param {{ dx: number, dy: number, rise: number } | null | undefined} slope
 */
export function applyGroundShear(mesh, slope) {
  if (!slope) {
    mesh.matrixAutoUpdate = true;
    return;
  }
  mesh.updateMatrix();
  const turnAndScale = new THREE.Matrix4().makeRotationFromQuaternion(mesh.quaternion).scale(mesh.scale);
  turnAndScale.premultiply(groundShearMatrix(slope));
  turnAndScale.setPosition(mesh.position);
  mesh.matrix.copy(turnAndScale);
  mesh.matrixAutoUpdate = false;
  mesh.matrixWorldNeedsUpdate = true;
}
