import db from '../../core/persistence/dexie/db.js';
import {
    canonicalizeHouseRecord,
    createBuildingInstanceId,
    footprintFromRecord,
    footprintOccupiesTile,
} from '../acl/building-identity.js';

class HouseStore {
    constructor() {
        this.db = db;
        this.pendingAdditions = new Set();
        this.pendingTimeouts = new Map();
    }

    /** @param {string} instanceId */
    _setPendingTimeout(instanceId, timeoutMs = 5000) {
        if (this.pendingTimeouts.has(instanceId)) {
            clearTimeout(this.pendingTimeouts.get(instanceId));
        }

        const timeout = setTimeout(() => {
            if (this.pendingAdditions.has(instanceId)) {
                console.warn(`[HousesStore] Clearing stuck pending addition for ${instanceId} after timeout`);
                this.pendingAdditions.delete(instanceId);
                this.pendingTimeouts.delete(instanceId);
            }
        }, timeoutMs);

        this.pendingTimeouts.set(instanceId, timeout);
    }

    /** @param {string} instanceId */
    _clearPendingTimeout(instanceId) {
        if (this.pendingTimeouts.has(instanceId)) {
            clearTimeout(this.pendingTimeouts.get(instanceId));
            this.pendingTimeouts.delete(instanceId);
        }
    }

    async listAllHouses() {
        return await this.db.houses.toArray();
    }

    async getAllHousesSortedByTypeAndPrice() {
        return this.db.houses.orderBy(['type', 'price']).toArray();
    }

    /** @deprecated Use getAllHousesSortedByTypeAndPrice */
    async getAllHousesSortedByNameAndPrice() {
        return this.getAllHousesSortedByTypeAndPrice();
    }

    async getTotalBuildingExpensesByType() {
        const houses = await this.db.houses.toArray();
        const expensesByType = {};

        houses.forEach((house) => {
            const houseType = house.type || 'unknown';
            if (!expensesByType[houseType]) {
                expensesByType[houseType] = 0;
            }
            expensesByType[houseType] += house.price;
        });

        return expensesByType;
    }

    /**
     * @param {number} x
     * @param {number} y
     */
    async findHouseAtTile(x, y) {
        const tileX = Math.floor(x);
        const tileY = Math.floor(y);
        const houses = await this.listAllHouses();
        return (
            houses.find((house) => {
                const footprint = footprintFromRecord(house);
                return footprint && footprintOccupiesTile(footprint, tileX, tileY);
            }) ?? null
        );
    }

    /**
     * @deprecated Use Housing BC `getCityPopulationSummary()` via `src/js/acl/housing.js`.
     */
    async getGlobalPopulation() {
        const { getOrCreateHousingContext } = await import(
            '../../composition/createHousingContext.js'
        );
        const { totalPop } = await getOrCreateHousingContext().getCityPopulationSummary();
        return totalPop;
    }

    /**
     * @deprecated Use Housing BC `getFamishedPopulation()` via `src/js/acl/housing.js`.
     */
    async getFamishedPopulation() {
        const { getOrCreateHousingContext } = await import(
            '../../composition/createHousingContext.js'
        );
        const result = await getOrCreateHousingContext().getFamishedPopulation();
        return result.famishedPopulation;
    }

    async processPopulationFoodLogic() {
        const houses = await this.listAllHouses();
        let totalPopulationLost = 0;
        let totalPopulationGained = 0;
        let housesAffected = 0;

        for (const house of houses) {
            if (house.type && house.type.includes('House')) {
                const hasRoadAccess = (house.roads ?? 0) > 0;
                const currentPop = house.pop || 0;
                const instanceId = house.instanceId ?? house.id;

                if (!hasRoadAccess && currentPop > 0) {
                    totalPopulationLost += currentPop;
                    housesAffected++;

                    await this.updateHouseFields(instanceId, {
                        pop: 0,
                    });
                }
            }
        }

        return {
            totalPopulationLost,
            totalPopulationGained,
            housesAffected,
            message: totalPopulationLost > 0 ?
                `${totalPopulationLost} inhabitants lost due to no road access in ${housesAffected} houses` :
                'All houses with population have road access',
        };
    }

    /**
     * @deprecated Use `acl/budget.getCityBuildingValuation()`.
     */
    async getGlobalBuildingPrices() {
        const { getCityTotalBuildingValue } = await import('../acl/budget.js');
        return getCityTotalBuildingValue();
    }

