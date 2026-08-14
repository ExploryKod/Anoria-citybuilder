import { createNewsItem } from '../../domain/NewsItem.js';
import { createNewsItemId } from '../../domain/NewsItemId.js';
import { planCityNewsDrafts } from '../../domain/policies/CityNewsGenerationPolicy.js';

/**
 * Génère les dépêches ville du **mois** (appelée au 1er jour du mois).
 * Idempotente pour un même `turn` (jour calendaire) + source city.
 */
export class GenerateMonthlyCityNews {
  /**
   * @param {import('../ports/NewsItemRepository.js').NewsItemRepository} newsItemRepository
   * @param {object} ports
   * @param {() => Promise<{ famishedPopulation: number, totalPopulation: number }>} ports.getFamishedSummary
   * @param {() => Promise<{ unemploymentPercentage: number, lack: number }>} ports.getEmploymentSummary
   * @param {() => number} [ports.rng]
   */
  constructor(newsItemRepository, ports) {
    this.repository = newsItemRepository;
    this.getFamishedSummary = ports.getFamishedSummary;
    this.getEmploymentSummary = ports.getEmploymentSummary;
    this.rng = ports.rng ?? Math.random;
  }

  /**
   * @param {{ turn: number }} params
   * @returns {Promise<import('../../domain/NewsItem.js').NewsItem[]>}
   */
  async execute({ turn }) {
    const safeTurn = Number(turn) || 0;
    if (await this.repository.hasAnyForTurnAndSource(safeTurn, 'city')) {
      return [];
    }

    const [famished, employment] = await Promise.all([
      this.getFamishedSummary(),
      this.getEmploymentSummary(),
    ]);

    const drafts = planCityNewsDrafts({
      turn: safeTurn,
      signals: {
        famishedPopulation: famished?.famishedPopulation,
        totalPopulation: famished?.totalPopulation,
        unemploymentPercentage: employment?.unemploymentPercentage,
        lack: employment?.lack,
      },
      rng: this.rng,
    });

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
        reliability: draft.reliability,
        access: {},
        lifecycle: 'incoming',
        revelation: 'free',
      });
      await this.repository.save(item);
      created.push(item);
    }

    return created;
  }
}
