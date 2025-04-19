import * as THREE from "three";

function getBuildingZonesNeighbors(data, area=1) {

    const { city, buildings, x, y, currentBuildingId, terrain } = data;
 
     // South
     const neighborSouth = city.tiles[x]?.[y + area];
     const terrainS = terrain[x]?.[y + area];
 
     // North-East
     const neighborNorthEast = city.tiles[x + area]?.[y - 1];
     const terrainNE = terrain[x + area]?.[y - area];
   
     // East
     const neighborEast = city.tiles[x + area]?.[y];
     const terrainE = terrain[x + area]?.[y];
 
 
     // South-East
     const neighborSouthEast = city.tiles[x + area]?.[y + area];
     const terrainSE = terrain[x + area]?.[y + area];
 
 
     // North
     const neighborNorth = city.tiles[x]?.[y - area];
     const terrainN = terrain[x]?.[y - area];
 
 
     // South-West
     const neighborSouthWest = city.tiles[x - area]?.[y + area];
     const terrainSW = terrain[x - area]?.[y + area];
  
 
     // West
     const neighborWest = city.tiles[x - area]?.[y];
     const terrainW = terrain[x - area]?.[y];
    
 
     // North-West
     const neighborNorthWest = city.tiles[x - area]?.[y - area];
     const terrainNW = terrain[x - area]?.[y - area];

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
    console.log("Terrain mesh > ", terrain)
    
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

    const allBuildingsInZone = allTerrainMeshInZone.filter((mesh) => mesh.name !== 'grass')

    const areaObject = {areaKey : areaKey, time: time, allTerrainMeshInZone : allTerrainMeshInZone}

    if (!Object.hasOwn(buildings[x][y].userData, 'neighborZones')) {
        buildings[x][y].userData.neighborZones = {};
    }

    Object.assign(buildings[x][y].userData, { neighborS: neighbors.neighborSouth?.buildingId });
    Object.assign(buildings[x][y].userData, { neighborE: neighbors.neighborEast?.buildingId });
    Object.assign(buildings[x][y].userData, { neighborNE: neighbors.neighborNorthEast?.buildingId });
    Object.assign(buildings[x][y].userData, { neighborSE: neighbors.neighborSouthEast?.buildingId });
    Object.assign(buildings[x][y].userData, { neighborN: neighbors.neighborNorth?.buildingId });
    Object.assign(buildings[x][y].userData, { neighborSW: neighbors.neighborSouthWest?.buildingId });
    Object.assign(buildings[x][y].userData, { neighborW: neighbors.neighborWest?.buildingId });
    Object.assign(buildings[x][y].userData, { neighborNW: neighbors.neighborNorthWest?.buildingId });

 

  
    // Add all neighbors to a single array for convenience
    Object.assign(buildings[x][y].userData, {
        neighbors: [
            neighbors.neighborNorth,
            neighbors.neighborNorthWest,
            neighbors.neighborNorthEast,
            neighbors.neighborEast,
            neighbors.neighborSouthEast,
            neighbors.neighborSouthWest,
            neighbors.neighborSouth,
            neighbors.neighborWest,
        ],
    });

      // Add all neighbors to a single array for convenience
      Object.assign(buildings[x][y].userData, {
        neighborsNames: [
            neighbors.neighborNorth.buildingId,
            neighbors.neighborNorthWest.buildingId,
            neighbors.neighborNorthEast.buildingId,
            neighbors.neighborEast.buildingId,
            neighbors.neighborSouthEast.buildingId,
            neighbors.neighborSouthWest.buildingId,
            neighbors.neighborSouth.buildingId,
            neighbors.neighborWest.buildingId,
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

            console.log(`Building zones for area key on time ${time}: ` + areaKey, buildingZones);
            const areaKeyObj = buildings[x][y].userData.neighborZones[areaKey]
            console.log(`Area key obj `, areaKeyObj)
            if(areaKeyObj && Object.hasOwn(areaKeyObj, 'time') && areaKeyObj.time === time) {
                console.warn(`time for area key on time ${time}`)
            }   
            
           
           
        }
    } 

    Object.assign(buildings[x][y].userData, {
        neighborsTerrainNames: [
            neighbors.terrainN.name,
            neighbors.terrainNW.name,
            neighbors.terrainNE.name,
            neighbors.terrainE.name,
            neighbors.terrainSE.name,
            neighbors.terrainSW.name,
            neighbors.terrainS.name,
            neighbors.terrainW.name
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


    console.log(
        `Building in zones ${area.toString()} on day ${time} for ${currentBuildingId} at x: ${x}, y: ${y} ==> `,
        buildings[x][y].userData.neighborZones 
    );

    console.log(
        `Building neighbors of ${currentBuildingId} at x: ${x}, y: ${y} ==> `,
        buildings[x][y].userData.neighbors
    );

    console.log(
        `Terrain neighbors of ${currentBuildingId} at x: ${x}, y: ${y} ==> `,
        buildings[x][y].userData.neighborsMeshs
    );

    console.log(
        `Neighbors Terrain ids of ${currentBuildingId} at x: ${x}, y: ${y} ==> `,
        buildings[x][y].userData.neighborsUserDataIds
    );

    console.log(
        `Neighbors Terrain Names of ${currentBuildingId} at x: ${x}, y: ${y} ==> `,
        buildings[x][y].userData.neighborsTerrainNames
    );


    console.log(
        `Building neighbors Names of ${currentBuildingId} at x: ${x}, y: ${y} ==> `,
        buildings[x][y].userData.neighborsNames
    );

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

export const zoneBordersBuildings = (buildingData, time=0) => {

    const { buildings, x, y, currentBuildingId } = buildingData;
    const theCurrentBuilding = currentBuildingId

    if (x == null || y == null) {
        console.warn('[zoneBordersBuildings] y and x coordinates have wrong values');
        return false;
    }

    // Helper function to safely get buildingId
    // const getBuildingId = (tile) => tile.buildingId || null;

    // Retrieve neighboring tiles and their buildingId
    // const allImmediateNeighborsNames = [
    //     getBuildingId(city.tiles[x]?.[y + zoneLength]),      // South
    //     getBuildingId(city.tiles[x + zoneLength]?.[y + zoneLength]), // North-East
    //     getBuildingId(city.tiles[x + zoneLength]?.[y]),     // East
    //     getBuildingId(city.tiles[x + zoneLength]?.[y - zoneLength]), // South-East
    //     getBuildingId(city.tiles[x]?.[y - zoneLength]),     // North
    //     getBuildingId(city.tiles[x - zoneLength]?.[y - zoneLength]), // South-West
    //     getBuildingId(city.tiles[x - zoneLength]?.[y]),     // West
    //     getBuildingId(city.tiles[x - zoneLength]?.[y + zoneLength]), // North-West
    // ];

    let meshs = [];
    if(buildings) {
        buildings.filter(building => building).forEach(building => {
            let temp = [];
            if(Array.isArray(building)) {
                building.filter(mesh => mesh && mesh.name && mesh.position).forEach(mesh => {
                    const deltaX = Math.abs(mesh.position.x - x);
                    const deltaZ = Math.abs(mesh.position.z - y); // Note: y represents mesh.position.z
                    // Calculate the zone based on the maximum delta of x or z
                    const zone = Math.max(deltaX, deltaZ);
                    let neighborData = {
                        building: theCurrentBuilding + '-' + mesh.position.x + '-' + mesh.position.z,
                        time: time,
                        name: mesh.name,
                        id : mesh.name + '-' + mesh.position.x + '-' + mesh.position.z,
                        x: mesh.position.x,
                        y: mesh.position.z,
                        deltaX: deltaX,
                        deltaZ: deltaZ,
                        zone: zone
                    };

                    if(Object.hasOwn(mesh, 'userData')) {
                        if(Object.hasOwn(mesh.userData, 'stocks')) {
                           neighborData = { ...neighborData, stocks: mesh.userData.stocks };
                        }
                    }

                    temp.push(neighborData);
                })
                console.log("[UTILS ZONE BORDERS] buildings meshs", meshs)
                // Filter out null values
            }
            meshs.push(...new Set(temp));
        })
    }

   return [...new Set(meshs)];
};

export function getBuildingsNamesInZone(buildingData, time=0, targets = {buildingTarget: "", zones: []}) {
    let zoneBuildings = [];

    if (!buildingData) {
        console.warn('[getBuildingsInZone] buildingData must not be undefined');
        return;
    }

    if(!Object.hasOwn(targets, 'buildingTarget') || !Object.hasOwn(targets, 'zones')) {
        console.error('[getBuildingsInZone] ket buildingTarget or zones are missing from targets object third argument');
        return;
    }

    const { x, y } = buildingData
    zoneBuildings = zoneBordersBuildings(buildingData, time);

    if(targets.buildingTarget !== "" && targets.zones.length > 0) {
        // house is filtered also to match a specific building
        return zoneBuildings.filter(buildingId => (buildingId.name === targets.buildingTarget) && targets.zones.includes(buildingId.zone));
    }

    if(targets.buildingTarget !== "") {
        // house is filtered also to match a specific building
        return zoneBuildings.filter(buildingId => (buildingId.name === targets.buildingTarget));
    }

    if(targets.zones.length > 0) {
        return zoneBuildings.filter(building => targets.zones.includes(building.zone))
    }
    // only filtered to not add herself as neighbour (through x and y coordinate) (! z from position is y in userData here)
    return zoneBuildings
}


/**
 * Get a neighbor buildingId by its geographical position
 * @param {Object} building - The building object building[x][y]
 * @param {Array} neighbors
 */
export function getBuildingNeighbors(building, neighbors=[]) {
    if(!building.userData || !building.userData.neighborsNames || neighbors.length <= 0) {
        return false
    }
    const neighborNameFound = building.userData.neighborsNames.find((neighborName) => neighbors.includes(neighborName));
    return neighborNameFound ? neighborNameFound : false;
}

/**
 * create a suitable object to store as the database primary key or IndexDB unique keypath
 * @param {String} currentBuildingId - The game name of building id
 * @param {number} x - The x-coordinate of the current building in the grid.
 * @param {number} y - The y-coordinate of the current building in the grid.
 * @return {String} - The formatted unique key for indexDB or another database as buildingId-x-y
 */
export function makeDbItemId(currentBuildingId, x, y) {

    if(!currentBuildingId) {
        console.warn('there is no current building suitable id', currentBuildingId);
        return false;
    }

    if(x && y && currentBuildingId.length > 0) {
        return currentBuildingId + '-' + x + '-' + y;
    } else {
        console.warn('there is no current building suitable id or x/y suitable coordinates')
        return false
    }
}

/*
 * Function to create a building info text
 * @param {String} textContent - The text content to be displayed in the info building
 * @param {Boolean} isHTMLReset - Whether to reset the current info building text or not
 */
export function makeInfoBuildingText(textContent, isHTMLReset=true) {
    const infoObjectContent = document.querySelector('.info-building__body');
    
    if(!infoObjectContent) {
        console.warn('there is no info objects content wrapper div with class info-building__body');
        return false;
    }

    if(isHTMLReset) {
        infoObjectContent.innerHTML = ""
    }
    const buildingText = document.createElement('p');
    buildingText.classList.add('anoria-text');
    buildingText.classList.add('info-building-item');
    buildingText.textContent = textContent
    infoObjectContent.appendChild(buildingText);
}


export function getAssetPrice(buildingId, assetsPrices) {
    // Developer warnings in non-production environments
    if (process.env.NODE_ENV !== 'production') {
        // Warn if parameters are missing
        if (buildingId === undefined || buildingId === null) {
            console.warn(
                '[getAssetPrice] Warning: buildingId is required but received:',
                buildingId
            );
        }

        if (assetsPrices === undefined) {
            console.warn(
                '[getAssetPrice] Warning: assetsPrices is required but received undefined'
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

        if (typeof assetsPrices !== 'object' || assetsPrices === null) {
            console.warn(
                '[getAssetPrice] Warning: assetsPrices should be an object but received:',
                typeof assetsPrices
            );
            return null;
        }

        // Existence checking
        if (buildingId && !assetsPrices[buildingId]) {
            console.warn(
                `[getAssetPrice] Warning: No price found for buildingId: "${buildingId}"`
            );
        }

        // Price type checking
        if (buildingId &&
            assetsPrices[buildingId] &&
            typeof assetsPrices[buildingId].price !== 'number'
        ) {
            console.warn(
                `[getAssetPrice] Warning: Invalid price type for buildingId "${buildingId}":`,
                typeof assetsPrices[buildingId].price
            );
        }
    }

    // Original function logic remains unchanged
    if (!assetsPrices) {
        return null;
    }

    return assetsPrices[buildingId]?.price;
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
getAssetPrice('house', null);             // Returns null, warns about invalid assetsPrices
getAssetPrice(undefined, prices);         // Returns undefined, warns about missing buildingId
*/

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