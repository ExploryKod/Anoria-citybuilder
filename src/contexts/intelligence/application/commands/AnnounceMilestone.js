import { createNewsItem } from '../../domain/NewsItem.js';
import { milestoneDraft } from '../../domain/catalogs/NewsDraftCatalog.js';
import { requireActiveHamletId } from '../../../../core/persistence/hamlet/hamletSession.js';

/**
 * A dépêche that marks a moment of the game, written once per hamlet and per game (the opening's treasure, the first mayor's house).
 * Its id names the milestone and the hamlet, so announcing it twice writes nothing the second time. The modal of the dépêches presents it.
 */
export class AnnounceMilestone {
  /**
   * @param {import('../ports/NewsItemRepository.js').NewsItemRepository} newsItemRepository
   */
  constructor(newsItemRepository) {
    this.repository = newsItemRepository;
  }

  /**
   * @param {{ milestoneId: string, turn: number, occurrence?: string | number, params?: object }} announcement `params`: what the milestone's text needs
   *   (see NewsDraftCatalog.js); `occurrence`: for a milestone that comes back (a year), which time of it this is, so it is announced once each time
   * @returns {Promise<import('../../domain/NewsItem.js').NewsItem | null>} the dépêche, or null when it was already announced
   */
  async execute({ milestoneId, turn, occurrence = null, params = {} }) {
    const id = `milestone:${milestoneId}:${requireActiveHamletId()}${occurrence === null ? '' : `:${occurrence}`}`;
    if (await this.repository.getById(id)) {
      return null;
    }
    const draft = milestoneDraft(milestoneId, params);
    const item = createNewsItem({
      id,
      turn: Number(turn) || 0,
      sourceId: draft.sourceId,
      categoryId: draft.categoryId,
      title: draft.title,
      body: draft.body,
      teaser: draft.teaser,
      reliability: draft.reliability,
      action: draft.action ?? null,
      access: {},
      lifecycle: 'incoming',
      revelation: draft.revelation,
    });
    await this.repository.save(item);
    return item;
  }
}
