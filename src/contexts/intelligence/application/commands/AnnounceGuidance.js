import { createNewsItem } from '../../domain/NewsItem.js';
import { requireActiveHamletId } from '../../../../core/persistence/hamlet/hamletSession.js';

/**
 * A dépêche that guides the player, written by another context (the tutorial's steps are Gameplay's): Intelligence files the text it is given and
 * knows nothing of where it comes from. Written once per guidance id and per hamlet, so announcing it twice writes nothing the second time. The
 * modal of the dépêches presents it.
 */
export class AnnounceGuidance {
  /**
   * @param {import('../ports/NewsItemRepository.js').NewsItemRepository} newsItemRepository
   */
  constructor(newsItemRepository) {
    this.repository = newsItemRepository;
  }

  /**
   * @param {{
   *   guidanceId: string,
   *   categoryId: string,
   *   turn: number,
   *   title: string,
   *   body: string,
   *   teaser: string,
   *   action?: { kind: 'buildTool', toolId: string } | null,
   * }} guidance `guidanceId` names the guidance for the once-only rule (`tutorial:<step id>`)
   * @returns {Promise<import('../../domain/NewsItem.js').NewsItem | null>} the dépêche, or null when it was already announced
   */
  async execute({ guidanceId, categoryId, turn, title, body, teaser, action = null }) {
    const id = `${guidanceId}:${requireActiveHamletId()}`;
    if (await this.repository.getById(id)) {
      return null;
    }
    const item = createNewsItem({
      id,
      turn,
      sourceId: 'city',
      categoryId,
      title,
      body,
      teaser,
      reliability: 'trusted',
      action,
      access: {},
      lifecycle: 'incoming',
      revelation: 'free',
    });
    await this.repository.save(item);
    return item;
  }
}
