import { SimService } from './SimService.js';
import { checkRoadAccess } from '../modules/ModuleHelper.js';
import { TimeManager } from '../utils/TimeManager.js';

const PRODUCT_RECIPES = {
    furniture: { wood: 2 },
    weapons: { wood: 1, iron: 1 },
    pottery: { clay: 1, stone: 1 },
    jewelry: { gold: 1, iron: 1, wood: 1 }
};

const PRODUCTION_TIME_DAYS = 7;

export class FactoryService extends SimService {
    async simulate(city, housesStore, time = 0) {
        try {
            const houses = await housesStore.listAllHouses();
            const factories = houses.filter(house => {
                const type = house.type || '';
                return type.includes('Winery-001');
            });

            for (const factory of factories) {
                await this.processFactory(factory, housesStore, time, city);
            }
        } catch (error) {
            // Error handling
        }
    }

    async processFactory(factory, housesStore, time, city) {
        const factoryId = factory.id || factory.name;
        const factoryData = await housesStore.getHouse(factoryId);
        if (!factoryData) return;

        const neighbors = factoryData.neighbors || [];
        const { hasAccess } = checkRoadAccess(neighbors);
        if (!hasAccess) return;

        const isActive = factoryData.isActive !== false;
        if (!isActive) return;

        const rawMaterials = factoryData.rawMaterials || {};
        const products = factoryData.products || {};
        const maxRawMaterials = factoryData.maxRawMaterials || 500;
        const maxProducts = factoryData.maxProducts || 500;

        const lastProductionTime = factoryData.lastProductionTime || 0;
        const timeSinceProduction = time - lastProductionTime;

        if (timeSinceProduction >= PRODUCTION_TIME_DAYS) {
            await this.produceProducts(factoryId, rawMaterials, products, maxProducts, housesStore);
            await housesStore.updateHouseFields(factoryId, { lastProductionTime: time });
        }

        await this.collectResources(factoryId, rawMaterials, maxRawMaterials, housesStore, city);
    }

    async produceProducts(factoryId, rawMaterials, products, maxProducts, housesStore) {
        const totalProducts = Object.values(products).reduce((sum, qty) => sum + qty, 0);
        const remainingCapacity = Math.max(0, maxProducts - totalProducts);

        if (remainingCapacity <= 0) return;

        for (const [productType, recipe] of Object.entries(PRODUCT_RECIPES)) {
            if (remainingCapacity <= 0) break;

            const canProduce = this.canProduceProduct(recipe, rawMaterials);
            if (!canProduce) continue;

            const quantityToProduce = Math.min(1, remainingCapacity);
            const newProducts = { ...products };
            newProducts[productType] = (newProducts[productType] || 0) + quantityToProduce;

            const newRawMaterials = { ...rawMaterials };
            for (const [material, amount] of Object.entries(recipe)) {
                newRawMaterials[material] = Math.max(0, (newRawMaterials[material] || 0) - amount);
            }

            await housesStore.updateHouseFields(factoryId, {
                products: newProducts,
                rawMaterials: newRawMaterials
            });
        }
    }

    canProduceProduct(recipe, rawMaterials) {
        for (const [material, amount] of Object.entries(recipe)) {
            const available = rawMaterials[material] || 0;
            if (available < amount) return false;
        }
        return true;
    }

    async collectResources(factoryId, rawMaterials, maxRawMaterials, housesStore, city) {
        const totalRawMaterials = Object.values(rawMaterials).reduce((sum, qty) => sum + qty, 0);
        const remainingCapacity = Math.max(0, maxRawMaterials - totalRawMaterials);

        if (remainingCapacity <= 0) return;

        const resources = await this.getCityResources(city, housesStore);
        
        const newRawMaterials = { ...rawMaterials };
        let collected = false;
        let capacityUsed = 0;

        for (const [resourceType, available] of Object.entries(resources)) {
            if (capacityUsed >= remainingCapacity) break;
            if (available <= 0) continue;

            const toCollect = Math.min(available, remainingCapacity - capacityUsed);
            if (toCollect > 0) {
                newRawMaterials[resourceType] = (newRawMaterials[resourceType] || 0) + toCollect;
                capacityUsed += toCollect;
                collected = true;
            }
        }

        if (collected) {
            await housesStore.updateHouseFields(factoryId, { rawMaterials: newRawMaterials });
        }
    }

    async getCityResources(city, housesStore) {
        const resources = {
            wood: 0,
            stone: 0,
            clay: 0,
            iron: 0,
            gold: 0
        };

        try {
            const houses = await housesStore.listAllHouses();
            
            for (const house of houses) {
                const type = house.type || '';
                
                if (type.includes('Tree')) {
                    resources.wood += 1;
                } else if (type.includes('Boulder')) {
                    const x = house.x;
                    const y = house.y;
                    const tile = city.tiles[x]?.[y];
                    
                    if (tile) {
                        if (tile.hasIron) {
                            resources.iron += 1;
                        } else if (tile.hasGold) {
                            resources.gold += 1;
                        } else {
                            resources.stone += 1;
                        }
                    }
                }
            }

            for (let x = 0; x < city.size; x++) {
                for (let y = 0; y < city.size; y++) {
                    const tile = city.tiles[x]?.[y];
                    if (tile && tile.hasClay) {
                        resources.clay += 1;
                    }
                }
            }
        } catch (error) {
            // Error handling
        }

        return resources;
    }
}

