import * as THREE from "three";

function getBuildingZonesNeighbors(data, area=1) {

    const { city, buildings, x, y, currentBuildingId, terrain } = data;

    // Helper: prefer building over terrain if building exists and is not grass
    // This ensures StonePath (roads) in buildings array are detected as neighbors
    const getNeighborMesh = (nx, ny) => {
        const buildingMesh = buildings?.[nx]?.[ny];
        const terrainMesh = terrain?.[nx]?.[ny];
        // Prefer building if it exists and is not grass (roads, houses, etc.)
        if (buildingMesh && buildingMesh.name !== 'grass') {
            return buildingMesh;
        }
        return terrainMesh;
    };
 
     // South
     const neighborSouth = city.tiles[x]?.[y + area];
     const terrainS = getNeighborMesh(x, y + area);
 
     // North-East
     const neighborNorthEast = city.tiles[x + area]?.[y - 1];
     const terrainNE = getNeighborMesh(x + area, y - area);
   
     // East
     const neighborEast = city.tiles[x + area]?.[y];
     const terrainE = getNeighborMesh(x + area, y);
 
 
     // South-East
     const neighborSouthEast = city.tiles[x + area]?.[y + area];
     const terrainSE = getNeighborMesh(x + area, y + area);
 
 
     // North
     const neighborNorth = city.tiles[x]?.[y - area];
     const terrainN = getNeighborMesh(x, y - area);
 
 
     // South-West
     const neighborSouthWest = city.tiles[x - area]?.[y + area];
     const terrainSW = getNeighborMesh(x - area, y + area);
  
 
     // West
     const neighborWest = city.tiles[x - area]?.[y];
     const terrainW = getNeighborMesh(x - area, y);
    
 
     // North-West
     const neighborNorthWest = city.tiles[x - area]?.[y - area];
     const terrainNW = getNeighborMesh(x - area, y - area);

     return {
        neighborSouth,
        neighborNorthEast,
        neighborEast,
        neighborSouthEast,
        neighborNorth,
        neighborSouthWest,
        neighborWest,
        neighborNorthWest,
        terrainS,
        terrainNE,
        terrainE,
        terrainSE,
        terrainN,
        terrainSW,
        terrainW,
        terrainNW,
        currentBuildingId,
        terrain,
     }
}

/**
 * Updates the neighbor data for a building in the city grid.
 * @returns {void}
 * @param buildingData
 * @param area
 * @param time
 */
