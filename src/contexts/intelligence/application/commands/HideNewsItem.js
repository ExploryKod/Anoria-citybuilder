import { createNewsItem } from '../../domain/NewsItem.js';

/**
 * Takes a read dépêche out of a list the player keeps (the tutorial's history). It is not deleted: a guidance is written once per id, and deleting it would
 * let the tutorial write it again.
 */
export class HideNewsItem {
  /**
   * @param {import('../ports/NewsItemRepository.js').NewsItemRepository} newsItemRepository
   */
  constructor(newsItemRepository) {
    this.repository = newsItemRepository;
  }

  /**
   * @param {{ newsItemId: string }} params
   * @returns {Promise<boolean>} false when there is no such dépêche
   */
  async execute({ newsItemId }) {
    const existing = await this.repository.getById(newsItemId);
    if (!existing) return false;
    if (existing.lifecycle !== 'archived') throw new Error(`[news] "${newsItemId}" is not read yet: only a read dépêche can be removed from a list`);
    await this.repository.save(createNewsItem({ ...existing, hidden: true }));
    return true;
  }
}
