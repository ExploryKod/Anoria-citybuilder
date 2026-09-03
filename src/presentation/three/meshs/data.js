import * as THREE from "three";

const loader = new THREE.TextureLoader();

export function loadTextures(path, flipY = false) {
    const texture = loader.load(path)
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1,1);
    texture.flipY = flipY;
    return texture;
}

export const textures = Object.freeze({
    'roads': loadTextures(`/resources/textures/grounds/ground_cobblestone5.png`),
    'grass': loadTextures(`/resources/textures/grounds/grass_rough2.png`),
    'decal': loadTextures(`/resources/textures/skies/plain_sky.jpg`),
    'no-roads': loadTextures(`/resources/textures/status/no-road.png`),
    'no-power': loadTextures(`/resources/textures/status/no-road.png`),
    'base' : loadTextures(`/resources/textures/maps/base.png`),
    'specular' : loadTextures(`/resources/textures/maps/specular.png`),
    'grid': loadTextures(`/resources/textures/maps/grid.png`),
    'nofood': loadTextures(`/resources/textures/status/nofood.png`, true),
    // Farm season sprites
    'grow-food': loadTextures(`/resources/textures/status/grow_food.png`, true),
    'harvest': loadTextures(`/resources/textures/status/harvest.png`, true),
    'sell-food': loadTextures(`/resources/textures/status/sell_food.png`, true),
    // Market buying sprite
    'isBuying': loadTextures(`/resources/textures/status/isBuying.png`, true),
    // Windmill collecting sprite (reuse isBuying icon)
    'isCollecting': loadTextures(`/resources/textures/status/isBuying.png`, true),
    // No worker sprite (black) - shown when building has no employees
    'no-work': loadTextures(`/resources/textures/status/no-work.png`, true)
})

// Economy catalog (buildingPlacementCatalog, type lists) → src/shared/building-catalog/
// Raw-GLB-mesh-name → canonical id resolution → resolveMeshAlias.js (reads
// geometry.aliases straight off the declarative catalogs, no separate table here).
