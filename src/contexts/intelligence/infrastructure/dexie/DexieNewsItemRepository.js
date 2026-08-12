import db from '../../../../core/persistence/dexie/db.js';
import { createNewsItem } from '../../domain/NewsItem.js';

/**
 * Dexie adapter — table `newsItems`.
 */
export class DexieNewsItemRepository {
  /**
   * @param {import('../../domain/NewsItem.js').NewsItem} item
   */
  async save(item) {
    await db.newsItems.put(createNewsItem(item));
  }

  /**
   * @param {string} id
   * @returns {Promise<import('../../domain/NewsItem.js').NewsItem | null>}
   */
  async getById(id) {
    const row = await db.newsItems.get(id);
    return row ? createNewsItem(row) : null;
  }

  /**
   * @param {string} id
   */
  async deleteById(id) {
    await db.newsItems.delete(id);
  }

  /**
   * @param {number} turn
   * @param {string} sourceId
   */
  async hasAnyForTurnAndSource(turn, sourceId) {
    const count = await db.newsItems
      .where({ turn: Number(turn) || 0, sourceId })
      .count();
    return count > 0;
  }

  async listIncoming() {
    const rows = await db.newsItems.where('lifecycle').equals('incoming').toArray();
    return rows.map((row) => createNewsItem(row));
  }

  async listArchived() {
    const rows = await db.newsItems.where('lifecycle').equals('archived').toArray();
    return rows.map((row) => createNewsItem(row));
  }
}
