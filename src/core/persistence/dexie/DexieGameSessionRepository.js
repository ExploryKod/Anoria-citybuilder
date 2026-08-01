import db from './db.js';

/**
 * Dexie adapter — persisted game session rows (`game` table).
 */
export class DexieGameSessionRepository {
  constructor(database = db) {
    this.db = database;
  }

  async listAllGameItems() {
    return this.db.game.toArray();
  }

  async getGameItem(name) {
    return (await this.db.game.get(name)) || null;
  }

  async getLatestGameItemByField(fieldName) {
    const cursor = await this.db.game.orderBy('name').reverse().first();
    return cursor && fieldName in cursor ? cursor[fieldName] : null;
  }

  async getLatestGameItems() {
    const items = [];
    let cursor = await this.db.game.orderBy('name').reverse().first();
    while (cursor) {
      items.push(cursor);
      cursor = await this.db.game.orderBy('name').reverse().next();
    }
    return items.length > 0 ? items : null;
  }

  async addGameItems(data) {
    try {
      const existingItem = await this.db.game.get(data.name);
      if (existingItem) {
        console.warn(
          `[DexieGameSessionRepository] Game object ${data.name} already exists, updating instead.`
        );
        await this.db.game.put(data);
        return;
      }

      await this.db.game.add(data);
    } catch (err) {
      if (err.name === 'ConstraintError') {
        console.warn(
          `[DexieGameSessionRepository] Game object ${data.name} already exists (race condition), updating instead.`
        );
        await this.db.game.put(data);
      } else {
        throw err;
      }
    }
  }

  async updateLatestGameItemFields(updates) {
    const cursor = await this.db.game.orderBy('name').reverse().first();
    if (cursor) {
      Object.assign(cursor, updates);
      await this.db.game.put(cursor);
    } else {
      console.warn('[DexieGameSessionRepository] No game items found to update.');
    }
  }

  async updateGameItemFields(name, updates) {
    const gameItem = await this.db.game.get(name);
    if (gameItem) {
      Object.assign(gameItem, updates);
      await this.db.game.put(gameItem);
    } else {
      console.warn(`[DexieGameSessionRepository] Game item ${name} not found.`);
    }
  }

  async updateAllGameItems(updates) {
    const allGameItems = await this.db.game.toArray();

    for (const gameItem of allGameItems) {
      let hasChanges = false;
      for (const key in updates) {
        if (Object.prototype.hasOwnProperty.call(updates, key) && gameItem[key] !== updates[key]) {
          gameItem[key] = updates[key];
          hasChanges = true;
        }
      }

      if (hasChanges) {
        await this.db.game.put(gameItem);
      }
    }
  }

  async deleteGameItem(name) {
    await this.db.game.delete(name);
  }

  async clearGameItems() {
    await this.db.game.clear();
  }
}
