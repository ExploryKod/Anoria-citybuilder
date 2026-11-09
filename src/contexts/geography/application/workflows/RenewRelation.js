import { DIPLOMATIC_GESTURES, RELATION_EVENT_KINDS } from '../../../../shared/trade-catalog/TradeCatalog.js';

/**
 * The city sends a mission to a partner that broke the relation (`embargoReaction: breaks`, RunMonthlyCityTradeCycle): after the wait the catalog sets
 * (DIPLOMATIC_GESTURES.renewal), the mission is paid first, as an écriture of the journal, and only then is the relation reopened (status `active`, the break lifted) with an
 * event of the relation (`relation_renewed`) that lifts the score back above the partner's threshold.
 *
 * A refusal is no defect, and the player is told why: `not_broken`, `renewal_cooling_down`, or the journal's own reason (`treasury_insufficient`).
 */
export class RenewRelation {
  /**
   * @param {{
   *   cityTradeRepository: { getRelation: (cityId: string) => Promise<object | null>, saveRelation: (relation: object) => Promise<void> },
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
   * The turn from which a mission can be sent, or null when it can be now.
   * @param {string} cityId
   * @returns {Promise<number | null>}
   */
  async readyAtTurn(cityId) {
    const broken = await this.deps.relationEvents.lastOfKind(cityId, 'relation_broken');
    if (!broken) throw new Error(`[trade] the relation with ${cityId} is broken but its journal holds no "relation_broken" event`);
    const ready = broken.turn + DIPLOMATIC_GESTURES.renewal.cooldownMonths * this.deps.daysPerMonth();
    return ready > this.deps.now().turn ? ready : null;
  }

  /**
   * @param {{ entry: { cityId: string } }} mission the partner's catalog entry
   * @returns {Promise<{ done: true, points: number } | { done: false, reason: string, readyAtTurn?: number }>}
   */
  async execute({ entry }) {
    const relation = await this.deps.cityTradeRepository.getRelation(entry.cityId);
    if (!relation || relation.status !== 'expired') return { done: false, reason: 'not_broken' };
    const readyAtTurn = await this.readyAtTurn(entry.cityId);
    if (readyAtTurn !== null) return { done: false, reason: 'renewal_cooling_down', readyAtTurn };

    const { turn, year, monthIndex } = this.deps.now();
    const paid = await this.deps.recordCityLine({
      turn,
      type: 'diplomatic_mission',
      amount: DIPLOMATIC_GESTURES.renewal.cost,
      description: `Mission à ${this.deps.cityName(entry.cityId)} pour renouer la relation`,
      businessKey: `diplomatic_mission:${entry.cityId}:${turn}`,
      partnerId: entry.cityId,
    });
    if (!paid.recorded) return { done: false, reason: paid.reason ?? 'refused' };

    await this.deps.cityTradeRepository.saveRelation({ ...relation, status: 'active', ceased: null });
    const { weight } = RELATION_EVENT_KINDS.relation_renewed;
    await this.deps.relationEvents.record({ cityId: entry.cityId, kind: 'relation_renewed', turn, year, monthIndex, weight });
    return { done: true, points: weight };
  }
}