export function updateBuildingNeighbors(buildingData, area=1, time=0) {

    const { city, buildings, x, y, currentBuildingId, terrain } = buildingData;
    // Processing terrain mesh
    
    const neighbors =  getBuildingZonesNeighbors(buildingData, area)
    const areaKey = 'area' + '_' + area.toString();
    const allTerrainMeshInZone = [
        neighbors.terrainN,
        neighbors.terrainNW,
        neighbors.terrainNE,
        neighbors.terrainE,
        neighbors.terrainSE,
        neighbors.terrainSW,
        neighbors.terrainS,
        neighbors.terrainW
    ]

    // Filter out undefined values first, then check for grass (roads are included - they have isRoad property)
    // Roads should be included in neighbors for road access detection
    const allBuildingsInZone = allTerrainMeshInZone.filter((mesh) => 
        mesh && mesh.name && mesh.name !== 'grass'
    )

    const areaObject = {areaKey : areaKey, time: time, allTerrainMeshInZone : allTerrainMeshInZone}

    // Safety check: ensure buildings[x][y] exists before accessing userData
    if (!buildings[x] || !buildings[x][y] || !buildings[x][y].userData) {
        console.warn(`[updateBuildingNeighbors] Building at [${x}][${y}] does not exist or has no userData`);
        return;
    }

    if (!Object.hasOwn(buildings[x][y].userData, 'neighborZones')) {
        buildings[x][y].userData.neighborZones = {};
    }

    const instanceIdFromMesh = (mesh) =>
        typeof mesh?.userData?.instanceId === 'string' ? mesh.userData.instanceId : undefined;

    Object.assign(buildings[x][y].userData, { neighborS: instanceIdFromMesh(neighbors.terrainS) });
    Object.assign(buildings[x][y].userData, { neighborE: instanceIdFromMesh(neighbors.terrainE) });
    Object.assign(buildings[x][y].userData, { neighborNE: instanceIdFromMesh(neighbors.terrainNE) });
    Object.assign(buildings[x][y].userData, { neighborSE: instanceIdFromMesh(neighbors.terrainSE) });
    Object.assign(buildings[x][y].userData, { neighborN: instanceIdFromMesh(neighbors.terrainN) });
    Object.assign(buildings[x][y].userData, { neighborSW: instanceIdFromMesh(neighbors.terrainSW) });
    Object.assign(buildings[x][y].userData, { neighborW: instanceIdFromMesh(neighbors.terrainW) });
    Object.assign(buildings[x][y].userData, { neighborNW: instanceIdFromMesh(neighbors.terrainNW) });

    // Voisins métier : BC Parcels (IndexedDB / getNeighbors). Ici : meshes pour hover UI.

      Object.assign(buildings[x][y].userData, {
        neighborInstanceIds: [
            instanceIdFromMesh(neighbors.terrainN),
            instanceIdFromMesh(neighbors.terrainNW),
            instanceIdFromMesh(neighbors.terrainNE),
            instanceIdFromMesh(neighbors.terrainE),
            instanceIdFromMesh(neighbors.terrainSE),
            instanceIdFromMesh(neighbors.terrainSW),
            instanceIdFromMesh(neighbors.terrainS),
            instanceIdFromMesh(neighbors.terrainW),
        ],
    });

    Object.assign(buildings[x][y].userData, {
        neighborsMeshs: [
            neighbors.terrainN,
            neighbors.terrainNW,
            neighbors.terrainNE,
            neighbors.terrainE,
            neighbors.terrainSE,
            neighbors.terrainSW,
            neighbors.terrainS,
            neighbors.terrainW
        ]
    });

    if(Object.hasOwn(buildings[x][y].userData, `neighborZones`)) {
        const buildingZones = buildings[x][y].userData.neighborZones
        if(!Object.hasOwn(buildingZones, areaKey)) {

            Object.assign(buildings[x][y].userData.neighborZones, {
                [areaKey]: areaObject       
            });

            // Building zones processing
            const areaKeyObj = buildings[x][y].userData.neighborZones[areaKey]
            if(areaKeyObj && Object.hasOwn(areaKeyObj, 'time') && areaKeyObj.time === time) {
                // Time already set for this area key
            }   
            
           
           
        }
    } 

    Object.assign(buildings[x][y].userData, {
        neighborsTerrainNames: [
            neighbors.terrainN?.name,
            neighbors.terrainNW?.name,
            neighbors.terrainNE?.name,
            neighbors.terrainE?.name,
            neighbors.terrainSE?.name,
            neighbors.terrainSW?.name,
            neighbors.terrainS?.name,
            neighbors.terrainW?.name
        ]
    });

    Object.assign(buildings[x][y].userData, {
        neighborsUserDataIds: [
            neighbors.terrainN?.userData?.id,
            neighbors.terrainNW?.userData?.id,
            neighbors.terrainNE?.userData?.id,
            neighbors.terrainE?.userData?.id,
            neighbors.terrainSE?.userData?.id,
            neighbors.terrainSW?.userData?.id,
            neighbors.terrainS?.userData?.id,
            neighbors.terrainW?.userData?.id
        ]
    });


    // Building neighbor data processed

}

export const IsInZoneLimits = (zoneLimit, city) => {

    if(!zoneLimit) {
        console.warn('[IsInZoneLimits] Zone limits must not be undefined');
        return false;
    }

    if(zoneLimit < 0) {
        console.warn('[IsInZoneLimits] Zone limits must be a positive integer');
        return false;
    }

    if(zoneLimit > city.size) {
        console.warn('[IsInZoneLimits] Zone limits must be less than or equal to city size');
        return false;
    }

    return x+1 < zoneLimit && y+1 < zoneLimit && x-1 > 0 && y-1 > 0
}

export { getBuildingsNamesInZone, zoneBordersBuildings } from '../../contexts/parcels/infrastructure/spatial/sceneNeighborhoodScan.js';

/**
 * Get a neighbor instanceId by matching against known neighbor UUIDs on the mesh.
 * @param {Object} building - The building object building[x][y]
 * @param {Array<string>} instanceIds
 */
export function getBuildingNeighbors(building, instanceIds = []) {
    if(!building.userData || !building.userData.neighborInstanceIds || instanceIds.length <= 0) {
        return false
    }
    const neighborIdFound = building.userData.neighborInstanceIds.find((neighborId) => instanceIds.includes(neighborId));
    return neighborIdFound ? neighborIdFound : false;
}

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