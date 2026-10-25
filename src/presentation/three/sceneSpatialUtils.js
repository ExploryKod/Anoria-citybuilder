import * as THREE from "three";

export function getAssetPrice(buildingId, priceCatalog) {
    // Developer warnings in non-production environments
    if (process.env.NODE_ENV !== 'production') {
        // Warn if parameters are missing
        if (buildingId === undefined || buildingId === null) {
            console.warn(
                '[getAssetPrice] Warning: buildingId is required but received:',
                buildingId
            );
        }

        if (priceCatalog === undefined) {
            console.warn(
                '[getAssetPrice] Warning: priceCatalog is required but received undefined'
            );
            return null;
        }

        // Type checking warnings
        if (typeof buildingId !== 'string') {
            console.warn(
                '[getAssetPrice] Warning: buildingId should be a string but received:',
                typeof buildingId
            );
        }

        if (typeof priceCatalog !== 'object' || priceCatalog === null) {
            console.warn(
                '[getAssetPrice] Warning: priceCatalog should be an object but received:',
                typeof priceCatalog
            );
            return null;
        }

        // Existence checking
        if (buildingId && !priceCatalog[buildingId]) {
            console.warn(
                `[getAssetPrice] Warning: No price found for buildingId: "${buildingId}"`
            );
        }

        // Price type checking
        if (buildingId &&
            priceCatalog[buildingId] &&
            typeof priceCatalog[buildingId].price !== 'number'
        ) {
            console.warn(
                `[getAssetPrice] Warning: Invalid price type for buildingId "${buildingId}":`,
                typeof priceCatalog[buildingId].price
            );
        }
    }

    // Original function logic remains unchanged
    if (!priceCatalog) {
        return null;
    }

    return priceCatalog[buildingId]?.price;
}

// Example usage:
/*
const prices = {
    'house': { price: 100 },
    'invalid': { price: '100' }, // Invalid price type
};

getAssetPrice('house', prices);           // Returns 100
getAssetPrice('farm', prices);            // Returns undefined, warns about missing price
getAssetPrice('invalid', prices);         // Returns '100', warns about invalid price type
getAssetPrice(123, prices);               // Returns undefined, warns about invalid buildingId type
getAssetPrice('house', null);             // Returns null, warns about invalid priceCatalog
getAssetPrice(undefined, prices);         // Returns undefined, warns about missing buildingId
*/

// Check if an area is available for a building of the specified size
export function isAreaAvailableForBuilding(city, x, y, gridSize) {
    if (gridSize === undefined || gridSize === null || gridSize < 1) {
        console.warn('[isAreaAvailableForBuilding] Invalid gridSize:', gridSize);
        return false;
    }
    
    // Check if all tiles in the area are within bounds and unoccupied
    for (let dx = 0; dx < gridSize; dx++) {
        for (let dy = 0; dy < gridSize; dy++) {
            const checkX = x + dx;
            const checkY = y + dy;
            
            // Check bounds
            if (checkX >= city.size || checkY >= city.size) {
                return false;
            }
            
            // Check if tile is occupied
            if (city.tiles[checkX] && city.tiles[checkX][checkY]) {
                if (city.tiles[checkX][checkY].buildingId !== undefined) {
                    return false;
                }
            }
        }
    }
    
    return true;
}

// Get all buildings in a category
export function getAssetsByCategory(category, assets) {
    return Object.entries(assets)
        .filter(([_, building]) => building.category === category)
        .map(([id, building]) => ({ id, ...building }));
}

// Update prices - returns new buildings object
export function updateAssetsPrices(updates, assets) {
    return Object.freeze({
        ...assets,
        ...Object.fromEntries(
            Object.entries(updates).map(([id, price]) => [
                id,
                {
                    ...assets[id],
                    price: typeof price === 'number' ? price : price.price
                }
            ])
        )
    });
}

// Example usage:
/*
// Get price
const wheatPrice = getPrice('Farm-Wheat');

// Get category
const allFarms = getBuildingsByCategory('farms');

// Update prices
const newBuildings = updatePrices({
  'grass': 10,
  'Farm-Carrot': 25
});
*/

export function getPositionOnScreen(renderer, camera, object3d) {
    const vector = new THREE.Vector3();
    object3d.getWorldPosition(vector).project(camera);
    const domRect = renderer.domElement.getBoundingClientRect();

    // On passe des coordonnées dans le repère normalisé (NDC) aux
    // coordonnées de l'écran
    vector.x = Math.round((vector.x + 1) / 2 * domRect.width) + domRect.left;
    vector.y = Math.round((1 - vector.y) / 2 * domRect.height) + domRect.top;

    return vector;
}

// var camera = new THREE.PerspectiveCamera(75, 1, 0.5, 1000);
//
// function updateViewportSize() {
//     camera.aspect = window.innerWidth / window.innerHeight;
//     camera.updateProjectionMatrix()
//     renderer.setSize(window.innerWidth, window.innerHeight);
// }
//
// window.addEventListener("resize", updateViewportSize);
// updateViewportSize();