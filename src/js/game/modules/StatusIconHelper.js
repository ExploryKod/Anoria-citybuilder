/**
 * StatusIconHelper - Centralized helpers for toggling status icons on meshes
 * Non-invasive utility to avoid duplicating sprite logic
 */

/**
 * Sets the road access status sprite visibility on a mesh
 * @param {Object} params
 * @param {Object} params.assetManager - Asset manager instance
 * @param {THREE.Object3D} params.mesh - Target mesh
 * @param {Object} params.textures - Textures map (expects 'no-roads')
 * @param {Object} params.position - Sprite position {x,y,z}
 * @param {Object} params.scale - Sprite scale {x,y,z}
 * @param {boolean} params.hasAccess - Whether the building has road access
 */
export function setRoadAccessIcon({ assetManager, mesh, textures, position, scale, hasAccess }) {
    if (!mesh || !assetManager || !textures) return;

    assetManager.setStatusSprite(
        mesh,
        textures['no-roads'],
        'no-road',
        scale,
        position,
        !hasAccess
    );
}


