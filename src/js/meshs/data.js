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
export const meshNameMapping = {
    'Windmill': 'Windmill-001',  // Main windmill
    'Windmill-001': 'Windmill-001',  // Windmill.001
    'Windmill-002': 'Windmill-001',  // Windmill.002
    'Windmill-003': 'Windmill-001',  // Windmill.003
    // Legacy mappings
    'Windmill-1': 'Windmill-001',
    'Windmill_1': 'Windmill-001',
    'Windmill_001': 'Windmill-001',
    'Windmill_1_': 'Windmill-001',
    'Windmill1': 'Windmill-001',
};
