import * as THREE from 'three';

/**
 * Manages decorative village elements around the playable area
 */
export class DecorativeVillageManager {
    constructor(scene, assetManager) {
        this.scene = scene;
        this.assetManager = assetManager;
    }

    /**
     * Create decorative village around the playable area
     */
    createDecorativeVillage(citySize = 16) {
        // Remove existing decorative village if it exists
        const existingVillage = this.scene.getObjectByName('decorative-village');
        if (existingVillage) {
            this.scene.remove(existingVillage);
            existingVillage.traverse((child) => {
                if (child.geometry) child.geometry.dispose();
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(mat => mat.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
            });
        }
        
        // Calculate World platform boundaries
        const margin = Math.max(citySize * 0.5, 20);
        const worldPlatformSize = citySize + (margin * 2);
        const worldMinX = -margin;
        const worldMaxX = citySize + margin;
        const worldMinZ = -margin;
        const worldMaxZ = citySize + margin;
        const worldPlatformHeight = 0.2;
        
        // Playable area boundaries
        const playableMinX = 0;
        const playableMaxX = citySize;
        const playableMinZ = 0;
        const playableMaxZ = citySize;
        
        // Create a group for all decorative elements
        const villageGroup = new THREE.Group();
        villageGroup.name = 'decorative-village';
        
        const decorativeElements = [];
        const houseTypes = ['House-Blue', 'House-Red', 'House-Purple'];
        const treeTypes = ['Tree-Pine-001', 'Tree-Square-001', 'Tree-Tall-001'];
        
        // Define hamlet positions
        const hamlets = [
            // North-west hamlet
            {
                centerX: playableMinX - 5,
                centerZ: playableMinZ - 5,
                houses: [
                    { offsetX: -1, offsetZ: -1 },
                    { offsetX: 1, offsetZ: -1 },
                    { offsetX: -1, offsetZ: 1 },
                ],
                trees: [
                    { offsetX: -2, offsetZ: -2 },
                    { offsetX: 2, offsetZ: -2 },
                    { offsetX: -2, offsetZ: 2 },
                ],
                hasMarket: true,
                hasWell: true
            },
            // North-east hamlet
            {
                centerX: playableMaxX + 5,
                centerZ: playableMinZ - 5,
                houses: [
                    { offsetX: -1, offsetZ: -1 },
                    { offsetX: 1, offsetZ: -1 },
                    { offsetX: 1, offsetZ: 1 },
                ],
                trees: [
                    { offsetX: -2, offsetZ: -2 },
                    { offsetX: 2, offsetZ: -2 },
                    { offsetX: 2, offsetZ: 2 },
                ],
                hasMarket: false,
                hasWell: true
            },
            // South-west hamlet
            {
                centerX: playableMinX - 5,
                centerZ: playableMaxZ + 5,
                houses: [
                    { offsetX: -1, offsetZ: -1 },
                    { offsetX: 1, offsetZ: -1 },
                    { offsetX: -1, offsetZ: 1 },
                    { offsetX: 1, offsetZ: 1 },
                ],
                trees: [
                    { offsetX: -2, offsetZ: -2 },
                    { offsetX: 2, offsetZ: -2 },
                    { offsetX: -2, offsetZ: 2 },
                ],
                hasMarket: false,
                hasWell: false
            },
            // South-east hamlet
            {
                centerX: playableMaxX + 5,
                centerZ: playableMaxZ + 5,
                houses: [
                    { offsetX: -1, offsetZ: -1 },
                    { offsetX: 1, offsetZ: -1 },
                    { offsetX: -1, offsetZ: 1 },
                ],
                trees: [
                    { offsetX: -2, offsetZ: -2 },
                    { offsetX: 2, offsetZ: -2 },
                    { offsetX: -2, offsetZ: 2 },
                ],
                hasMarket: true,
                hasWell: false
            },
            // Additional hamlets for larger cities
            ...(citySize >= 12 ? [
                {
                    centerX: citySize / 2,
                    centerZ: playableMinZ - 6,
                    houses: [
                        { offsetX: -1, offsetZ: 0 },
                        { offsetX: 1, offsetZ: 0 },
                        { offsetX: 0, offsetZ: -1 },
                    ],
                    trees: [
                        { offsetX: -2, offsetZ: 1 },
                        { offsetX: 2, offsetZ: 1 },
                    ],
                    hasMarket: false,
                    hasWell: true
                },
                {
                    centerX: citySize / 2,
                    centerZ: playableMaxZ + 6,
                    houses: [
                        { offsetX: -1, offsetZ: 0 },
                        { offsetX: 1, offsetZ: 0 },
                        { offsetX: 0, offsetZ: 1 },
                    ],
                    trees: [
                        { offsetX: -2, offsetZ: -1 },
                        { offsetX: 2, offsetZ: -1 },
                    ],
                    hasMarket: false,
                    hasWell: false
                },
                {
                    centerX: playableMaxX + 6,
                    centerZ: citySize / 2,
                    houses: [
                        { offsetX: 0, offsetZ: -1 },
                        { offsetX: 0, offsetZ: 1 },
                        { offsetX: 1, offsetZ: 0 },
                    ],
                    trees: [
                        { offsetX: -1, offsetZ: -2 },
                        { offsetX: -1, offsetZ: 2 },
                    ],
                    hasMarket: false,
                    hasWell: true
                },
                {
                    centerX: playableMinX - 6,
                    centerZ: citySize / 2,
                    houses: [
                        { offsetX: 0, offsetZ: -1 },
                        { offsetX: 0, offsetZ: 1 },
                        { offsetX: -1, offsetZ: 0 },
                    ],
                    trees: [
                        { offsetX: 1, offsetZ: -2 },
                        { offsetX: 1, offsetZ: 2 },
                    ],
                    hasMarket: false,
                    hasWell: false
                }
            ] : []),
        ];
        
        // Create elements for each hamlet
        hamlets.forEach((hamlet, hamletIndex) => {
            hamlet.houses.forEach((houseOffset, houseIndex) => {
                const x = hamlet.centerX + houseOffset.offsetX;
                const z = hamlet.centerZ + houseOffset.offsetZ;
                
                const isOutsidePlayable = (x < playableMinX || x > playableMaxX || 
                                          z < playableMinZ || z > playableMaxZ);
                const isInWorld = (x >= worldMinX + 1 && x <= worldMaxX - 1 &&
                                  z >= worldMinZ + 1 && z <= worldMaxZ - 1);
                
                if (isOutsidePlayable && isInWorld) {
                    decorativeElements.push({
                        type: houseTypes[(hamletIndex + houseIndex) % houseTypes.length],
                        x: x,
                        z: z
                    });
                }
            });
            
            hamlet.trees.forEach((treeOffset, treeIndex) => {
                const x = hamlet.centerX + treeOffset.offsetX;
                const z = hamlet.centerZ + treeOffset.offsetZ;
                
                const isOutsidePlayable = (x < playableMinX || x > playableMaxX || 
                                          z < playableMinZ || z > playableMaxZ);
                const isInWorld = (x >= worldMinX + 1 && x <= worldMaxX - 1 &&
                                  z >= worldMinZ + 1 && z <= worldMaxZ - 1);
                
                if (isOutsidePlayable && isInWorld) {
                    decorativeElements.push({
                        type: treeTypes[(hamletIndex + treeIndex) % treeTypes.length],
                        x: x,
                        z: z
                    });
                }
            });
            
            if (hamlet.hasMarket) {
                const x = hamlet.centerX;
                const z = hamlet.centerZ;
                const isOutsidePlayable = (x < playableMinX || x > playableMaxX || 
                                          z < playableMinZ || z > playableMaxZ);
                const isInWorld = (x >= worldMinX + 1 && x <= worldMaxX - 1 &&
                                  z >= worldMinZ + 1 && z <= worldMaxZ - 1);
                
                if (isOutsidePlayable && isInWorld) {
                    decorativeElements.push({
                        type: 'Market-Stall',
                        x: x,
                        z: z
                    });
                }
            }
            
            if (hamlet.hasWell) {
                const x = hamlet.centerX + 1;
                const z = hamlet.centerZ;
                const isOutsidePlayable = (x < playableMinX || x > playableMaxX || 
                                          z < playableMinZ || z > playableMaxZ);
                const isInWorld = (x >= worldMinX + 1 && x <= worldMaxX - 1 &&
                                  z >= worldMinZ + 1 && z <= worldMaxZ - 1);
                
                if (isOutsidePlayable && isInWorld) {
                    decorativeElements.push({
                        type: 'Well-001',
                        x: x,
                        z: z
                    });
                }
            }
            
            // Add roads between houses
            hamlet.houses.forEach((houseOffset, houseIndex) => {
                if (houseIndex > 0) {
                    const prevHouse = hamlet.houses[houseIndex - 1];
                    const x1 = hamlet.centerX + prevHouse.offsetX;
                    const z1 = hamlet.centerZ + prevHouse.offsetZ;
                    const x2 = hamlet.centerX + houseOffset.offsetX;
                    const z2 = hamlet.centerZ + houseOffset.offsetZ;
                    
                    const midX = Math.round((x1 + x2) / 2);
                    const midZ = Math.round((z1 + z2) / 2);
                    
                    const isOutsidePlayable = (midX < playableMinX || midX > playableMaxX || 
                                              midZ < playableMinZ || midZ > playableMaxZ);
                    const isInWorld = (midX >= worldMinX + 1 && midX <= worldMaxX - 1 &&
                                      midZ >= worldMinZ + 1 && midZ <= worldMaxZ - 1);
                    
                    if (isOutsidePlayable && isInWorld) {
                        decorativeElements.push({
                            type: 'StonePath-001',
                            x: midX,
                            z: midZ
                        });
                    }
                }
            });
        });
        
        // Add scattered individual trees
        const scatteredTreeCount = Math.min(15, Math.floor(margin / 2));
        for (let i = 0; i < scatteredTreeCount; i++) {
            let x, z;
            const side = Math.floor(Math.random() * 4);
            
            switch (side) {
                case 0: // North
                    x = playableMinX + Math.random() * citySize;
                    z = playableMinZ - (2 + Math.random() * (margin - 4));
                    break;
                case 1: // South
                    x = playableMinX + Math.random() * citySize;
                    z = playableMaxZ + (2 + Math.random() * (margin - 4));
                    break;
                case 2: // East
                    x = playableMaxX + (2 + Math.random() * (margin - 4));
                    z = playableMinZ + Math.random() * citySize;
                    break;
                case 3: // West
                    x = playableMinX - (2 + Math.random() * (margin - 4));
                    z = playableMinZ + Math.random() * citySize;
                    break;
            }
            
            const isOutsidePlayable = (x < playableMinX || x > playableMaxX || 
                                      z < playableMinZ || z > playableMaxZ);
            const isInWorld = (x >= worldMinX + 1 && x <= worldMaxX - 1 &&
                              z >= worldMinZ + 1 && z <= worldMaxZ - 1);
            
            if (isOutsidePlayable && isInWorld) {
                decorativeElements.push({
                    type: treeTypes[i % treeTypes.length],
                    x: Math.round(x),
                    z: Math.round(z)
                });
            }
        }
        
        // Create and place all decorative elements
        decorativeElements.forEach(element => {
            try {
                const asset = this.assetManager.createAsset(element.type, element.x, element.z);
                if (asset) {
                    asset.userData.isDecorative = true;
                    asset.userData.nonInteractive = true;
                    asset.name = `decorative-${element.type}-${element.x}-${element.z}`;
                    asset.position.set(element.x, worldPlatformHeight, element.z);
                    villageGroup.add(asset);
                }
            } catch (error) {
                console.warn(`[DecorativeVillageManager] Failed to create decorative ${element.type} at (${element.x}, ${element.z}):`, error);
            }
        });
        
        this.scene.add(villageGroup);
    }
}
