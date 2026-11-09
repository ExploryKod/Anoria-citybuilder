import { DIPLOMATIC_GESTURES, personalityOf } from '../../../../shared/trade-catalog/TradeCatalog.js';

/**
 * The city gives a partner city a sum of money to mend (or warm) the relation (DIPLOMATIC_GESTURES.gift). The gift is paid first, as an écriture of the journal; the event
 * of the relation is written only once the journal has taken it. The weight of the event is the gesture's own rule, times the partner's gratitude, stamped on the event.
 *
 * A refusal is no defect, and the player is told why: `below_minimum`, `cooling_down` (the same gesture was made too recently), or the journal's own reason (the State's
 * treasury cannot pay: `treasury_insufficient`).
 */
export class MakeDiplomaticGift {
  /**
   * @param {{
   *   relationEvents: { record: Function, lastOfKind: (cityId: string, kind: string) => Promise<{ turn: number } | null> },
   *   recordCityLine: (line: object) => Promise<{ recorded: boolean, reason?: string }>,
   *   now: () => { turn: number, year: number, monthIndex: number },
   *   daysPerMonth: () => number,
   *   cityName: (cityId: string) => string,
   * }} deps
   */
  constructor(deps) {
    this.deps = deps;
  }

  /**
   * The turn from which the gift can be made again, or null when it can be made now.
   * @param {string} cityId
   * @returns {Promise<number | null>}
   */
  async readyAtTurn(cityId) {
    const last = await this.deps.relationEvents.lastOfKind(cityId, 'gift_received');
    if (!last) return null;
    const ready = last.turn + DIPLOMATIC_GESTURES.gift.cooldownMonths * this.deps.daysPerMonth();
    return ready > this.deps.now().turn ? ready : null;
  }

  /**
   * @param {{ entry: object, amount: number }} gift the partner's catalog entry and the sum in €
   * @returns {Promise<{ done: true, points: number } | { done: false, reason: string, readyAtTurn?: number }>}
   */
  async execute({ entry, amount }) {
    if (!Number.isFinite(amount) || amount <= 0) throw new Error(`[trade] a gift is a positive sum, got ${amount}`);
    const rule = DIPLOMATIC_GESTURES.gift;
    if (amount < rule.minAmount) return { done: false, reason: 'below_minimum' };
    const readyAtTurn = await this.readyAtTurn(entry.cityId);
    if (readyAtTurn !== null) return { done: false, reason: 'cooling_down', readyAtTurn };

    const { turn, year, monthIndex } = this.deps.now();
    const paid = await this.deps.recordCityLine({
      turn,
      type: 'diplomatic_gift',
      amount,
      description: `Don à ${this.deps.cityName(entry.cityId)} pour améliorer nos relations`,
      businessKey: `diplomatic_gift:${entry.cityId}:${turn}`,
      partnerId: entry.cityId,
    });
    if (!paid.recorded) return { done: false, reason: paid.reason ?? 'refused' };

    const { weight: gratitude } = personalityOf(entry).gratitude;
    const points = Math.round(Math.min(rule.maxPoints, (amount / 100) * rule.pointsPer100) * gratitude * 10) / 10;
    await this.deps.relationEvents.record({ cityId: entry.cityId, kind: 'gift_received', turn, year, monthIndex, weight: points, cause: { amount } });
    return { done: true, points };
  }
}