    /**
     * @deprecated Use `acl/budget.getCityBuildingValuation()`.
     */
    async getBuildingPricesByType() {
        const { getCityBuildingPricesByType } = await import('../acl/budget.js');
        return getCityBuildingPricesByType();
    }

    async addHouse(data) {
        const instanceId = data.instanceId ?? data.id ?? createBuildingInstanceId();

        if (this.pendingAdditions.has(instanceId)) {
            console.warn(`[HousesStore] House ${instanceId} is already being added, skipping duplicate request`);
            return { success: false, error: 'Building is already being added.', reason: 'duplicate' };
        }

        this.pendingAdditions.add(instanceId);
        this._setPendingTimeout(instanceId, 5000);

        try {
            const existingHouse = await this.db.houses.get(instanceId);
            if (existingHouse) {
                console.warn(`[HousesStore] House ${instanceId} already exists, skipping add`);
                this.pendingAdditions.delete(instanceId);
                this._clearPendingTimeout(instanceId);
                return { success: false, error: 'Key already exists in the object store.', reason: 'duplicate' };
            }

            const record = canonicalizeHouseRecord({ ...data, instanceId });
            await this.db.houses.add(record);

            this.pendingAdditions.delete(instanceId);
            this._clearPendingTimeout(instanceId);
            return { success: true, instanceId };
        } catch (err) {
            this.pendingAdditions.delete(instanceId);
            this._clearPendingTimeout(instanceId);

            if (err.name === 'ConstraintError' || err.message.includes('Key already exists')) {
                console.warn(`[HousesStore] House ${instanceId} already exists (ConstraintError)`);
                return { success: false, error: 'Key already exists in the object store.', reason: 'duplicate' };
            }
            console.error(`[HousesStore] Error adding house: ${err.message}`);
            return { success: false, error: err.message };
        }
    }

    /**
     * @deprecated Use `acl/construction.placeBuildingWithPayment()`.
     */
    async addHouseAndPay(data) {
        const { placeBuildingWithPayment } = await import('../acl/construction.js');
        return placeBuildingWithPayment(data);
    }

    /** @param {string} instanceId */
    async getHouse(instanceId) {
        return await this.db.houses.get(instanceId);
    }

    /** @param {string} instanceId */
    async getHouseItem(instanceId, key) {
        const house = await this.getHouse(instanceId);
        if (house && key in house) {
            return house[key];
        }

        const defaults = {
            stocks: { food: 0, cabbage: 0, wheat: 0, carrot: 0 },
            neighbors: [],
            pop: 0,
            roads: 0,
        };

        if (defaults[key] !== undefined) {
            return defaults[key];
        }

        console.warn(`Key ${key} not found in house ${instanceId}`);
        return false;
    }

    /** @param {string} instanceId */
    async updateHouseFields(instanceId, updates, appendToArrays = false) {
        const house = await this.db.houses.get(instanceId);
        if (!house) {
            return;
        }

        for (const key in updates) {
            if (updates[key] !== undefined) {
                if (Array.isArray(house[key]) && appendToArrays) {
                    house[key] = [...house[key], ...updates[key]];
                } else {
                    house[key] = updates[key];
                }
            }
        }

        await this.db.houses.put(canonicalizeHouseRecord(house));
    }

    /** @param {{ name: string, increment: number, field: string }} entries */
    async incrementHouseField(entries, condition = false) {
        const { name: instanceId, increment, field } = entries;
        const house = await this.db.houses.get(instanceId);
        if (house && house[field] !== undefined) {
            if (!condition || (house[field] < condition.limit)) {
                house[field] += increment;
                await this.db.houses.put(canonicalizeHouseRecord(house));
            }
        }
    }

    /** @param {string} instanceId */
    async deleteOneHouse(instanceId) {
        await this.db.houses.delete(instanceId);
    }

    async clearHouses() {
        await this.db.houses.clear();
    }

    async getEachBuildingsExpenses() {
        const houses = await this.db.houses.toArray();
        const expensesByType = {};
        let globalExpense = 0;

        houses.forEach((house) => {
            const houseType = house.type;
            if (!expensesByType[houseType]) {
                expensesByType[houseType] = { price: 0, number: 0 };
            }

            expensesByType[houseType].price += house.price;
            expensesByType[houseType].number += 1;
            globalExpense += house.price;
        });

        expensesByType.globalExpense = globalExpense;
        return expensesByType;
    }
}

export { HouseStore };
const houseStore = new HouseStore();
export default houseStore;
