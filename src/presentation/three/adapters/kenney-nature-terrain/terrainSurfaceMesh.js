import * as THREE from 'three';

/**
 * Legacy grass is a single Mesh; Kenney terrain is a Group.
 * Road material swaps need the drawable surface mesh.
 *
 * @param {THREE.Object3D | null | undefined} terrainNode
 * @returns {THREE.Mesh | null}
 */
export function getTerrainSurfaceMesh(terrainNode) {
  if (!terrainNode) return null;
  if (terrainNode instanceof THREE.Mesh) return terrainNode;

  const cached = terrainNode.userData?.kenneyTerrainSurfaceMesh;
  if (cached instanceof THREE.Mesh) return cached;

  let found = null;
  terrainNode.traverse((child) => {
    if (!found && child instanceof THREE.Mesh && child.geometry) {
      found = child;
    }
  });
  return found;
}

/**
 * @param {THREE.Object3D | null | undefined} terrainNode
 * @param {THREE.Material} material
 * @returns {THREE.Mesh | null}
 */
export function setTerrainSurfaceMaterial(terrainNode, material) {
  const mesh = getTerrainSurfaceMesh(terrainNode);
  if (mesh) {
    mesh.material = material;
  }
  return mesh;
}
