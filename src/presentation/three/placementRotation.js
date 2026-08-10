import * as THREE from 'three';

const ROTATION_STEP_RAD = Math.PI / 2;

/**
 * @param {THREE.Object3D} root
 * @param {number} rotationStep 0–3
 */
export function applyPlacementRotationStep(root, rotationStep) {
  if (!root || !rotationStep) {
    return;
  }
  root.rotation.y += rotationStep * ROTATION_STEP_RAD;
  root.userData.placementRotationStep = rotationStep;
}

/**
 * @param {THREE.Object3D} root
 * @param {number} baseRotationY
 * @param {number} rotationStep 0–3
 */
export function setPlacementRotationStep(root, baseRotationY, rotationStep) {
  if (!root) return;
  root.rotation.y = baseRotationY + rotationStep * ROTATION_STEP_RAD;
  root.userData.placementRotationStep = rotationStep;
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
