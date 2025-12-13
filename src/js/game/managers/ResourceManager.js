export class ResourceManager {
    constructor() {
        this.resources = new Map();
    }

    async initializeResources(city, housesStore, assetManager, buildings, zoneGroups) {
        const treeCount = Math.floor(city.size * city.size * 0.05);
        const boulderCount = Math.floor(city.size * city.size * 0.03);
        
        await this.placeRandomTrees(city, housesStore, assetManager, buildings, zoneGroups, treeCount);
        await this.placeRandomBoulders(city, housesStore, assetManager, buildings, zoneGroups, boulderCount);
        this.markClayTiles(city);
        await this.markIronBoulders(city, housesStore);
        await this.markGoldBoulders(city, housesStore);
    }

    async placeRandomTrees(city, housesStore, assetManager, buildings, zoneGroups, count) {
        const treeMapping = {
            'Tree-Sapin': 'Tree-Pine-001',
            'Tree-Arbuste': 'Tree-Square-001',
            'Tree-Chene': 'Tree-Tall-001'
        };
        const treeTypes = Object.keys(treeMapping);
        const ZONE_SIZE = 4;
        let placed = 0;

        while (placed < count) {
            const x = Math.floor(Math.random() * city.size);
            const y = Math.floor(Math.random() * city.size);
            const tile = city.tiles[x]?.[y];

            if (tile && !tile.buildingId && tile.terrainId === 'grass' && !buildings[x][y]) {
                const treeTypeId = treeTypes[Math.floor(Math.random() * treeTypes.length)];
                const treeAssetId = treeMapping[treeTypeId];
                const treeId = `${treeTypeId}-${x}-${y}`;
                
                tile.buildingId = treeTypeId;
                tile.buildingCoord = { x, y };

                try {
                    const mesh = assetManager.createAsset(treeAssetId, x, y);
                    if (mesh) {
                        mesh.name = treeId;
                        mesh.userData.id = treeTypeId;
                        mesh.userData.type = treeTypeId;
                        mesh.userData.x = x;
                        mesh.userData.y = y;
                        mesh.userData.isBuilding = false;

                        const zoneX = Math.floor(x / ZONE_SIZE);
                        const zoneY = Math.floor(y / ZONE_SIZE);
                        const zoneIndex = zoneX * Math.ceil(city.size / ZONE_SIZE) + zoneY;

                        if (zoneGroups[zoneIndex]) {
                            zoneGroups[zoneIndex].add(mesh);
                        }

                        buildings[x][y] = mesh;
                    }

                    const treeData = {
                        name: treeId,
                        type: treeTypeId,
                        x: x,
                        y: y,
                        neighbors: [],
                        pop: 0,
                        stocks: {},
                        roads: 0,
                        worldTime: 0,
                        price: 0,
                        isBuilding: false
                    };
                    await housesStore.addHouse(treeData);
                } catch (error) {
                    // Error handling
                }

                placed++;
            }
        }
    }

    async placeRandomBoulders(city, housesStore, assetManager, buildings, zoneGroups, count) {
        const ZONE_SIZE = 4;
        let placed = 0;

        while (placed < count) {
            const x = Math.floor(Math.random() * city.size);
            const y = Math.floor(Math.random() * city.size);
            const tile = city.tiles[x]?.[y];

            if (tile && !tile.buildingId && tile.terrainId === 'grass' && !buildings[x][y]) {
                const boulderType = 'Boulder-001';
                const boulderId = `${boulderType}-${x}-${y}`;
                
                tile.buildingId = boulderType;
                tile.buildingCoord = { x, y };

                try {
                    const mesh = assetManager.createAsset(boulderType, x, y);
                    if (mesh) {
                        mesh.name = boulderId;
                        mesh.userData.id = boulderType;
                        mesh.userData.type = boulderType;
                        mesh.userData.x = x;
                        mesh.userData.y = y;
                        mesh.userData.isBuilding = false;

                        const zoneX = Math.floor(x / ZONE_SIZE);
                        const zoneY = Math.floor(y / ZONE_SIZE);
                        const zoneIndex = zoneX * Math.ceil(city.size / ZONE_SIZE) + zoneY;

                        if (zoneGroups[zoneIndex]) {
                            zoneGroups[zoneIndex].add(mesh);
                        }

                        buildings[x][y] = mesh;
                    }

                    const boulderData = {
                        name: boulderId,
                        type: boulderType,
                        x: x,
                        y: y,
                        neighbors: [],
                        pop: 0,
                        stocks: {},
                        roads: 0,
                        worldTime: 0,
                        price: 0,
                        isBuilding: false
                    };
                    await housesStore.addHouse(boulderData);
                } catch (error) {
                    // Error handling
                }

                placed++;
            }
        }
    }

    markClayTiles(city) {
        const clayCount = Math.floor(city.size * city.size * 0.08);

        for (let i = 0; i < clayCount; i++) {
            const x = Math.floor(Math.random() * city.size);
            const y = Math.floor(Math.random() * city.size);
            const tile = city.tiles[x]?.[y];

            if (tile && tile.terrainId === 'grass') {
                tile.hasClay = true;
            }
        }
    }

    async markIronBoulders(city, housesStore) {
        try {
            const allHouses = housesStore.listAllHouses ? await housesStore.listAllHouses() : [];
            const boulders = allHouses.filter(h => (h.type || '').includes('Boulder'));
            const ironBoulderCount = Math.floor(boulders.length * 0.15);

            for (let i = 0; i < ironBoulderCount && i < boulders.length; i++) {
                const boulder = boulders[Math.floor(Math.random() * boulders.length)];
                const x = boulder.x;
                const y = boulder.y;
                const tile = city.tiles[x]?.[y];

                if (tile) {
                    tile.hasIron = true;
                }
            }
        } catch (error) {
            // Error handling
        }
    }

    async markGoldBoulders(city, housesStore) {
        try {
            const allHouses = housesStore.listAllHouses ? await housesStore.listAllHouses() : [];
            const boulders = allHouses.filter(h => (h.type || '').includes('Boulder'));
            const goldBoulderCount = Math.floor(boulders.length * 0.1);

            for (let i = 0; i < goldBoulderCount && i < boulders.length; i++) {
                const boulder = boulders[Math.floor(Math.random() * boulders.length)];
                const x = boulder.x;
                const y = boulder.y;
                const tile = city.tiles[x]?.[y];

                if (tile && !tile.hasIron) {
                    tile.hasGold = true;
                }
            }
        } catch (error) {
            // Error handling
        }
    }
}

