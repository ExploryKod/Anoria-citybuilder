/**
 * Rendu sprite "no-road" sur un mesh Three.js (infrastructure Parcels).
 */

/**
 * @param {Object} params
 * @param {Object} params.assetManager
 * @param {import('three').Object3D} params.mesh
 * @param {Object} params.textures
 * @param {Object} params.position
 * @param {Object} params.scale
 * @param {boolean} params.hasAccess
 */
export function setRoadAccessIcon({ assetManager, mesh, textures, position, scale, hasAccess }) {
  if (!mesh || !assetManager || !textures) return;

  // Read by the presentation to order the status layers: no road → only the
  // no-road icon (there can be no worker), no worker → only the no-work icon.
  if (mesh.userData) {
    mesh.userData.hasRoadAccess = hasAccess;
  }

  assetManager.setStatusSprite(
    mesh,
    textures['no-roads'],
    'no-road',
    scale,
    position,
    !hasAccess
  );
}
