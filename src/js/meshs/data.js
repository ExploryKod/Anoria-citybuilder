import * as THREE from "three";

const loader = new THREE.TextureLoader();

export function loadTextures(path) {
    const texture = loader.load(path)
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1,1);
    texture.flipY = false;
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
    'nofood': loadTextures(`/resources/textures/status/nofood.png`)
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

    // Markets
    'Market-Stall': { price: 10, category: 'markets' }
});

export const wantedHouses = [
    'House-Blue',
    'House-Red',
    'House-Purple',
    'House-2Story'
]
