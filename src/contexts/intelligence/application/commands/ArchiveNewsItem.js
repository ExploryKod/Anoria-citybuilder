import { createNewsItem } from '../../domain/NewsItem.js';

/**
 * Marque une dépêche comme lue et l'archive (consultation admin).
 */
export class ArchiveNewsItem {
  /**
   * @param {import('../ports/NewsItemRepository.js').NewsItemRepository} newsItemRepository
   */
  constructor(newsItemRepository) {
    this.repository = newsItemRepository;
  }

  /**
   * @param {{ newsItemId: string, turn: number }} params
   * @returns {Promise<import('../../domain/NewsItem.js').NewsItem | null>}
   */
  async execute({ newsItemId, turn }) {
    const existing = await this.repository.getById(newsItemId);
    if (!existing) return null;

    const archived = createNewsItem({
      ...existing,
      lifecycle: 'archived',
      readAtTurn: Number(turn) || existing.turn,
    });
    await this.repository.save(archived);
    return archived;
  }
}
