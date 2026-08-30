import { getSceneTilePortFromObject } from '../SceneTilePort.js';

/**
 * @param {import('three').Object3D | null | undefined} terrainRoot
 * @returns {import('../SceneTilePort.js').SceneTilePort | null}
 */
export function getTerrainSceneTilePort(terrainRoot) {
  const port = getSceneTilePortFromObject(terrainRoot);
  return port?.layer === 'terrain' ? port : null;
}

/**
 * @param {import('three').Object3D | null | undefined} terrainRoot
 * @param {import('three').Material} roadMaterial
 * @param {{ x: number, y: number, rotationStep?: number }} placement
 * @returns {boolean}
 */
export function applyRoadMaterialToTerrainTile(terrainRoot, roadMaterial, placement) {
  const port = getTerrainSceneTilePort(terrainRoot);
  if (!port?.hasSurfaceMesh()) return false;

  port.setSurfaceMaterial(roadMaterial);
  const root = port.root;
  root.name = 'roads';
  root.userData.id = 'roads';
  root.userData.type = 'roads';
  root.userData.isRoad = true;
  root.userData.x = placement.x;
  root.userData.y = placement.y;
  root.rotation.y = (placement.rotationStep ?? 0) * (Math.PI / 2);
  root.updateMatrixWorld(true);
  return true;
}

/**
 * @param {import('three').Object3D | null | undefined} terrainRoot
 * @param {import('three').Material} grassMaterial
 * @param {{ x: number, y: number }} placement
 * @returns {boolean}
 */
export function restoreGrassMaterialOnTerrainTile(terrainRoot, grassMaterial, placement) {
  const port = getTerrainSceneTilePort(terrainRoot);
  if (!port?.hasSurfaceMesh()) return false;

  port.setSurfaceMaterial(grassMaterial);
  const root = port.root;
  root.name = 'grass';
  root.userData.id = 'grass';
  root.userData.type = 'grass';
  root.userData.isRoad = false;
  root.rotation.y = 0;
  root.userData.x = placement.x;
  root.userData.y = placement.y;
  delete root.userData.instanceId;
  return true;
}
