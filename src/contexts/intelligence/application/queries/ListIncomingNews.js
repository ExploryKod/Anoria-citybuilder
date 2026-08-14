/**
 * Liste les dépêches incoming (file event).
 */
export class ListIncomingNews {
  /**
   * @param {import('../ports/NewsItemRepository.js').NewsItemRepository} newsItemRepository
   */
  constructor(newsItemRepository) {
    this.repository = newsItemRepository;
  }

  /** @returns {Promise<import('../../domain/NewsItem.js').NewsItem[]>} */
  async execute() {
    const items = await this.repository.listIncoming();
    return items.sort((a, b) => a.turn - b.turn || a.id.localeCompare(b.id));
  }
}
