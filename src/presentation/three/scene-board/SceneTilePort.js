/** @typedef {'terrain'|'building'|'nature'} SceneTileLayer */

/**
 * Port between scene orchestration and Three.js adapters.
 * Scene code should depend on this contract, not mesh types.
 *
 * @typedef {object} SceneTilePort
 * @property {import('three').Object3D} root
 * @property {number} x
 * @property {number} y
 * @property {SceneTileLayer} layer
 * @property {string} logicalId
 * @property {boolean} participatesInPick
 * @property {() => import('three').Object3D} getPickRoot
 * @property {() => import('three').Box3} getBounds
 * @property {() => import('three').Mesh|null} getSurfaceMesh
 * @property {(material: import('three').Material) => void} setSurfaceMaterial
 * @property {() => boolean} hasSurfaceMesh
 */

export const SCENE_TILE_PORT_KEY = 'sceneTilePort';

/**
 * @param {SceneTilePort} port
 * @returns {SceneTilePort}
 */
export function attachSceneTilePort(port) {
  port.root.userData = {
    ...(port.root.userData ?? {}),
    [SCENE_TILE_PORT_KEY]: port,
    x: port.x,
    y: port.y,
    id: port.logicalId,
  };
  return port;
}

/**
 * @param {import('three').Object3D | null | undefined} object
 * @returns {SceneTilePort | null}
 */
export function getSceneTilePortFromObject(object) {
  let current = object ?? null;
  while (current) {
    const port = current.userData?.[SCENE_TILE_PORT_KEY];
    if (port) return port;
    current = current.parent;
  }
  return null;
}
