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
   * Whether that guidance was written for the active hamlet (it stays filed, read or not, removed from a list or not).
   * @param {string} guidanceId
   * @returns {Promise<boolean>}
   */
  async wasAnnounced(guidanceId) {
    return (await this.repository.getById(`${guidanceId}:${requireActiveHamletId()}`)) !== null;
  }

  /**
   * Whether the player has got past that guidance: it was written and then read (closed, or left by its button), so it is archived.
   * @param {string} guidanceId
   * @returns {Promise<boolean>}
   */
  async wasRead(guidanceId) {
    const item = await this.repository.getById(`${guidanceId}:${requireActiveHamletId()}`);
    return item?.lifecycle === 'archived';
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
   *   illustrations?: string[],
   *   image?: { src: string, alt: string } | null,
   *   blocking?: boolean,
   *   legend?: Array<{ icon: string, word: string }>,
   *   choices?: Array<{ label: string, page: object }>,
   *   next?: object | null,
   * }} guidance `guidanceId` names the guidance for the once-only rule (`tutorial:<id>`)
   * @returns {Promise<import('../../domain/NewsItem.js').NewsItem | null>} the dépêche, or null when it was already announced
   */
  async execute({ guidanceId, categoryId, turn, title, body, teaser, action = null, illustrations = [], image = null, legend = [], choices = [], next = null, blocking = false }) {
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
      illustrations,
      image,
      blocking,
      legend,
      choices,
      next,
      access: {},
      lifecycle: 'incoming',
      revelation: 'free',
    });
    await this.repository.save(item);
    return item;
  }
}
