import { createNewsItem } from '../../domain/NewsItem.js';

/**
 * Paie la contribution et révèle la dépêche (revelation → revealed).
 */
export class PayForNewsItem {
  /**
   * @param {import('../ports/NewsItemRepository.js').NewsItemRepository} newsItemRepository
   * @param {object} ports
   * @param {(params: {
   *   newsItemId: string,
   *   amount: number,
   *   turn: number,
   *   channelId?: string,
   *   description?: string,
   * }) => Promise<{ recorded: boolean, reason?: string }>} ports.settleContribution
   */
  constructor(newsItemRepository, ports) {
    this.repository = newsItemRepository;
    this.settleContribution = ports.settleContribution;
  }

  /**
   * @param {{ newsItemId: string, turn: number }} params
   * @returns {Promise<{ ok: boolean, reason?: string, item?: import('../../domain/NewsItem.js').NewsItem }>}
   */
  async execute({ newsItemId, turn }) {
    const existing = await this.repository.getById(newsItemId);
    if (!existing) {
      return { ok: false, reason: 'not_found' };
    }
    if (existing.revelation === 'revealed' || existing.revelation === 'free') {
      return { ok: true, item: existing };
    }
    if (existing.revelation !== 'unpaid') {
      return { ok: false, reason: 'not_payable' };
    }

    const amount = Math.round(existing.access?.price ?? 10);
    const settle = await this.settleContribution({
      newsItemId: existing.id,
      amount,
      turn: Number(turn) || existing.turn,
      channelId: existing.sourceId,
      description: `Contribution — ${existing.title}`,
    });

    if (!settle?.recorded) {
      return { ok: false, reason: settle?.reason || 'settle_failed' };
    }

    const revealed = createNewsItem({
      ...existing,
      revelation: 'revealed',
    });
    await this.repository.save(revealed);
    return { ok: true, item: revealed };
  }
}
