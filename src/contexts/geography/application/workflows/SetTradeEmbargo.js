import { RELATION_EVENT_KINDS } from '../../../../shared/trade-catalog/TradeCatalog.js';
import { embargoKey } from '../../domain/policies/RelationMemoryPolicy.js';
import { tradedGoodsOf } from '../../domain/policies/PartnerPolicy.js';

/**
 * The city decrees an embargo on a good it trades with a partner, in one flow (what it sells to it, or what it buys from it), or lifts it. It costs nothing: the decree is an
 * event of the relation (`embargo_decreed` / `embargo_lifted`), and the embargo in force is READ from those events (`embargoesIn`), never stored apart. The trade of that good in that
 * flow then stops (the cease reasons `embargo` / `export_embargo`) and the others go on. With no good given, the whole flow is covered: one event per good the partner trades in it.
 *
 * A refusal is no defect, and the player is told why (TRADE_POLICY_REFUSALS): `not_traded` (the partner does not trade this good in this flow), `already_embargoed`, `not_embargoed`.
 */
export class SetTradeEmbargo {
  /**
   * @param {{
   *   relationEvents: { record: Function, embargoesOf: (cityId: string) => Promise<Set<string>> },
   *   now: () => { turn: number, year: number, monthIndex: number },
   * }} deps
   */
  constructor(deps) {
    this.deps = deps;
  }

  /**
   * The goods the partner trades in a flow: what it wants from us (our exports) or offers us (our imports), the exchanges the trade cycle really runs.
   * @param {{ wants: Array<{ good: string, merchantGood?: string }>, offers: Array<{ good: string }> }} entry
   * @param {'export' | 'import'} flow
   * @returns {string[]}
   */
  static goodsOf(entry, flow) {
    return tradedGoodsOf(entry, flow);
  }

  /**
   * @param {{ entry: object, flow: 'export' | 'import', good: string | null, decreed: boolean }} measure `good` null: every good of the flow; `decreed` false: lift
   * @returns {Promise<{ done: true, goods: string[] } | { done: false, reason: string }>}
   */
  async execute({ entry, flow, good, decreed }) {
    const traded = SetTradeEmbargo.goodsOf(entry, flow);
    if (good !== null && !traded.includes(good)) return { done: false, reason: 'not_traded' };
    const inForce = await this.deps.relationEvents.embargoesOf(entry.cityId);
    // What the measure changes: a decree touches the goods not yet embargoed, a lifting the ones that are.
    const changed = (good === null ? traded : [good]).filter((candidate) => inForce.has(embargoKey(flow, candidate)) !== decreed);
    if (changed.length === 0) return { done: false, reason: decreed ? 'already_embargoed' : 'not_embargoed' };

    const { turn, year, monthIndex } = this.deps.now();
    const kind = decreed ? 'embargo_decreed' : 'embargo_lifted';
    for (const target of changed) {
      await this.deps.relationEvents.record({ cityId: entry.cityId, kind, good: target, flow, turn, year, monthIndex, weight: RELATION_EVENT_KINDS[kind].weight });
    }
    return { done: true, goods: changed };
  }
}
