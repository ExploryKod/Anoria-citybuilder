import { PARTNER_EMBARGO, personalityOf } from '../../../../shared/trade-catalog/TradeCatalog.js';
import { embargoKey, embargoesIn, partnerEmbargoesIn } from './RelationMemoryPolicy.js';

/**
 * What a partner does on its own (docs/gameplay/PLAN_TRADE_RELATIONS.md, step 7): answer an embargo of ours (its `embargoReaction`), cut the relation, or decree an embargo of
 * its own. Pure decisions over the events of the relation (RelationMemoryPolicy) and the catalog; the cycle applies them and writes the events.
 */

const OTHER_FLOW = Object.freeze({ export: 'import', import: 'export' });

/**
 * The goods a partner trades in a flow: what it wants from us (our exports) or offers us (our imports), the exchanges the trade cycle really runs.
 * @param {{ wants: Array<{ good: string, merchantGood?: string }>, offers: Array<{ good: string }> }} entry @param {'export' | 'import'} flow @returns {string[]}
 */
export function tradedGoodsOf(entry, flow) {
  if (flow === 'export') return entry.wants.filter((want) => want.merchantGood).map((want) => want.good);
  if (flow === 'import') return entry.offers.map((offer) => offer.good);
  throw new Error(`[trade] a flow is "export" or "import", got "${flow}"`);
}

/** Whether the partner cuts the relation: its reaction is to break, and the relation has fallen under the city's own threshold (`relation.breakThreshold`). @param {{ entry: object, score: number }} state */
export function breakDue({ entry, score }) {
  if (entry.personality?.embargoReaction !== 'breaks') return false;
  if (!Number.isFinite(entry.relation?.breakThreshold)) throw new Error(`[trade] ${entry.cityId} breaks relations but declares no relation.breakThreshold`);
  return score < entry.relation.breakThreshold;
}

/**
 * The mirror embargo a partner that retaliates owes us, if any: for an embargo of ours still in force, older than its delay and not answered yet, the first good it trades in the
 * other flow that it does not already embargo (we cut what we sold it: it cuts what it sold us, and the other way round).
 * @param {{ events: ReadonlyArray<object>, entry: object, nowTurn: number, daysPerMonth: number }} state
 * @returns {{ flow: 'export' | 'import', good: string, answers: string, durationMonths: number } | null}
 */
export function retaliationDue({ events, entry, nowTurn, daysPerMonth }) {
  const { delayMonths, durationMonths } = personalityOf(entry).embargoReaction;
  if (delayMonths === undefined) return null;
  const inForce = embargoesIn(events);
  const alreadyOnUs = partnerEmbargoesIn(events, nowTurn);
  const answered = new Set(events.filter((event) => event.kind === 'partner_embargo_started' && event.cause?.answers).map((event) => event.cause.answers));
  for (const decree of events.filter((event) => event.kind === 'embargo_decreed')) {
    const answers = `${embargoKey(decree.flow, decree.good)}@${decree.turn}`;
    if (answered.has(answers) || !inForce.has(embargoKey(decree.flow, decree.good))) continue;
    if (decree.turn + delayMonths * daysPerMonth > nowTurn) continue;
    const flow = OTHER_FLOW[decree.flow];
    const good = tradedGoodsOf(entry, flow).find((candidate) => !alreadyOnUs.has(embargoKey(flow, candidate)));
    if (good) return { flow, good, answers, durationMonths };
  }
  return null;
}

/** How many of our duties stand above the partner's tolerance now: the last customs event of each good and flow is a `customs_hostile`. @param {ReadonlyArray<object>} events */
export function hostileCustomsIn(events) {
  const last = new Map();
  for (const event of events) if (event.kind.startsWith('customs_')) last.set(embargoKey(event.flow, event.good), event.kind);
  return [...last.values()].filter((kind) => kind === 'customs_hostile').length;
}

/**
 * The chance, this month, that the partner decrees an embargo of its own (PARTNER_EMBARGO): its relation's step, our duties above its tolerance, our own embargoes in force.
 * @param {{ tier: string, events: ReadonlyArray<object> }} state `tier`: the label of the relation's step (RELATION_TIERS)
 * @returns {number} from 0 to 1
 */
export function spontaneousEmbargoChance({ tier, events }) {
  const base = PARTNER_EMBARGO.chanceByTier[tier];
  if (base === undefined) throw new Error(`[trade] PARTNER_EMBARGO.chanceByTier has no chance for the relation step "${tier}"`);
  const chance = base + PARTNER_EMBARGO.perHostileCustoms * hostileCustomsIn(events) + PARTNER_EMBARGO.perOurEmbargo * embargoesIn(events).size;
  return Math.max(0, Math.min(1, chance));
}
