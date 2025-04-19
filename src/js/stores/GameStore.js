import db from './db';

class GameStore {
    constructor() {
        this.db = db;
    }

    // Retrieves all game items from the database.
    async listAllGameItems() {
        return await this.db.game.toArray();
    }

    // Retrieves a game item by its name.
    async getGameItem(name) {
        return await this.db.game.get(name) || null;
    }

    // Retrieves a game item in the latest row.
    async getLatestGameItemByField(fieldName) {
        const cursor = await this.db.game.orderBy('name').reverse().first();
        return cursor && fieldName in cursor ? cursor[fieldName] : null;
    }

    // Retrieves all game items in the latest row.
    async getLatestGameItems() {
        const items = [];
        let cursor = await this.db.game.orderBy('name').reverse().first();
        while (cursor) {
            items.push(cursor);
            cursor = await this.db.game.orderBy('name').reverse().next();
        }
        return items.length > 0 ? items : null;
    }

    // Adds a new game item to the database.
    async addGameItems(data) {
        try {
            await this.db.game.add(data);
            console.log(`Game object ${data.name} added successfully.`);
        } catch (err) {
            if (err.name === 'ConstraintError') {
                console.error(`Game object ${data.name} already exists.`);
            } else {
                throw err;
            }
        }
    }

    // Updates the latest game item with specified changes.
    async updateLatestGameItemFields(updates) {
        const cursor = await this.db.game.orderBy('name').reverse().first();
        if (cursor) {
            const gameItem = cursor;
            Object.assign(gameItem, updates);
            await this.db.game.put(gameItem);
            console.log(`Latest game item updated successfully with changes:`, updates);
        } else {
            console.warn('No game items found to update.');
        }
    }

    // Updates a game item with specified changes.
    async updateGameItemFields(name, updates) {
        const gameItem = await this.db.game.get(name);
        if (gameItem) {
            Object.assign(gameItem, updates);
            await this.db.game.put(gameItem);
            console.log(`Game item ${name} updated successfully.`);
        } else {
            console.warn(`Game item ${name} not found.`);
        }
    }

    // Updates all game items with specified changes, but only updates keys that have changed.
    async updateAllGameItems(updates) {
        console.warn(`[STORE] Game object will update all games.`);
        const allGameItems = await this.db.game.toArray();

        for (const gameItem of allGameItems) {
            let hasChanges = false;
            for (const key in updates) {
                if (updates.hasOwnProperty(key) && gameItem[key] !== updates[key]) {
                    gameItem[key] = updates[key];
                    hasChanges = true;
                }
            }

            if (hasChanges) {
                await this.db.game.put(gameItem);
                console.warn(`[STORE] Game item ${gameItem.name} updated with changes:`, updates);
            } else {
                console.warn(`[STORE] No changes detected for game item ${gameItem.name}.`);
            }
        }

        console.log("All applicable game items have been updated.");
    }

    // Deletes a game item by its name.
    async deleteGameItem(name) {
        await this.db.game.delete(name);
        console.log(`Game item ${name} deleted successfully.`);
    }

    // Clears all game items from the database.
    async clearGameItems() {
        await this.db.game.clear();
        console.log(`All game items cleared.`);
    }
}

// Export an instance of the GameStore class to use across your application
const gameStore = new GameStore();
export default gameStore;
