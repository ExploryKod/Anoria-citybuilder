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
    // No worker sprite (red) - shown when building has no employees
    'no-work': loadTextures(`/resources/textures/status/no-work.png`, true)
})

export const assetsPrices = Object.freeze({
    // Zones
    'grass': { price: 0, category: 'zones', gridSize: 1 },
    'roads': { price: 5, category: 'zones', gridSize: 1 },
    'terrain': { price: 0, category: 'zones', gridSize: 1 },

    // Houses
    'House-Blue': { price: 10, category: 'houses', gridSize: 1 },
    'House-Red': { price: 10, category: 'houses', gridSize: 1 },
    'House-Purple': { price: 10, category: 'houses', gridSize: 1 },
    
    // Palaces
    'House-2Story': { price: 20, category: 'palaces', gridSize: 1 },

    // Tombs
    'Tombstone-1': { price: 2, category: 'tombs', gridSize: 1 },
    'Tombstone-2': { price: 4, category: 'tombs', gridSize: 1 },
    'Tombstone-3': { price: 8, category: 'tombs', gridSize: 1 },

    // Farms (only fields)
    'Farm-Wheat': { price: 10, category: 'farms', gridSize: 1 },
    'Farm-Carrot': { price: 20, category: 'farms', gridSize: 1 },
    'Farm-Cabbage': { price: 30, category: 'farms', gridSize: 1 },
    
    // Industry (agricultural industry)
    'Windmill-001': { price: 50, category: 'industry', gridSize: 1 },
    'Barn-001': { price: 40, category: 'industry', gridSize: 1 },

    // Markets
    'Market-Stall': { price: 10, category: 'markets', gridSize: 1 },
    
    // Infrastructure
    'Well-001': { price: 15, category: 'infrastructure', gridSize: 1 },
    'Fountain-001': { price: 25, category: 'infrastructure', gridSize: 1 },
    'Streetlight-001': { price: 5, category: 'infrastructure', gridSize: 1 },
    
    // Public Buildings
    'Church-002': { price: 100, category: 'public', gridSize: 3 }
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
    // Windmill variants
    'Windmill': 'Windmill-001',
    'Windmill001': 'Windmill-001',
    'Windmill002': 'Windmill-001',
    'Windmill003': 'Windmill-001',
    
    // Barn variants
    'Barn': 'Barn-001',
    'Barn001': 'Barn-001',
    
    // Well variants
    'Well': 'Well-001',
    'Well001': 'Well-001',
    
    // Fountain variants
    'Fountain': 'Fountain-001',
    'Fountain001': 'Fountain-001',
    
    // Streetlight variants (001-017 all map to Streetlight-001)
    'Streetlight': 'Streetlight-001',
    'Streetlight001': 'Streetlight-001',
    'Streetlight002': 'Streetlight-001',
    'Streetlight003': 'Streetlight-001',
    'Streetlight004': 'Streetlight-001',
    'Streetlight005': 'Streetlight-001',
    'Streetlight006': 'Streetlight-001',
    'Streetlight007': 'Streetlight-001',
    'Streetlight008': 'Streetlight-001',
    'Streetlight009': 'Streetlight-001',
    'Streetlight010': 'Streetlight-001',
    'Streetlight011': 'Streetlight-001',
    'Streetlight012': 'Streetlight-001',
    'Streetlight013': 'Streetlight-001',
    'Streetlight014': 'Streetlight-001',
    'Streetlight016': 'Streetlight-001',
    'Streetlight017': 'Streetlight-001',
    
    // Church
    'Church002': 'Church-002',
    
    // House 2 Story variants
    'House_2Story': 'House-2Story',
    'House_2Story_Purple': 'House-2Story',
    'House_2Story_Purple001': 'House-2Story',
    'House_2Story_Purple002': 'House-2Story',
    'House_2Story_Purple003': 'House-2Story',
    'House_2Story_Purple004': 'House-2Story',
    'House_2Story_Purple005': 'House-2Story',
    'House_2Story_Purple006': 'House-2Story',
    'House_2Story_Purple007': 'House-2Story',
    'House_2Story_Purple008': 'House-2Story',
    'House_2Story_Purple009': 'House-2Story'
};
