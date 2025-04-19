import db from './db';

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

    async getGlobalBuildingPrices() {
        const houses = await this.listAllHouses();
        return houses.reduce((total, house) => total + (house.price || 0), 0);
    }

    async addHouse(data) {
        try {
            await this.db.houses.add(data);
            console.log(`House ${data.name} added successfully.`);
        } catch (err) {
            console.error(`Error adding house: ${err.message}`);
        }
    }

    async addHouseAndPay(data) {
        const gameData = await this.db.game.toArray();
        const gameFunds = gameData[0]?.funds || 0;
        const gameDebt = gameData[0]?.debt || 0;
        const balance = gameFunds - gameDebt;

        if (gameFunds < data.price) {
            console.warn(`Not enough funds to build house ${data.name}.`);
            return;
        }

        gameData[0].funds = gameFunds - data.price;
        gameData[0].debt = gameDebt + data.price;
        await this.db.game.put(gameData[0]);

        await this.addHouse(data);
    }

    async getHouse(name) {
        return await this.db.houses.get(name);
    }

    async getHouseItem(name, key) {
        const house = await this.getHouse(name);
        if (house && key in house) {
            return house[key];
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
