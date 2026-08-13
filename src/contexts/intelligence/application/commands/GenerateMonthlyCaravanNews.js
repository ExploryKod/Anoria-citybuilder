import { createNewsItem } from '../../domain/NewsItem.js';
import { createNewsItemId } from '../../domain/NewsItemId.js';
import { canGenerateCaravanNews } from '../../domain/policies/CaravanNewsAccessPolicy.js';
import { planCaravanNewsDrafts } from '../../domain/policies/CaravanNewsGenerationPolicy.js';

/**
 * Génère les dépêches caravane du mois (1er jour), si barn + route active.
 */
export class GenerateMonthlyCaravanNews {
  /**
   * @param {import('../ports/NewsItemRepository.js').NewsItemRepository} newsItemRepository
   * @param {object} ports
   * @param {() => Promise<boolean>} ports.hasOperationalBarn
   * @param {() => Promise<boolean>|(() => boolean)} ports.hasActiveTradeRoute
   * @param {() => number} [ports.rng]
   */
  constructor(newsItemRepository, ports) {
    this.repository = newsItemRepository;
    this.hasOperationalBarn = ports.hasOperationalBarn;
    this.hasActiveTradeRoute = ports.hasActiveTradeRoute;
    this.rng = ports.rng ?? Math.random;
  }

  /**
   * @param {{ turn: number }} params
   * @returns {Promise<import('../../domain/NewsItem.js').NewsItem[]>}
   */
  async execute({ turn }) {
    const safeTurn = Number(turn) || 0;
    if (await this.repository.hasAnyForTurnAndSource(safeTurn, 'caravan')) {
      return [];
    }

    const hasOperationalBarn = await this.hasOperationalBarn();
    const hasActiveTradeRoute = await this.hasActiveTradeRoute();
    if (!canGenerateCaravanNews({ hasOperationalBarn, hasActiveTradeRoute })) {
      return [];
    }

    const drafts = planCaravanNewsDrafts({ turn: safeTurn, rng: this.rng });
    const nowIso = new Date().toISOString();
    /** @type {import('../../domain/NewsItem.js').NewsItem[]} */
    const created = [];

    for (const draft of drafts) {
      const item = createNewsItem({
        id: createNewsItemId(),
        turn: safeTurn,
        announcedAtIso: nowIso,
        sourceId: draft.sourceId,
        categoryId: draft.categoryId,
        title: draft.title,
        body: draft.body,
        teaser: draft.teaser,
        access: { price: draft.price },
        lifecycle: 'incoming',
        revelation: 'unpaid',
      });
      await this.repository.save(item);
      created.push(item);
    }

    return created;
  }
}
