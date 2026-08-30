// Kenney test — interior shell, window glass panes.

import * as THREE from 'three';
import { addKenneyInteriorFloor, PLANKS_TOP_Y } from './KenneyInteriorFloor.js';

/** Bump when window/interior appearance logic changes (invalidates GLB template cache). */
export const KENNEY_APPEARANCE_REVISION = 5;

/** Kenney wall openings face local +X; outer wall plane is near x = 0.5. */
const KENNEY_WALL_OUTWARD_X = 0.5;

/** Dark navy glass — matches Kenney preview window panes. */
const KENNEY_WINDOW_GLASS_COLOR = 0x17202c;

/** @type {THREE.MeshBasicMaterial | null} */
let sharedGlassMaterial = null;

function getKenneyGlassMaterial() {
  if (!sharedGlassMaterial) {
    sharedGlassMaterial = new THREE.MeshBasicMaterial({
      color: KENNEY_WINDOW_GLASS_COLOR,
      side: THREE.FrontSide,
      depthWrite: true,
      depthTest: true,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
    });
    sharedGlassMaterial.name = 'kenney-window-glass';
  }
  return sharedGlassMaterial;
}

/**
 * @typedef {{
 *   width: number,
 *   height: number,
 *   x: number,
 *   y: number,
 *   z: number,
 *   opening: { minX: number, maxX: number, minY: number, maxY: number, minZ: number, maxZ: number },
 * }} WindowPaneSpec
 */

/** @type {Record<string, WindowPaneSpec>} */
const WINDOW_PANE_SPECS = Object.freeze({
  'wall-wood-window-glass': {
    width: 0.38,
    height: 0.48,
    x: 0.498,
    y: 0.52,
    z: 0,
    opening: { minX: 0.39, maxX: 0.495, minY: 0.26, maxY: 0.76, minZ: -0.21, maxZ: 0.21 },
  },
  'wall-wood-window-shutters': {
    width: 0.34,
    height: 0.44,
    x: 0.498,
    y: 0.52,
    z: 0,
    opening: { minX: 0.39, maxX: 0.495, minY: 0.28, maxY: 0.74, minZ: -0.19, maxZ: 0.19 },
  },
  'wall-wood-window-small': {
    width: 0.24,
    height: 0.3,
    x: 0.498,
    y: 0.72,
    z: 0,
    opening: { minX: 0.39, maxX: 0.495, minY: 0.6, maxY: 0.84, minZ: -0.14, maxZ: 0.14 },
  },
  'wall-wood-window-round': {
    width: 0.28,
    height: 0.28,
    x: 0.498,
    y: 0.65,
    z: 0,
    opening: { minX: 0.39, maxX: 0.495, minY: 0.54, maxY: 0.76, minZ: -0.16, maxZ: 0.16 },
  },
});

/**
 * @param {THREE.Mesh} mesh
 * @param {WindowPaneSpec['opening']} opening
 */
function stripOpeningInteriorTriangles(mesh, opening) {
  const geometry = mesh.geometry;
  const position = geometry.attributes.position;
  if (!position) {
    return;
  }

  const index = geometry.index;
  const triangleCount = index ? index.count / 3 : position.count / 3;
  const kept = [];

  const isOpeningInteriorTriangle = (i0, i1, i2) => {
    const cx = (position.getX(i0) + position.getX(i1) + position.getX(i2)) / 3;
    const cy = (position.getY(i0) + position.getY(i1) + position.getY(i2)) / 3;
    const cz = (position.getZ(i0) + position.getZ(i1) + position.getZ(i2)) / 3;
    const maxX = Math.max(
      position.getX(i0),
      position.getX(i1),
      position.getX(i2)
    );
    return (
      cx >= opening.minX &&
      cx <= opening.maxX &&
      cy >= opening.minY &&
      cy <= opening.maxY &&
      cz >= opening.minZ &&
      cz <= opening.maxZ &&
      maxX < KENNEY_WALL_OUTWARD_X
    );
  };

  for (let triangle = 0; triangle < triangleCount; triangle += 1) {
    const i0 = index ? index.getX(triangle * 3) : triangle * 3;
    const i1 = index ? index.getX(triangle * 3 + 1) : triangle * 3 + 1;
    const i2 = index ? index.getX(triangle * 3 + 2) : triangle * 3 + 2;
    if (!isOpeningInteriorTriangle(i0, i1, i2)) {
      kept.push(i0, i1, i2);
    }
  }

  if (kept.length === triangleCount * 3) {
    return;
  }

  const stripped = geometry.clone();
  stripped.setIndex(kept);
  stripped.computeVertexNormals();
  mesh.geometry = stripped;
}

/**
 * @param {THREE.Object3D} moduleRoot
 * @param {WindowPaneSpec} paneSpec
 */
function addKenneyWindowGlassPane(moduleRoot, paneSpec) {
  const pane = new THREE.Mesh(
    new THREE.PlaneGeometry(paneSpec.width, paneSpec.height),
    getKenneyGlassMaterial()
  );
  pane.name = 'kenney-window-glass-pane';
  pane.position.set(paneSpec.x, paneSpec.y, paneSpec.z);
  pane.rotation.y = -Math.PI / 2;
  pane.renderOrder = 2;
  pane.castShadow = false;
  pane.receiveShadow = false;
  moduleRoot.add(pane);
}

/**
 * Dark inward-facing walls + ceiling above the plank floor.
 *
 * @param {THREE.Group} group
 * @param {number} moduleHeight
 * @param {number} gridSize
 * @param {number} floorTopY
 */
function addKenneyInteriorShell(group, moduleHeight, gridSize, floorTopY) {
  const center = (gridSize - 1) / 2;
  const footprint = Math.max(0.5, gridSize * 0.86);
  const shellBaseY = floorTopY + 0.01;
  const shellHeight = Math.max(0.4, moduleHeight - shellBaseY - 0.02);
  const shellCenterY = shellBaseY + shellHeight / 2;

  const shell = new THREE.Mesh(
    new THREE.BoxGeometry(footprint, shellHeight, footprint),
    new THREE.MeshStandardMaterial({
      color: 0x1a1512,
      roughness: 1,
      metalness: 0,
      side: THREE.BackSide,
    })
  );
  shell.name = 'kenney-interior-shell';
  shell.position.set(center, shellCenterY, center);
  shell.castShadow = false;
  shell.receiveShadow = false;
  group.add(shell);
}

/**
 * Kenney planks floor + interior shell. Terrain grass stays untouched.
 *
 * @param {THREE.Group} group
 * @param {number} moduleHeight
 * @param {number} gridSize
 * @param {Record<string, { glb?: string }>} moduleCatalog
 */
export async function addKenneyInteriorRoom(
  group,
  moduleHeight,
  gridSize,
  moduleCatalog
) {
  const floorTopY = await addKenneyInteriorFloor(group, gridSize, moduleCatalog);
  addKenneyInteriorShell(
    group,
    moduleHeight,
    gridSize,
    floorTopY ?? PLANKS_TOP_Y
  );
}

/**
 * @param {THREE.Object3D} moduleRoot
 * @param {string} moduleId
 */
export function tuneKenneyModuleAppearance(moduleRoot, moduleId) {
  moduleRoot.userData.kenneyModuleId = moduleId;

  const paneSpec = WINDOW_PANE_SPECS[moduleId];
  if (!paneSpec) {
    return;
  }

  moduleRoot.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) {
      return;
    }
    stripOpeningInteriorTriangles(child, paneSpec.opening);
  });

  addKenneyWindowGlassPane(moduleRoot, paneSpec);
}
