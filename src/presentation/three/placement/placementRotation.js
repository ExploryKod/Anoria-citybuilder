import * as THREE from 'three';

const ROTATION_STEP_RAD = Math.PI / 2;

/**
 * Village GLB meshes are usually Z-up, then tipped with Euler X≈90° so height
 * becomes world Y. For those, spinning on the footprint base means changing Z
 * (same as StonePath). Y-up authored meshes keep yaw on Y.
 *
 * @param {THREE.Object3D} root
 * @returns {boolean}
 */
export function usesUprightYawAxis(root) {
  if (!root) return true;
  return Math.abs(root.rotation.x) < 0.2;
}

/**
 * @param {THREE.Object3D} root
 * @returns {number} current authored yaw angle (radians) on the correct axis
 */
export function getPlacementYawAngle(root) {
  if (!root) return 0;
  return usesUprightYawAxis(root) ? root.rotation.y : root.rotation.z;
}

/**
 * Spin the building on its base (world-up), without tipping it.
 *
 * @param {THREE.Object3D} root
 * @param {number} rotationStep 0–3 absolute steps from authored orientation
 * @param {number} [baseYawAngle] authored yaw before player rotation
 */
export function setPlacementRotationStep(root, baseYawAngle, rotationStep) {
  if (!root) return;
  const step = ((rotationStep % 4) + 4) % 4;
  const angle = baseYawAngle + step * ROTATION_STEP_RAD;

  if (usesUprightYawAxis(root)) {
    root.rotation.y = angle;
  } else {
    // Keep X tip + base Y; yaw around world-up is local Z for tipped meshes.
    root.rotation.z = angle;
  }

  root.userData.placementRotationStep = step;
  root.userData.placementYawBase = baseYawAngle;
}

/**
 * Apply absolute step relative to current authored yaw (createAsset path).
 *
 * @param {THREE.Object3D} root
 * @param {number} rotationStep 0–3
 */
export function applyPlacementRotationStep(root, rotationStep) {
  if (!root || !rotationStep) {
    return;
  }
  const base = getPlacementYawAngle(root);
  // When createAsset already set authored orientation, that value is the base;
  // step is absolute from that pose (not additive on top of a previous step).
  setPlacementRotationStep(root, base, rotationStep);
}

/**
 * @param {number} gridSize
 * @param {number} x
 * @param {number} y
 * @returns {{ x: number, z: number }}
 */
export function footprintCenterOffset(gridSize, x, y) {
  const centerOffset = (gridSize - 1) / 2;
  return { x: x + centerOffset, z: y + centerOffset };
}

/**
 * @param {THREE.Camera} camera
 * @param {HTMLElement} canvas
 * @param {number} worldX
 * @param {number} worldY
 * @param {number} worldZ
 * @returns {{ left: number, top: number, visible: boolean }}
 */
export function projectWorldToScreen(camera, canvas, worldX, worldY, worldZ) {
  if (!camera || !canvas) {
    return { left: 0, top: 0, visible: false };
  }

  const vector = new THREE.Vector3(worldX, worldY, worldZ);
  vector.project(camera);
  const visible = vector.z >= -1 && vector.z <= 1;

  const rect = canvas.getBoundingClientRect();
  return {
    left: rect.left + (vector.x * 0.5 + 0.5) * rect.width,
    top: rect.top + (-vector.y * 0.5 + 0.5) * rect.height,
    visible,
  };
}
