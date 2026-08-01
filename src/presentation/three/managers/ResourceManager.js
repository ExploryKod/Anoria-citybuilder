export class ResourceManager {
    constructor() {
        this.resources = new Map();
    }

    /**
     * @param {object} city
     * @param {object} assetManager
     * @param {object[][]} buildings
     * @param {object[]} zoneGroups
     * @param {{ placeBuildingRecord: (data: object) => Promise<object> }} constructionApi
     * @param {{ listNatureResources: () => Promise<object[]> }} [supplyApi]
     */
    async initializeResources(city, assetManager, buildings, zoneGroups, constructionApi, supplyApi = null) {
        const treeCount = Math.floor(city.size * city.size * 0.05);
        const boulderCount = Math.floor(city.size * city.size * 0.03);

        await this.placeRandomTrees(
          city, assetManager, buildings, zoneGroups, treeCount, constructionApi
        );
        await this.placeRandomBoulders(
          city, assetManager, buildings, zoneGroups, boulderCount, constructionApi
        );
        this.markClayTiles(city);
        await this.markIronBoulders(city, supplyApi);
        await this.markGoldBoulders(city, supplyApi);
    }

    async placeRandomTrees(city, assetManager, buildings, zoneGroups, count, constructionApi) {
        const { placeBuildingRecord } = constructionApi;
        const treeMapping = {
            'Tree-Sapin': 'Tree-Pine-001',
            'Tree-Arbuste': 'Tree-Square-001',
            'Tree-Chene': 'Tree-Tall-001',
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

                    const treeWoodStocks = {
                        'Tree-Sapin': 100,
                        'Tree-Arbuste': 80,
                        'Tree-Chene': 120,
                    };
                    const woodAmount = treeWoodStocks[treeTypeId] || 100;

                    const placed = await placeBuildingRecord({
                        name: treeId,
                        type: treeTypeId,
                        category: 'nature',
                        x,
                        y,
                        neighbors: [],
                        pop: 0,
                        stocks: { wood: woodAmount },
                        maxStocks: { wood: woodAmount },
                        roads: 0,
                        worldTime: 0,
                        price: 0,
                        isBuilding: false,
                    });
                    if (placed?.success && placed.instanceId) {
                        tile.instanceId = placed.instanceId;
                        if (buildings[x]?.[y]?.userData) {
                            buildings[x][y].userData.instanceId = placed.instanceId;
                        }
                    }
                } catch (_error) {
                    // preserve silent failure
                }

                placed++;
            }
        }
    }

    async placeRandomBoulders(city, assetManager, buildings, zoneGroups, count, constructionApi) {
        const { placeBuildingRecord } = constructionApi;
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

                    const rockAmount = 50 + Math.floor(Math.random() * 100);
                    const goldAmount = Math.random() < 0.3 ? 0 : 20 + Math.floor(Math.random() * 30);
                    const ironAmount = Math.random() < 0.2 ? 0 : 30 + Math.floor(Math.random() * 40);

                    const placed = await placeBuildingRecord({
                        name: boulderId,
                        type: boulderType,
                        category: 'nature',
                        x,
                        y,
                        neighbors: [],
                        pop: 0,
                        stocks: {
                            rock: rockAmount,
                            gold: goldAmount,
                            iron: ironAmount,
                        },
                        maxStocks: {
                            rock: rockAmount,
                            gold: goldAmount,
                            iron: ironAmount,
                        },
                        roads: 0,
                        worldTime: 0,
                        price: 0,
                        isBuilding: false,
                    });
                    if (placed?.success && placed.instanceId) {
                        tile.instanceId = placed.instanceId;
                        if (buildings[x]?.[y]?.userData) {
                            buildings[x][y].userData.instanceId = placed.instanceId;
                        }
                    }
                } catch (_error) {
                    // preserve silent failure
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

    /**
     * @param {object} city
     * @param {{ listNatureResources: () => Promise<object[]> } | null} supplyApi
     */
    async markIronBoulders(city, supplyApi) {
        try {
            if (!supplyApi?.listNatureResources) return;
            const boulders = (await supplyApi.listNatureResources()).filter((h) =>
                (h.type || '').includes('Boulder')
            );
            const ironBoulderCount = Math.floor(boulders.length * 0.15);

            for (let i = 0; i < ironBoulderCount && i < boulders.length; i++) {
                const boulder = boulders[Math.floor(Math.random() * boulders.length)];
                const tile = city.tiles[boulder.x]?.[boulder.y];

                if (tile) {
                    tile.hasIron = true;
                }
            }
        } catch (_error) {
            // preserve silent failure
        }
    }

    /**
     * @param {object} city
     * @param {{ listNatureResources: () => Promise<object[]> } | null} supplyApi
     */
    async markGoldBoulders(city, supplyApi) {
        try {
            if (!supplyApi?.listNatureResources) return;
            const boulders = (await supplyApi.listNatureResources()).filter((h) =>
                (h.type || '').includes('Boulder')
            );
            const goldBoulderCount = Math.floor(boulders.length * 0.1);

            for (let i = 0; i < goldBoulderCount && i < boulders.length; i++) {
                const boulder = boulders[Math.floor(Math.random() * boulders.length)];
                const tile = city.tiles[boulder.x]?.[boulder.y];

                if (tile && !tile.hasIron) {
                    tile.hasGold = true;
                }
            }
        } catch (_error) {
            // preserve silent failure
        }
    }
}
