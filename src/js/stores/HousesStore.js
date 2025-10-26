import db from './db';
import budgetManager from './BudgetManager.js';

class HouseStore {
    constructor() {
        this.db = db;
    }

    async listAllHouses() {
        return await this.db.houses.toArray();
    }

    async getAllHousesSortedByNameAndPrice() {
        return this.db.houses.orderBy(['name', 'price']).toArray();
    }

    async getTotalBuildingExpensesByType() {
        const houses = await this.db.houses.toArray();
        const expensesByType = {};

        houses.forEach(house => {
            const houseType = house.name.split('-').slice(0, 2).join('-');
            if (!expensesByType[houseType]) {
                expensesByType[houseType] = 0;
            }
            expensesByType[houseType] += house.price;
        });

        return expensesByType;
    }

    async getGlobalPopulation() {
        const houses = await this.listAllHouses();
        return houses.reduce((total, house) => total + (house.pop || 0), 0);
    }

    /**
     * Process population based on food availability and road access
     * Population can only grow if there's food AND road access, and resets to 0 if no food OR no road access
     * @returns {Promise<Object>} Result with population changes
     */
    async processPopulationFoodLogic() {
        const houses = await this.listAllHouses();
        let totalPopulationLost = 0;
        let totalPopulationGained = 0;
        let housesAffected = 0;

        for (const house of houses) {
            if (house.type && house.type.includes('House')) { // Only process houses
                const hasFood = house.stocks && house.stocks.food > 0;
                const hasRoadAccess = house.neighbors && house.neighbors.filter(neighbor => neighbor.name === 'roads').length > 0;
                const currentPop = house.pop || 0;
                
                if (!hasFood || !hasRoadAccess) {
                    // No food OR no road access - reset population to 0
                    if (currentPop > 0) {
                        totalPopulationLost += currentPop;
                        housesAffected++;
                        
                        await this.updateHouseFields(house.id, {
                            pop: 0
                        });
                    }
                }
            }
        }

        return {
            totalPopulationLost,
            totalPopulationGained,
            housesAffected,
            message: totalPopulationLost > 0 ? 
                `${totalPopulationLost} inhabitants lost due to no food or road access in ${housesAffected} houses` : 
                'All houses with population have food and road access'
        };
    }

    async getGlobalBuildingPrices() {
        const houses = await this.listAllHouses();
        return houses.reduce((total, house) => total + (house.price || 0), 0);
    }

    async getBuildingPricesByType() {
        const houses = await this.listAllHouses();
        const pricesByType = {};

        houses.forEach(house => {
            // Extract base type from name (e.g., "House-Red-1" -> "House-Red", "Road-1" -> "Road")
            let houseType;
            if (house.name.includes('House-')) {
                houseType = house.name.split('-').slice(0, 2).join('-');
            } else if (house.name.includes('Farm-')) {
                houseType = house.name.split('-').slice(0, 2).join('-');
            } else if (house.name.includes('Market')) {
                houseType = 'Market';
            } else if (house.name.includes('roads')) {
                houseType = 'roads';
            } else {
                houseType = house.name.split('-')[0];
            }
            
            if (!pricesByType[houseType]) {
                pricesByType[houseType] = house.price || 0;
            }
        });

        return pricesByType;
    }

    async addHouse(data) {
        try {
            await this.db.houses.add(data);
            return { success: true };
        } catch (err) {
            console.error(`Error adding house: ${err.message}`);
            return { success: false, error: err.message };
        }
    }

    async addHouseAndPay(data) {
        // Use the new BudgetManager for proper financial handling
        const expenseResult = await budgetManager.addExpense(data.price, `Building: ${data.type}`);
        
        if (!expenseResult.success) {
            console.warn(`Cannot build ${data.type}: ${expenseResult.message}`);
            return expenseResult;
        }

        const addHouseResult = await this.addHouse(data);
        
        if (!addHouseResult.success) {
            console.error('Error adding house after payment:', addHouseResult.error);
            // If house creation fails, we should refund the expense
            await budgetManager.addIncome(data.price, `Refund for failed ${data.type}`);
            return { success: false, reason: 'database_error', error: addHouseResult.error };
        }
        
        return { success: true, budget: expenseResult.budget };
    }

    async getHouse(name) {
        return await this.db.houses.get(name);
    }

    async getHouseItem(name, key) {
        const house = await this.getHouse(name);
        if (house && key in house) {
            return house[key];
        }
        
        // Return default values for missing keys instead of warning
        const defaults = {
            'stocks': { food: 0, cabbage: 0, wheat: 0, carrot: 0 },
            'neighbors': [],
            'pop': 0,
            'roads': 0
        };
        
        if (defaults[key] !== undefined) {
            return defaults[key];
        }
        
        console.warn(`Key ${key} not found in house ${name}`);
        return false;
    }

    async updateHouseFields(name, updates, appendToArrays = false) {
        const house = await this.db.houses.get(name);
        if (house) {
            for (const key in updates) {
                if (updates[key] !== undefined) {
                    if (Array.isArray(house[key]) && appendToArrays) {
                        house[key] = [...house[key], ...updates[key]];
                    } else {
                        house[key] = updates[key];
                    }
                }
            }
            await this.db.houses.put(house);
        }
    }

    async updateHouseName(oldName, newName, keys = {}) {
        const house = await this.db.houses.get(oldName);
        if (house) {
            house.name = newName;
            if (keys.type) house.type = keys.type;
            if (keys.price) house.price = keys.price;
            await this.db.houses.put(house);
            await this.db.houses.delete(oldName);
        }
    }

    async incrementHouseField(entries, condition = false) {
        const { name, increment, field } = entries;
        const house = await this.db.houses.get(name);
        if (house && house[field] !== undefined) {
            if (!condition || (house[field] < condition.limit)) {
                house[field] += increment;
                await this.db.houses.put(house);
            }
        }
    }

    async deleteOneHouse(name) {
        await this.db.houses.delete(name);
    }

    async clearHouses() {
        await this.db.houses.clear();
    }

    async getEachBuildingsExpenses() {
        const houses = await this.db.houses.toArray();
        const expensesByType = {};
        let globalExpense = 0;

        houses.forEach(house => {
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

// Export an instance of the HouseStore class to use across your application
const houseStore = new HouseStore();
export default houseStore;
