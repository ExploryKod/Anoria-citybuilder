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
    'nofood': loadTextures(`/resources/textures/status/nofood.png`, true)
})

export const assetsPrices = Object.freeze({
    // Zones
    'grass': { price: 0, category: 'zones' },
    'roads': { price: 5, category: 'zones' },

    // Houses
    'House-Blue': { price: 10, category: 'houses' },
    'House-Red': { price: 10, category: 'houses' },
    'House-Purple': { price: 10, category: 'houses' },
    'House-2Story': { price: 20, category: 'houses' },

    // Tombs
    'Tombstone-1': { price: 2, category: 'tombs' },
    'Tombstone-2': { price: 4, category: 'tombs' },
    'Tombstone-3': { price: 8, category: 'tombs' },

    // Farms
    'Farm-Wheat': { price: 10, category: 'farms' },
    'Farm-Carrot': { price: 20, category: 'farms' },
    'Farm-Cabbage': { price: 30, category: 'farms' },
    'Windmill-001': { price: 50, category: 'farms' },

    // Markets
    'Market-Stall': { price: 10, category: 'markets' }
});

export const wantedHouses = [
    'House-Blue',
    'House-Red',
    'House-Purple',
    'House-2Story'
]

// Mapping of GLB mesh names to tool names
// From the GLTF export, we have mesh names like:
// - Windmill_Material005_0 → becomes "Windmill" (no number)
// - Windmill001_Material005_0 → becomes "Windmill001"
// - Windmill002_Material005_0 → becomes "Windmill002"
// - Windmill003_Material005_0 → becomes "Windmill003"
// We map all these to "Windmill-001" for consistency
export const meshNameMapping = {
    'Windmill': 'Windmill-001',      // Windmill_Material005_0 (main windmill, no number)
    'Windmill001': 'Windmill-001',    // Windmill001_Material005_0
    'Windmill002': 'Windmill-001',    // Windmill002_Material005_0
    'Windmill003': 'Windmill-001',    // Windmill003_Material005_0
};
