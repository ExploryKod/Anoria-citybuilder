/**
 * Liste les dépêches archivées (onglet admin).
 */
export class ListArchivedNews {
  /**
   * @param {import('../ports/NewsItemRepository.js').NewsItemRepository} newsItemRepository
   */
  constructor(newsItemRepository) {
    this.repository = newsItemRepository;
  }

  /** @returns {Promise<import('../../domain/NewsItem.js').NewsItem[]>} */
  async execute() {
    const items = await this.repository.listArchived();
    return items.sort((a, b) => b.turn - a.turn || b.id.localeCompare(a.id));
  }
}
