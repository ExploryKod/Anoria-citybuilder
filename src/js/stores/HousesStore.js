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
     * Calculate the number of famished (hungry) people in the city
     * Famished people = total population - fed population
     * Fed population = min(population, food stocks) for each house
     * @returns {Promise<number>} Number of famished people
     */
    async getFamishedPopulation() {
        const houses = await this.listAllHouses();
        let totalPopulation = 0;
        let fedPopulation = 0;

        for (const house of houses) {
            if (house.type && house.type.includes('House')) {
                const housePop = house.pop || 0;
                const houseStocks = house.stocks || { food: 0, wheat: 0, carrot: 0, cabbage: 0 };
                const totalFood = houseStocks.food || 0;
                
                totalPopulation += housePop;
                // Fed population = min(population, available food)
                // If house has 6 people but only 3 food, only 3 are fed
                fedPopulation += Math.min(housePop, totalFood);
            }
        }

        const famishedPopulation = Math.max(0, totalPopulation - fedPopulation);
        return famishedPopulation;
    }

    /**
     * Process population based on road access (food is no longer required)
     * Population can exist without food (un nourished people), but requires road access
     * @returns {Promise<Object>} Result with population changes
     */
    async processPopulationFoodLogic() {
        const houses = await this.listAllHouses();
        let totalPopulationLost = 0;
        let totalPopulationGained = 0;
        let housesAffected = 0;

        for (const house of houses) {
            if (house.type && house.type.includes('House')) { // Only process houses
                const hasRoadAccess = house.neighbors && house.neighbors.filter(neighbor => neighbor.name === 'roads').length > 0;
                const currentPop = house.pop || 0;
                
                if (!hasRoadAccess) {
                    // No road access - reset population to 0 (food is not required)
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
                `${totalPopulationLost} inhabitants lost due to no road access in ${housesAffected} houses` : 
                'All houses with population have road access'
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
        let house = await this.db.houses.get(name);
        
        // If house doesn't exist, create it with the updates
        if (!house) {
            // Extract x, y from name (format: "Type-x-y")
            const parts = name.split('-');
            if (parts.length >= 3) {
                const x = parseInt(parts[parts.length - 2]);
                const y = parseInt(parts[parts.length - 1]);
                
                if (!isNaN(x) && !isNaN(y)) {
                    // Create new house entry with basic structure
                    house = {
                        name: name,
                        type: parts.slice(0, -2).join('-'), // Get type part (handles "House-2Story")
                        price: 0,
                        x: x,
                        y: y,
                        neighbors: [],
                        pop: 0,
                        stocks: { food: 0, cabbage: 0, wheat: 0, carrot: 0 },
                        roads: 0,
                        worldTime: 0
                    };
                } else {
                    // Cannot create house without valid coordinates
                    return;
                }
            } else {
                // Cannot create house without valid name format
                return;
            }
        }
        
        // Update house fields
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

    async updateHouseName(oldName, newName, keys = {}) {
        try {
            const house = await this.db.houses.get(oldName);
            if (house) {
                // Delete old entry first to avoid key conflicts
                await this.db.houses.delete(oldName);
                
                // Create new entry with updated name and keys, preserving all other fields
                const updatedHouse = {
                    ...house,
                    name: newName
                };
                
                if (keys.type) updatedHouse.type = keys.type;
                if (keys.price) updatedHouse.price = keys.price;
                
                // Put the new entry (will create if doesn't exist, update if exists)
                await this.db.houses.put(updatedHouse);
                return { success: true, message: `House ${oldName} updated to ${newName}` };
            } else {
                console.warn(`[HousesStore] House with oldName ${oldName} not found for update.`);
                return { success: false, message: `House ${oldName} not found.` };
            }
        } catch (error) {
            console.error(`[HousesStore] Error updating house name from ${oldName} to ${newName}:`, error);
            return { success: false, message: `Error updating house name: ${error.message}` };
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
