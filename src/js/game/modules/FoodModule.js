import { SimModule } from './SimModule.js';

/**
 * FoodModule - Manages food availability for buildings
 * Works with IndexedDB stocks as source of truth
 */
export class FoodModule extends SimModule {
    /**
     * Current food stocks from IndexedDB
     * @type {Object}
     */
    stocks = {
        food: 0,
        wheat: 0,
        carrot: 0,
        cabbage: 0
    };

    /**
     * Population count (used to calculate net food)
     * @type {number}
     */
    population = 0;

    /**
     * Updates module state from IndexedDB stocks data
     * @param {Object} stocks - Stocks object from housesStore (food, wheat, carrot, cabbage)
     * @param {number} population - Current population
     */
    updateFromStocks(stocks, population = 0) {
        this.stocks = stocks || { food: 0, wheat: 0, carrot: 0, cabbage: 0 };
        this.population = population || 0;
    }

    /**
     * Checks if building has food available
     * @returns {boolean}
     */
    hasFood() {
        return this.stocks && (this.stocks.food > 0 || this.getTotalFood() > 0);
    }

    /**
     * Gets total food count (sum of all food types)
     * @returns {number}
     */
    getTotalFood() {
        if (!this.stocks) return 0;
        return (this.stocks.food || 0) + 
               (this.stocks.wheat || 0) + 
               (this.stocks.carrot || 0) + 
               (this.stocks.cabbage || 0);
    }

    /**
     * Calculates net food (food available minus population consumption)
     * @returns {number}
     */
    getNetFood() {
        const totalFood = this.getTotalFood();
        if (totalFood > 0 && this.population > 0) {
            const net = totalFood - this.population;
            return net > 0 ? net : 0;
        }
        return totalFood;
    }

    /**
     * Checks if food goal is met (for house evolution)
     * Food goal: population > 2 AND food > population * 2
     * @returns {boolean}
     */
    meetsFoodGoal() {
        const totalFood = this.getTotalFood();
        return this.population > 2 && totalFood > this.population * 2;
    }

    /**
     * Checks if food is insufficient (for decay condition)
     * Decay: time > 3 AND population >= 2 AND food < population
     * @returns {boolean}
     */
    isInsufficient() {
        const totalFood = this.getTotalFood();
        return this.population >= 2 && totalFood < this.population;
    }

    /**
     * Returns HTML representation for info panels
     * @returns {string}
     */
    toHTML() {
        if (!this.hasFood()) {
            return `<span class="info-label">Food</span><span class="info-value">None</span><br>`;
        }

        const foodDetails = [];
        if (this.stocks.wheat > 0) foodDetails.push(`Wheat: ${this.stocks.wheat}`);
        if (this.stocks.carrot > 0) foodDetails.push(`Carrot: ${this.stocks.carrot}`);
        if (this.stocks.cabbage > 0) foodDetails.push(`Cabbage: ${this.stocks.cabbage}`);
        if (this.stocks.food > 0) foodDetails.push(`Food: ${this.stocks.food}`);

        return `
            <span class="info-label">Food</span>
            <span class="info-value">${foodDetails.join(', ')}</span>
            <br>
            <span class="info-label">Total Food</span>
            <span class="info-value">${this.getTotalFood()}</span>
            <br>
        `;
    }
}

