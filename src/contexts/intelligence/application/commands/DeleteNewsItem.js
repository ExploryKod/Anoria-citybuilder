/**
 * Supprime définitivement une dépêche (ex. contribution refusée — Phase 2).
 */
export class DeleteNewsItem {
  /**
   * @param {import('../ports/NewsItemRepository.js').NewsItemRepository} newsItemRepository
   */
  constructor(newsItemRepository) {
    this.repository = newsItemRepository;
  }

  /**
   * @param {{ newsItemId: string }} params
   * @returns {Promise<boolean>}
   */
  async execute({ newsItemId }) {
    const existing = await this.repository.getById(newsItemId);
    if (!existing) return false;
    await this.repository.deleteById(newsItemId);
    return true;
  }
}
